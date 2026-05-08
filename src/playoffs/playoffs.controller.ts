import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PlayoffsService } from './playoffs.service';
import { ScheduleService } from '../schedule/schedule.service';
import { EmailService, SMTPConfig } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { TournamentsService } from 'src/tournaments/tournaments.service';
import {
  CreatePlayoffBracketResultDto,
  PlayoffBracketResponseDto,
  PlayoffEntryDto,
  PlayoffSummaryDto,
  CreatePlayoffScheduleDto,
  CreatePlayoffScheduleResultDto,
  UpdatePlayoffBracketResultDto,
  UpdatePlayoffWinnerDto,
  UpdatePlayoffWinnerResultDto,
} from './dto/playoffs.dto';
import { Public } from 'src/auth/decorators/auth.decorators';

@Controller('playoffs')
export class PlayoffsController {
  constructor(
    private readonly playoffsService: PlayoffsService,
    private readonly scheduleService: ScheduleService,
    private readonly tournamentService: TournamentsService,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
  ) {}

  @Get('health')
  @Public()
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'Playoffs API is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * POST /api/playoffs
   * Creates a playoff bracket and schedules for a tournament.
   */
  @Post()
  async createPlayoffBracket(
    @Body() body: PlayoffEntryDto[],
  ): Promise<CreatePlayoffBracketResultDto> {
    try {
      return await this.playoffsService.createPlayoffBracket(body);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[Playoffs POST]', error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /api/playoffs
   * Updates the playoff bracket entries by their IDs.
   */
  @Put()
  async updatePlayoffBracket(
    @Body() body: PlayoffEntryDto[],
  ): Promise<UpdatePlayoffBracketResultDto> {
    try {
      return await this.playoffsService.updatePlayoffBracket(body);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[Playoffs PUT]', error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /api/playoffs/winner
   * Updates the winnerUserId field for a playoff bracket entry.
   */
  @Put('winner')
  async updatePlayoffWinner(
    @Body() body: UpdatePlayoffWinnerDto,
  ): Promise<UpdatePlayoffWinnerResultDto> {
    try {
      return await this.playoffsService.updatePlayoffWinner(body);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[Playoffs PUT Winner]', error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/playoffs/getAll
   * Returns all playoffs names and IDs.
   */
  @Get('getAll')
  @Public()
  async getAllPlayoffs(): Promise<PlayoffSummaryDto[]> {
    try {
      return await this.playoffsService.getAllPlayoffs();
    } catch (error) {
      console.error('[Playoffs GET All]', error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/playoffs/:tournamentId
   * Returns the playoff bracket for a tournament.
   */
  @Get(':tournamentId')
  @Public()
  async getPlayoffBracket(
    @Param('tournamentId') tournamentId: string,
  ): Promise<PlayoffBracketResponseDto[]> {
    try {
      const id = parseInt(tournamentId, 10);
      if (isNaN(id)) {
        throw new HttpException(
          'Invalid tournament ID',
          HttpStatus.BAD_REQUEST,
        );
      }
      return await this.playoffsService.getPlayoffBracket(id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[Playoffs GET]', error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/playoffs/schedule
   * Creates a schedule and sends playoff email to both players.
   */
  @Post('schedule')
  async createPlayoffSchedule(
    @Body() body: CreatePlayoffScheduleDto,
  ): Promise<CreatePlayoffScheduleResultDto> {
    try {
      const { usaPlayerId, ussrPlayerId, usaSeed, ussrSeed, tournamentId, randomSides, bo, due_date } = body;

      // Validate required fields
      if (!usaPlayerId || !ussrPlayerId || !tournamentId || !due_date) {
        throw new HttpException(
          'Missing required fields: usaPlayerId, ussrPlayerId, tournamentId, due_date',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Fetch user details
      const [userUsa, userUssr] = await Promise.all([
        this.usersService.getUserById(usaPlayerId),
        this.usersService.getUserById(ussrPlayerId),
      ]);

      if (!userUsa || !userUssr) {
        throw new HttpException(
          'One or both players not found',
          HttpStatus.NOT_FOUND,
        );
      }

      // Format due date
      const dueDate = new Date(due_date);
      const dueDateFormatted = dueDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const gameCode = this.scheduleService.generateCode()
      let bestOf = null
      if (bo) bestOf = Number(bo)

      const schedule = await this.scheduleService.addSchedulePlayers(
        usaPlayerId,
        ussrPlayerId,
        tournamentId,
        dueDate,
        gameCode,
        bestOf,
        randomSides
      );
      const tournament = await this.tournamentService.getTournamentsById([tournamentId.toString()])

      const playerUsa = `${userUsa.first_name} ${userUsa.last_name} Seed: ${usaSeed} (Playdek: ${userUsa.playdek_name})`;
      const playerUssr = `${userUssr.first_name} ${userUssr.last_name} Seed: ${ussrSeed} (Playdek: ${userUssr.playdek_name})`;

      const smtpConfig: SMTPConfig = {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER_JUNTA || '',
        password: process.env.SMTP_PWD_JUNTA || '',
      };

      const destEmails = [userUsa.email, userUssr.email].filter(Boolean) as string[];

      let emailSent = false;
// && process.env.NODE_ENV !== 'development'
      if (destEmails.length > 0) {
        const usaSeedn = Number(usaSeed)
        const ussrSeedn = Number(ussrSeed)
        let higher = null
        let lower = null
        // lower seed is "higher", don't forget
        if(usaSeedn < ussrSeedn) {
          higher = playerUsa
          lower = playerUssr
        } else {
           higher = playerUssr
           lower = playerUsa
        }

        await this.emailService.sendPlayoffsEmail(
          destEmails,
          tournament[0].tournament_name,
          dueDateFormatted,
          higher,
          lower,
          smtpConfig,
        );
        emailSent = true;
      }

      return {
        success: true,
        message: 'Playoff schedule created and email sent successfully',
        scheduleId: schedule.id,
        emailSent,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[Playoffs Schedule POST]', error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

