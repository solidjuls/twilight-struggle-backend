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
} from './dto/playoffs.dto';

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

  /**
   * POST /api/playoffs/schedule
   * Creates a schedule and sends playoff email to both players.
   */
  @Post('schedule')
  async createPlayoffSchedule(
    @Body() body: CreatePlayoffScheduleDto,
  ): Promise<CreatePlayoffScheduleResultDto> {
    try {
      const { usaPlayerId, ussrPlayerId, tournamentId, dueDateDays = 15 } = body;

      // Validate required fields
      if (!usaPlayerId || !ussrPlayerId || !tournamentId) {
        throw new HttpException(
          'Missing required fields: usaPlayerId, ussrPlayerId, tournamentId, dueDateDays',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Fetch user details
      const [userOne, userTwo] = await Promise.all([
        this.usersService.getUserById(usaPlayerId),
        this.usersService.getUserById(ussrPlayerId),
      ]);

      if (!userOne || !userTwo) {
        throw new HttpException(
          'One or both players not found',
          HttpStatus.NOT_FOUND,
        );
      }

      // Calculate due date
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueDateDays);
      const dueDateFormatted = dueDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const gameCode = this.scheduleService.generateCode()
      const schedule = await this.scheduleService.addSchedulePlayers(
        usaPlayerId,
        ussrPlayerId,
        tournamentId,
        dueDate,
        gameCode,
      );
      const tournament = await this.tournamentService.getTournamentsById([tournamentId.toString()])

      const playerOne = `${userOne.first_name} ${userOne.last_name} (Playdek: ${userOne.playdek_name})`;
      const playerTwo = `${userTwo.first_name} ${userTwo.last_name} (Playdek: ${userTwo.playdek_name})`;

      const smtpConfig: SMTPConfig = {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER_JUNTA || '',
        password: process.env.SMTP_PWD_JUNTA || '',
      };

      const destEmails = ['juli.arnalot@gmail.com']// [userOne.email, userTwo.email].filter(Boolean) as string[];

      let emailSent = false;
      if (destEmails.length > 0) {
        await this.emailService.sendPlayoffsEmail(
          destEmails,
          tournament[0].tournament_name,
          dueDateFormatted,
          playerOne,
          playerTwo,
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

