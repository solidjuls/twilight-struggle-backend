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
import { TournamentDto } from '../tournaments/dto/tournament.dto';
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

  private async resolveWithChildTournaments(parentIds: string[]): Promise<string[]> {
    const children = await this.tournamentsService.getChildTournaments(parentIds.map(Number));
    const childIds = children.map(t => t.id.toString());
    return [...new Set([...parentIds, ...childIds])];
  }

  private async buildAllUserTournaments(
    ongoingRegistered: TournamentDto[],
    adminTournaments: TournamentDto[],
    userId: number,
  ): Promise<TournamentDto[]> {
    const tournamentIdsWithSchedules = await this.scheduleService.getTournamentIdsWithSchedulesForUser(userId);

    const ongoingWithSchedules = ongoingRegistered.filter(
      t => tournamentIdsWithSchedules.has(Number(t.id)),
    );

    const adminChildren = (
      await Promise.all(
        adminTournaments.map(t => this.tournamentsService.getChildTournaments([Number(t.id)])),
      )
    ).flat();
    const merged = [
      ...ongoingWithSchedules,
      ...adminChildren.map(c => ({ id: c.id.toString(), tournament_name: c.tournament_name } as TournamentDto)),
      ...adminTournaments
    ];

    return merged.filter((t, i, self) => self.findIndex(x => x.id === t.id) === i);
  }

  @Get()
  async getSchedules(
    @Query() query: GetSchedulesQueryDto,
    @CurrentUser() user: JwtPayloadDto,
  ): Promise<ScheduleListResponse> {
    try {
      const {
        tournamentId,
        userId,
        fullSchedule = false,
        page = '1',
        pageSize = '20',
      } = query;

      const parsedPage = Number(page);
      const parsedPageSize = Number(pageSize);

      const userTournaments = await this.tournamentsService.getUserRegisteredTournaments(user.id.toString());
      const ongoingUserTournaments = userTournaments.filter(t => t.status_id === 4);
      const userAdminTournaments = await this.tournamentsService.getUserAdminTournaments(user.id.toString());
      const allUserTournaments = await this.buildAllUserTournaments(ongoingUserTournaments, userAdminTournaments, Number(user.id));
console.log("allUserTournaments", allUserTournaments, userAdminTournaments)
      let tournamentIds: string[];

      if (tournamentId) {
        tournamentIds = await this.resolveWithChildTournaments(tournamentId.split(','));
      } else if (ongoingUserTournaments.length > 0) {
        tournamentIds = await this.resolveWithChildTournaments([ongoingUserTournaments[0].id.toString()]);
      } else {
        return {
          results: [],
          totalRows: 0,
          currentPage: parsedPage,
          totalPages: 0,
          userTournaments: allUserTournaments,
          defaultTournament: '',
        };
      }

      const filterUserId = fullSchedule ? undefined : (userId ? Number(userId) : Number(user.id));

      const result = await this.scheduleService.getSchedules({
        tournamentIds,
        userId: filterUserId,
        page: parsedPage,
        pageSize: parsedPageSize,
      });

      return {
        ...result,
        userTournaments: allUserTournaments,
        defaultTournament: tournamentIds[0],
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
      const { usa, ussr, t, d, gc, randomSides, best_of } = body.data;

      if (best_of !== undefined && best_of !== null && ![1, 3, 5, 7].includes(best_of)) {
        throw new HttpException(
          'best_of must be 1, 3, 5, 7, or null',
          HttpStatus.BAD_REQUEST,
        );
      }

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
        best_of ?? null,
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
        const { scheduleId, usa, ussr, t, d, gc, randomSides, best_of } = item;

        if (best_of !== undefined && best_of !== null && ![1, 3, 5, 7].includes(best_of)) {
          throw new HttpException(
            'best_of must be 1, 3, 5, 7, or null',
            HttpStatus.BAD_REQUEST,
          );
        }

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
            best_of ?? null,
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
