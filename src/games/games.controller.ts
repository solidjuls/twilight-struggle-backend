import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import {
  GetGamesQueryDto,
  GameListResponse,
  GameFilterDto,
  SubmitGameRequestDto,
  RecreateGameDto,
  GetGameChartQueryDto,
  SubmitGameDto,
} from './dto/game.dto';
import { ScheduleService } from 'src/schedule/schedule.service';
import { PlayoffsService } from 'src/playoffs/playoffs.service';
import { EmailService, SMTPConfig } from 'src/email/email.service';
import { UsersService } from 'src/users/users.service';
import { UserDetailDto } from 'src/users/dto/users.dto';

@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(
    private readonly gamesService: GamesService,
    private readonly scheduleService: ScheduleService,
    private readonly playoffsService: PlayoffsService,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService

  ) {}

  @Get()
  @Public() // Making this public as game results are typically viewable by everyone
  async getGames(@Query() query: GetGamesQueryDto): Promise<GameListResponse> {
    try {
      const {
        id,
        p = '1',
        pageSize = '20',
        userFilter,
        toFilter,
        video,
      } = query;

      // Parse query parameters
      const page = Number(p);
      const pageSizeNum = Number(pageSize);

      // Create filter object
      const filter: GameFilterDto = {};

      if (id) {
        filter.id = Number(id);
      }

      if (userFilter) {
        filter.userFilter = userFilter.split(',').map(Number);
      }

      if (toFilter) {
        filter.toFilter = toFilter.split(',').map(Number);
      }

      if (video === 'true') {
        filter.video = true;
      }

      const result = await this.gamesService.getGamesWithRatings(
        filter,
        page,
        pageSizeNum,
      );

      return result;
    } catch (error) {
      console.error('[Games GET]', error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('top/:count')
  @Public()
  async getTopGames(@Param('count') count: string): Promise<GameListResponse> {
    try {
      const topCount = Number(count);
      
      if (isNaN(topCount) || topCount <= 0 || topCount > 100) {
        throw new HttpException(
          'Invalid count parameter. Must be between 1 and 100.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.gamesService.getGamesWithRatings(
        {}, // No filters for top games
        1, // First page
        topCount, // Use count as page size
      );

      return result;
    } catch (error) {
      console.error('[Games GET Top]', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

    @Get('chart-data')
  @Public()
  async getChartData(@Query() query: GetGameChartQueryDto) {
    try {
      const { type, userId, fromDate } = query;
      if (type === 'winType') {
        if (!userId) {
          throw new HttpException(
            'Invalid query parameters',
            HttpStatus.BAD_REQUEST,
          );
        }
        const date = fromDate ? new Date(fromDate) : undefined;
        const result = await this.gamesService.getWinTypeChartData(userId, date);
        const serializedData = JSON.stringify(result, (_, value) => {
          if (typeof value === "bigint") {
            return value.toString();
          }
          return value;
        });
        return serializedData;
      }
    }
    catch (error) {
      console.error('[Games GET Chart Data]', error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @Public()
  async getGameById(@Param('id') id: string) {
    try {
      const game = await this.gamesService.getGameById(id);
      if (!game) {
        throw new HttpException(
          'Game not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return game;
    } catch (error) {
      console.error('[Games GET by ID]', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  getSeriesWinner(games: {
    id: bigint;
    usa_player_id: bigint;
    ussr_player_id: bigint;
    game_winner: string;
}[], bestOf: number): bigint | null {
    if (games.length === 0) return null;

    const countWins = new Map<number, number>();
    for (const game of games) {
      if (game.game_winner === "1") {
        const usaId = Number(game.usa_player_id)
        countWins.set(usaId, (countWins.get(usaId) || 0) + 1)
      }
      if (game.game_winner === "2") {
        const ussrId = Number(game.ussr_player_id)
        countWins.set(ussrId, (countWins.get(ussrId) || 0) + 1)
      }
    }
    // console.log("games", games, Math.ceil(bestOf / 2), usaWins, ussrWins)

    const neededToWin = Math.ceil(bestOf / 2);
    let winnerId = null
    for (const [key, value] of countWins) {
      if (value === neededToWin) winnerId = key;
    }
    return winnerId;
  }

  async updateITSLPlayoffBracket(data: SubmitGameDto) {
    const userId = data.gameWinner === "1" ? BigInt(data.usaPlayerId) : BigInt(data.ussrPlayerId)
    const tId = data.tournamentId

    // Check best_of_games
    const BO = await this.playoffsService.getBOFromPlayoff(userId, tId)

    if (BO > 1) {
      // Select on game_results games by tId and the 2 players
      const games = await this.gamesService.getGameByUsers(BigInt(data.usaPlayerId), BigInt(data.ussrPlayerId), Number(data.tournamentId))

      const winnerId = this.getSeriesWinner(games, BO)
      console.log("winnerId", winnerId)
      // if there's a winner considering BO
      if (winnerId) {
        // update bracket, create schedule and send email
        const userIds = await this.playoffsService.updateBracketFromSubmit(userId, Number(data.tournamentId))

        console.log("userIds", userIds)
        let users: UserDetailDto[] = []
        if (userIds.length === 2) {
          for (const userId of userIds) {
            const user = await this.usersService.getUserById(userId.toString())
            users.push(user)
          }
        }
        const smtpConfig: SMTPConfig = {
          host: process.env.SMTP_HOST || 'localhost',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER_JUNTA || '',
          password: process.env.SMTP_PWD_JUNTA || '',
        };
        console.log("smtpConfig", smtpConfig)

        const playerOne = `${users[0].first_name} ${users[0].last_name} (Playdek: ${users[0].playdek_name}) - Timezone: ${users[0].timezone_id}`
        const playerTwo = `${users[1].first_name} ${users[1].last_name} (Playdek: ${users[1].playdek_name}) - Timezone: ${users[1].timezone_id}`

        this.scheduleService.addSchedulePlayers(
          users[0].id,
          users[1].id,
          Number(data.tournamentId),
          new Date(),
          'J002'
        )

        const emailSent = await this.emailService.sendPlayoffsEmail(
          ['juli.arnalot@gmail.com'],
          'Twilight Struggle Playoffs',
          '12-12-2026',
          playerOne,
          playerTwo,
          smtpConfig
        );
        console.log("email sent")
      } else {
        // create a new schedule with sides switched
        this.scheduleService.addSchedulePlayers(
          data.ussrPlayerId,
          data.usaPlayerId,
          Number(data.tournamentId),
          new Date(),
          'J002'
        )
      }
    }
      

    // send email with newly schedule created
    
  }

  @Post('submit')
  async submitGame(@Body() submitGameRequest: SubmitGameRequestDto) {
    try {
      const data = submitGameRequest.data;

      if (submitGameRequest.data.scheduleId) {
        // Validate schedule integrity before submission
        const validateSchedule = await this.scheduleService.validateScheduleIntegrity({
          usaPlayerId: Number(data.usaPlayerId),
          id: Number(data.scheduleId),
          ussrPlayerId: Number(data.ussrPlayerId),
          gameCode: data.gameCode,
          tournamentId: Number(data.tournamentId),
        });

        if (validateSchedule?.game_results_id) {
          throw new HttpException(
            `Schedule ${data.scheduleId} already submitted`,
            HttpStatus.BAD_REQUEST,
          );
        }

        if (!validateSchedule?.id) {
          throw new HttpException(
            'Schedule not found',
            HttpStatus.BAD_REQUEST,
          );
        }
      }
      const result = await this.gamesService.submitGame(submitGameRequest.data);

      if (result && submitGameRequest.data.scheduleId) {
        await this.scheduleService.updateSchedule({
          gameResultId: result.id,
          scheduleId: Number(submitGameRequest.data.scheduleId),
        });

        // if tournament is ITSL main playoff
        if (data.tournamentId === "325") {
          this.updateITSLPlayoffBracket(data)
        }
      }
      return result;
    } catch (error) {
      console.error('[Games POST Submit]', error);
      throw new HttpException(
        'Error submitting result',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('recreate')
  @UseGuards(JwtAuthGuard)
  async recreateGame(@Body() body: { data: RecreateGameDto }, @Req() req: any) {
    try {
      const user = req.user;
      const result = await this.gamesService.recreateGame(body.data, user.role, user.mail);

      // Convert BigInt to string for JSON serialization
      const resultParsed = JSON.stringify(result, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      );

      return JSON.parse(resultParsed);
    } catch (error) {
      console.error('Error recreating game:', error);
      throw new HttpException(
        error.message || 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @Public()
  getHealth() {
    return {
      status: 'Games API is healthy',
      timestamp: new Date().toISOString()
    };
  }
}
