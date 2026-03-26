import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PlayoffsService } from './playoffs.service';
import {
  CreatePlayoffBracketResultDto,
  PlayoffBracketResponseDto,
  PlayoffEntryDto,
  PlayoffSummaryDto,
} from './dto/playoffs.dto';

@Controller('playoffs')
export class PlayoffsController {
  constructor(private readonly playoffsService: PlayoffsService) {}

  @Get('health')
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
   * GET /api/playoffs/getAll
   * Returns all playoffs names and IDs.
   */
  @Get('getAll')
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
}

