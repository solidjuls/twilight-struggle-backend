import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayloadDto } from '../auth/dto/auth.dto';
import { Public } from '../auth/decorators/public.decorator';
import {
  GetSchedulesQueryDto,
  CreateScheduleDto,
  UpdateScheduleDto,
  ReplacePlayersDto,
  DeletePlayerDto,
  ScheduleListResponse,
  UploadCsvScheduleDto,
} from './dto/schedule.dto';

@Controller('schedule')
@UseGuards(JwtAuthGuard)
export class ScheduleController {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly tournamentsService: TournamentsService,
  ) {}

  @Get()
  async getSchedules(
    @Query() query: GetSchedulesQueryDto,
    @CurrentUser() user: JwtPayloadDto,
  ): Promise<ScheduleListResponse> {
    try {
      // Handle new parameter format
      const {
        userId,
        tournamentId,
        page = '1',
        pageSize = '20',
        onlyPending,
        noOpponent,
        orderBy = 'dueDate',
        orderDirection = 'asc',
        a = '0',
      } = query;

      // Use new parameters if available, otherwise fall back to legacy
      const finalUserId = userId || user.id.toString();
      const finalPage = page || '1';
      const finalPageSize = pageSize || '20';

      // Get user's registered tournaments first
      const userTournaments = await this.tournamentsService.getUserRegisteredTournaments(user.id.toString());
      const ongoingUserTournaments = userTournaments.filter(t => t.status_id === 4);
      const tournamentsWithActiveSchedules = await this.scheduleService.filterTournamentsBySchedule(ongoingUserTournaments, Number(finalUserId));
      const userAdminTournaments = await this.tournamentsService.getUserAdminTournaments(user.id.toString());
      const allTournaments = [...tournamentsWithActiveSchedules, ...userAdminTournaments]
      const uniqueTournaments = allTournaments.filter((tournament, index, self) =>
        index === self.findIndex(t => t.id === tournament.id)
      );

      // Parse parameters
      const parsedUserId = finalUserId ? Number(finalUserId) : undefined;
      const parsedPage = Number(finalPage);
      const parsedPageSize = Number(finalPageSize);
      const parsedOnlyPending = onlyPending === 'true';
      const adminView = a === '1';

      // Handle tournament parameter - make it mandatory
      let parsedTournamentIds: string[] | undefined;

      if (tournamentId) {
        const requestedIds = tournamentId.split(',');
        // Get child tournaments (those with parent_id matching the requested tournament IDs)
        const childTournaments = await this.tournamentsService.getChildTournaments(requestedIds.map(Number));
        const childIds = childTournaments.map(t => t.id.toString());
        parsedTournamentIds = [...requestedIds, ...childIds];
      } else if (ongoingUserTournaments.length > 0) {
        const ongoingUniqueTournaments = uniqueTournaments.filter(t => t.status_id === 4);
        const defaultTournament = ongoingUniqueTournaments.length > 0
          ? ongoingUniqueTournaments[0]
          : ongoingUserTournaments[0];

        // Get child tournaments for the default tournament
        const childTournaments = await this.tournamentsService.getChildTournaments([Number(defaultTournament.id)]);
        const childIds = childTournaments.map(t => t.id.toString());
        parsedTournamentIds = [defaultTournament.id, ...childIds];
      } else {
        return {
          results: [],
          totalRows: 0,
          currentPage: parsedPage,
          totalPages: 0,
          userTournaments: uniqueTournaments,
          defaultTournament: '',
        };
      }
      // // validate tournament is open for non-admin view
      // if (finalUserId) {
      //   const openTournament = ongoingUserTournaments.filter(t => t.id === parsedTournamentIds[0] && t.status_id === 4);
      //   console.log("parsedTournamentIds1", parsedTournamentIds, adminView, finalUserId, openTournament);
      //   if (openTournament.length === 0) { 
      //     return {
      //       results: [],
      //       totalRows: 0,
      //       currentPage: parsedPage,
      //       totalPages: 0,
      //       userTournaments: uniqueTournaments,
      //       defaultTournament: parsedTournamentIds[0],
      //     };
      //   }
      // }

      // Find if user is admin of tournamentId
      const userIsAdmin = userAdminTournaments.some(t => t.id === parsedTournamentIds[0]);

      if (userId && !userIsAdmin && userId !== user.id.toString()) {
        throw new HttpException('Insufficient permissions', HttpStatus.FORBIDDEN);
      }

      // Validate orderBy parameter
      const validOrderBy = ['dueDate', 'gameDate', 'tournamentName'];
      const finalOrderBy = validOrderBy.includes(orderBy) ? orderBy : 'dueDate';

      // Validate orderDirection parameter
      const validOrderDirection = ['asc', 'desc'];
      const finalOrderDirection = validOrderDirection.includes(orderDirection) ? orderDirection : 'asc';

      const result = await this.scheduleService.getSchedules({
        userId: parsedUserId,
        tournament: parsedTournamentIds,
        page: parsedPage,
        pageSize: parsedPageSize,
        adminView,
        noOpponent,
        onlyPending: parsedOnlyPending,
        orderBy: finalOrderBy,
        orderDirection: finalOrderDirection,
      });

      result.results.sort((a, b) => {
        if (a.gameResultsId === null && b.gameResultsId !== null) {
          return -1;
        }
        if (a.gameResultsId !== null && b.gameResultsId === null) {
          return 1;
        }
        return 0;
      });
      return {
        ...result,
        userTournaments: uniqueTournaments,
        defaultTournament: parsedTournamentIds[0],
      };
    } catch (error) {
      console.error('[Schedule GET]', error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

    @Get('players-with-missing-games')
    async playersWithMissingGames(
      @Query() query: any,
      @CurrentUser() user: JwtPayloadDto,
    ) {
      try {
        const { tid } = query;
        const id = parseInt(tid);
        console.log("tournamentId", id, tid, query);
  
        // const targetGames = body.targetGamesPerPlayer || 20;
        const result = await this.scheduleService.getPlayersWithMissingGames(id, 20);
  
        return {
          success: true,
          message: 'Missing schedule pairs created',
          ...result
        };
      } catch (error) {
        console.error("CREATE MISSING PAIRS API Error:", error);
        throw new HttpException(
          error.message || 'Failed to create missing pairs',
          error.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

  @Post()
  async updateScheduleOrSubmit(
    @Body() body: { data: UpdateScheduleDto },
    @CurrentUser() user: JwtPayloadDto,
  ) {
    try {
      const schedules = body.data;

      if (schedules.due_date) {
        const scheduleResponse = await this.scheduleService.updateSchedule({
          dueDate: new Date(schedules.due_date),
          scheduleId: Number(schedules.id),
        });

        return {
          message: `Due date for schedule ${schedules.id} updated successfully`,
          data: scheduleResponse,
        };
      } 
    } catch (error) {
      console.error('[Schedule POST]', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put()
  async addSchedule(@Body() body: { data: CreateScheduleDto }) {
    try {
      const { usa, ussr, t, d, gc, randomSides } = body.data;

      const children = await this.tournamentsService.getChildTournaments([Number(t)]);
      if (children.length > 0) {
        throw new HttpException(
          'This tournament has playoffs running. Add the schedule on the correct playoff tab',
          HttpStatus.BAD_REQUEST,
        );
      }

      const updated = await this.scheduleService.addSchedulePlayers(
        usa,
        ussr,
        Number(t),
        new Date(d),
        gc,
        null,
        randomSides,
      );

      return updated;
    } catch (error) {
      console.error('[Schedule PUT]', error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('create-schedules-bulk')
  async addSchedulesBulk(@Body() body: { data: CreateScheduleDto[] }) {
    const results: any[] = [];
    try {
      for (const item of body.data) {
        const { scheduleId, usa, ussr, t, d, gc, randomSides } = item;

        const children = await this.tournamentsService.getChildTournaments([Number(t)]);
        if (children.length > 0) {
          throw new HttpException(
            'This tournament has playoffs running. Add the schedule on the correct playoff tab',
            HttpStatus.BAD_REQUEST,
          );
        }

        if (scheduleId) {
          const updated = await this.scheduleService.updateSchedulePlayers(
            scheduleId,
            usa,
            ussr,
            Number(t),
            new Date(d),
            gc,
            randomSides,
          );
          results.push(updated);
        } else {
          const updated = await this.scheduleService.addSchedulePlayers(
            usa,
            ussr,
            Number(t),
            new Date(d),
            gc,
            null,
            randomSides,
          );
          results.push(updated);
        }
      }
      return results;
    } catch (error) {
      console.error('[Schedule PUT bulk]', error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch()
  async replaceOrDeletePlayer(
    @Body() body: { data: ReplacePlayersDto | DeletePlayerDto },
  ) {
    try {
      const data = body.data;

      // Check if this is a delete operation
      if ('u' in data && data.u) {
        const updated = await this.scheduleService.deleteSchedulePlayer(
          Number(data.u),
          Number(data.t),
        );
        return `${JSON.stringify(updated)}`;
      }

      // Replace player operation
      if ('pold' in data && 'pnew' in data) {
        const updated = await this.scheduleService.replaceSchedulePlayers(
          data.pold,
          data.pnew,
          Number(data.t),
        );
        return updated;
      }

      throw new HttpException(
        'Invalid request data',
        HttpStatus.BAD_REQUEST,
      );
    } catch (error) {
      console.error('[Schedule PATCH]', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async deleteSchedule(@Param('id') id: string) {
    try {
      const result = await this.scheduleService.deleteSchedule(Number(id));
      return {
        success: result.success,
        message: `Schedule ${id} deleted successfully`,
      };
    } catch (error) {
      console.error('[Schedule DELETE]', error);
      if (error instanceof HttpException) {
        throw error;
      }
      if (error.message?.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error.message?.includes('Cannot delete')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('upload-csv')
  async uploadCsvSchedule(
    @Body() body: { data: UploadCsvScheduleDto },
    @CurrentUser() user: JwtPayloadDto,
  ) {
    try {
      console.log(`CSV upload started by user ${user.id}, processing ${body.data.file.length} rows`);
      const result = await this.scheduleService.uploadCsvSchedule(body.data);
      console.log(`CSV upload completed: ${result.created} created, ${result.errors.length} errors`);
      return {
        success: true,
        message: `Successfully created ${result.created} schedule entries`,
        created: result.created,
        errors: result.errors,
      };
    } catch (error) {
      console.error('CSV upload error:', error);
      throw new HttpException(
        error.message || 'Failed to upload CSV',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @Public()
  getHealth() {
    return {
      status: 'Schedule API is healthy',
      timestamp: new Date().toISOString(),
      maxPayloadSize: '50mb',
      csvUploadSupported: true
    };
  }
}
