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
} from './dto/game.dto';
import { ScheduleService } from 'src/schedule/schedule.service';

@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(
    private readonly gamesService: GamesService,
    private readonly scheduleService: ScheduleService
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

  @Post('submit')
  async submitGame(@Body() submitGameRequest: SubmitGameRequestDto) {
    try {
      const result = await this.gamesService.submitGame(submitGameRequest.data);

      if (result && submitGameRequest.data.scheduleId) {
        await this.scheduleService.updateSchedule({
          gameResultId: result.id,
          scheduleId: Number(submitGameRequest.data.scheduleId),
        });
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
