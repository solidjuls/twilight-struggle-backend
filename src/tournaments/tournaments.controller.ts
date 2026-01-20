import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Query,
  Body,
  Param,
  HttpException,
  HttpStatus,
  UseGuards
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import {
  GetTournamentsQueryDto,
  TournamentDto,
  RegisteredPlayerDto,
  CreateTournamentDto,
  UpdateTournamentDto,
  UpdateTournamentStatusDto,
  AddTournamentAdminDto,
  RemoveTournamentAdminDto
} from './dto/tournament.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayloadDto } from '../auth/dto/auth.dto';
import { UsersService } from 'src/users/users.service';

@Controller('tournaments')
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  constructor(
    private readonly tournamentsService: TournamentsService,
    private readonly userService: UsersService
  ) {}

  @Get()
  @Public()
  async getTournaments(@Query() query: GetTournamentsQueryDto, @CurrentUser() user?: JwtPayloadDto) {
    try {
      const { id, status, players } = query;
      // Get registered players for a tournament
      if (typeof id === "string" && players === "true") {
        const registeredPlayers: RegisteredPlayerDto[] = await this.tournamentsService.getRegisteredPlayers(
          Number(id),
          user?.role,
          user?.id?.toString()
        );
        // add the rating for each registered user
        const registeredPlayersWithRating = await Promise.all(
          registeredPlayers.map(async (player) => {
            const rating = await this.userService.getUserRating(BigInt(player.userId));
            return {
              ...player,
              rating
            };
          })
        );
        return registeredPlayersWithRating;
      }

      // Get tournaments by ID(s)
      if (typeof id === "string") {
        const tournaments: TournamentDto[] = await this.tournamentsService.getTournamentsById(id.split(','));
        return tournaments;
      }

      // Get tournaments by status(es)
      if (typeof status === "string") {
        const tournaments: TournamentDto[] = await this.tournamentsService.getTournamentsByStatus(status.split(','));
        return tournaments;
      }

      // If no specific query parameters, return empty array or all tournaments
      return [];
      
    } catch (error) {
      console.error("TOURNAMENT GET API Error:", error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/tournaments - Update tournament status or register user
  @Post()
  async updateTournamentOrRegister(@Body() body: any, @CurrentUser() user: JwtPayloadDto) {
    try {
      const { id, status, userId } = body;

      if (id && (userId || user.id)) {
        // Register user for tournament - use provided userId or current user's id
        const targetUserId = userId || user.id.toString();

        const registered = await this.tournamentsService.registerForTournament(Number(id), targetUserId);
        return {
          ...registered,
          userId: registered.userId.toString()
        };
      }

      if (id && status) {
        // Update tournament status
        const updated = await this.tournamentsService.updateTournament(Number(id), Number(status));
        return updated;
      }

      throw new HttpException('Missing required parameters', HttpStatus.BAD_REQUEST);
    } catch (error) {
      console.error("TOURNAMENT POST API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // PUT /api/tournaments - Update tournament details
  @Put()
  async updateTournamentFull(@Body() body: UpdateTournamentDto) {
    try {
      const { id, tournamentName, status, waitlist, startingDate, description } = body;

      if (!id) {
        throw new HttpException('Missing tournament ID', HttpStatus.BAD_REQUEST);
      }

      const updateData: any = {};
      if (tournamentName) updateData.tournamentName = tournamentName;
      if (status) updateData.status = status;
      if (waitlist !== undefined) updateData.waitlist = waitlist;
      if (startingDate) updateData.startingDate = new Date(startingDate);
      if (description !== undefined) updateData.description = description;

      const updated = await this.tournamentsService.updateTournamentFull(Number(id), updateData);
      return updated;
    } catch (error) {
      console.error("TOURNAMENT PUT API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // PATCH /api/tournaments - Create new tournament
  @Patch()
  async createTournament(@Body() body: CreateTournamentDto) {
    try {
      const { tournamentName, status, waitlist, admins, startingDate, description } = body;

      if (!tournamentName || !status) {
        throw new HttpException('Missing name or status in request body', HttpStatus.BAD_REQUEST);
      }

      const startingDateFormatted = startingDate ? new Date(startingDate) : undefined;
      const created = await this.tournamentsService.createTournament({
        tournamentName,
        status,
        waitlist,
        admins: admins ? Number(admins) : undefined,
        startingDate: startingDateFormatted,
        description
      });
      return created;
    } catch (error) {
      console.error("TOURNAMENT PATCH API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // DELETE /api/tournaments/:id - Delete tournament
  @Delete(':id')
  async deleteTournament(@Param('id') id: string) {
    try {
      if (!id) {
        throw new HttpException('Invalid or missing ID', HttpStatus.BAD_REQUEST);
      }

      const removed = await this.tournamentsService.deleteTournament(id);
      return { id: removed.id };
    } catch (error) {
      console.error("TOURNAMENT DELETE API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // DELETE /api/tournaments/:id/unregister - Unregister user from tournament
  @Delete(':id/unregister')
  async unregisterFromTournament(
    @Param('id') tournamentId: string,
    @Body() body: { regId?: string; userId?: string },
    @CurrentUser() user: JwtPayloadDto,
  ) {
    try {
      if (!tournamentId) {
        throw new HttpException('Tournament ID is required', HttpStatus.BAD_REQUEST);
      }

      let result: any;
      if (body.regId) {
        // Admin removing a specific registration by registrationId
        result = await this.tournamentsService.unregisterByRegistrationId(
          parseInt(tournamentId),
          body.regId
        );
      } else {
        // Self-unregistration or admin unregistering by userId
        const targetUserId = body.userId || user.id.toString();
        result = await this.tournamentsService.unregisterByUserId(
          parseInt(tournamentId),
          targetUserId
        );
      }

      return {
        message: 'Successfully unregistered from tournament',
        result
      };
    } catch (error) {
      console.error("TOURNAMENT UNREGISTER API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // PATCH /api/tournaments/:id/forfeit - Forfeit a player from tournament
  @Patch(':id/forfeit')
  async forfeitPlayer(
    @Param('id') tournamentId: string,
    @Body() body: { registrationId: number },
    @CurrentUser() user: JwtPayloadDto,
  ) {
    try {
      if (!tournamentId) {
        throw new HttpException('Tournament ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.registrationId) {
        throw new HttpException('Registration ID is required', HttpStatus.BAD_REQUEST);
      }

      const result = await this.tournamentsService.forfeitPlayer(
        parseInt(tournamentId),
        body.registrationId
      );

      return {
        message: 'Player has been forfeited from the tournament',
        result
      };
    } catch (error) {
      console.error("TOURNAMENT FORFEIT API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/tournaments/:id/admins - Get tournament admins
  @Get(':id/admins')
  async getTournamentAdmins(
    @Param('id') tournamentId: string,
    @CurrentUser() user: JwtPayloadDto,
  ) {
    try {
      if (!tournamentId) {
        throw new HttpException('Tournament ID is required', HttpStatus.BAD_REQUEST);
      }

      const admins = await this.tournamentsService.getTournamentAdmins(
        parseInt(tournamentId),
        user?.role
      );

      return admins;
    } catch (error) {
      console.error("GET TOURNAMENT ADMINS API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/tournaments/:id/admins - Add tournament admin
  @Post(':id/admins')
  async addTournamentAdmin(
    @Param('id') tournamentId: string,
    @Body() body: AddTournamentAdminDto,
    @CurrentUser() user: JwtPayloadDto,
  ) {
    try {
      if (!tournamentId) {
        throw new HttpException('Tournament ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.userId) {
        throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
      }

      // Check if requesting user is admin for this tournament
      const isAdmin = await this.tournamentsService.isUserAdminForTournament(
        user?.role,
        user?.id?.toString(),
        parseInt(tournamentId)
      );

      if (!isAdmin) {
        throw new HttpException('Insufficient permissions', HttpStatus.FORBIDDEN);
      }

      const result = await this.tournamentsService.addTournamentAdmin(
        parseInt(tournamentId),
        body.userId
      );

      return {
        message: 'Successfully added tournament admin',
        result
      };
    } catch (error) {
      console.error("ADD TOURNAMENT ADMIN API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // DELETE /api/tournaments/:id/admins - Remove tournament admin
  @Delete(':id/admins')
  async removeTournamentAdmin(
    @Param('id') tournamentId: string,
    @Body() body: RemoveTournamentAdminDto,
    @CurrentUser() user: JwtPayloadDto,
  ) {
    try {
      if (!tournamentId) {
        throw new HttpException('Tournament ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.userId) {
        throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
      }

      // Check if requesting user is admin for this tournament
      const isAdmin = await this.tournamentsService.isUserAdminForTournament(
        user?.role,
        user?.id?.toString(),
        parseInt(tournamentId)
      );

      if (!isAdmin) {
        throw new HttpException('Insufficient permissions', HttpStatus.FORBIDDEN);
      }

      const result = await this.tournamentsService.removeTournamentAdmin(
        parseInt(tournamentId),
        body.userId
      );

      return {
        message: 'Successfully removed tournament admin',
        result
      };
    } catch (error) {
      console.error("REMOVE TOURNAMENT ADMIN API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/tournaments/:id/waitlist - Get waitlist players for tournament
  @Get(':id/waitlist')
  async getWaitlistPlayers(@Param('id') id: string, @CurrentUser() user: JwtPayloadDto) {
    try {
      const tournamentId = Number(id);
      const userRole = user?.role || 1;
      const userId = user?.id?.toString() || '';

      const waitlistPlayers = await this.tournamentsService.getWaitlistPlayers(tournamentId, userRole, userId);
      return waitlistPlayers;
    } catch (error) {
      console.error("TOURNAMENT WAITLIST GET API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/tournaments/:id/waitlist - Add user to waitlist
  @Post(':id/waitlist')
  async addToWaitlist(@Param('id') id: string, @Body() body: { userId?: string }, @CurrentUser() user: JwtPayloadDto) {
    try {
      const tournamentId = Number(id);
      const userId = body.userId || user?.id?.toString();

      if (!userId) {
        throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
      }

      await this.tournamentsService.addToWaitlist(tournamentId, userId);

      return {
        message: 'Successfully added to waitlist',
      };
    } catch (error) {
      console.error("TOURNAMENT WAITLIST ADD API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // DELETE /api/tournaments/:id/waitlist - Remove user from waitlist
  @Delete(':id/waitlist')
  async removeFromWaitlist(@Param('id') id: string, @Body() body: { userId?: string; waitlistId?: string }, @CurrentUser() user: JwtPayloadDto) {
    try {
      const tournamentId = Number(id);
      const { userId, waitlistId } = body;

      if (waitlistId) {
        // Remove by waitlist ID (admin action)
        const result = await this.tournamentsService.removeFromWaitlistById(tournamentId, waitlistId);
        return result;
      } else {
        // Remove by user ID (self or admin action)
        const targetUserId = userId || user?.id?.toString();
        if (!targetUserId) {
          throw new HttpException('User ID or waitlist ID is required', HttpStatus.BAD_REQUEST);
        }
        const result = await this.tournamentsService.removeFromWaitlist(tournamentId, targetUserId);
        return result;
      }
    } catch (error) {
      console.error("TOURNAMENT WAITLIST REMOVE API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // PATCH /api/tournaments/:id/waitlist/toggle - Toggle waitlist for tournament
  @Patch(':id/waitlist/toggle')
  async toggleWaitlist(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadDto,
  ) {
    try {
      const tournamentId = Number(id);

      // Check if user is admin for this tournament
      const isAdmin = await this.tournamentsService.isUserAdminForTournament(
        user?.role,
        user?.id?.toString(),
        tournamentId
      );

      if (!isAdmin) {
        throw new HttpException('Insufficient permissions', HttpStatus.FORBIDDEN);
      }

      const result = await this.tournamentsService.toggleWaitlist(tournamentId);
      return {
        success: true,
        message: `Waitlist ${result.waitlist ? 'enabled' : 'disabled'} for tournament`,
        tournament: result,
      };
    } catch (error) {
      console.error("TOURNAMENT WAITLIST TOGGLE API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/tournaments/user/registered - Get user's registered tournaments
  @Get('user/registered')
  async getUserRegisteredTournaments(@CurrentUser() user: JwtPayloadDto) {
    try {
      const tournaments = await this.tournamentsService.getUserRegisteredTournaments(user.id.toString());
      return tournaments;
    } catch (error) {
      console.error("GET USER REGISTERED TOURNAMENTS API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/tournaments/user/admin - Get tournaments where user is admin
  @Get('user/admin')
  async getUserAdminTournaments(@CurrentUser() user: JwtPayloadDto) {
    try {
      const tournaments = await this.tournamentsService.getUserAdminTournaments(user.id.toString());
      return tournaments;
    } catch (error) {
      console.error("GET USER ADMIN TOURNAMENTS API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /api/tournaments/user/available-with-schedule - Get user's available tournaments with default schedule
  @Get('user/available-with-schedule')
  async getUserAvailableTournamentsWithSchedule(@CurrentUser() user: JwtPayloadDto) {
    try {
      console.log("asdadasd")
      const result = await this.tournamentsService.getUserAvailableTournamentsWithSchedule(user.id.toString());
      console.log("asdadasd", result)
      return result;
    } catch (error) {
      console.error("GET USER AVAILABLE TOURNAMENTS WITH SCHEDULE API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // PATCH /api/tournaments/status - Update tournament status
  @Patch('status')
  async updateTournamentStatus(@Body() body: UpdateTournamentStatusDto, @CurrentUser() user: JwtPayloadDto) {
    try {
      const { tournamentId, status } = body;

      if (!tournamentId || !status) {
        throw new HttpException('Tournament ID and status are required', HttpStatus.BAD_REQUEST);
      }

      // Validate status values
      const validStatuses = [2, 3, 4, 5]; // START_REGISTRATION, CLOSE_REGISTRATION, START_TOURNAMENT, CLOSE_TOURNAMENT
      if (!validStatuses.includes(status)) {
        throw new HttpException('Invalid status value. Must be 2, 3, 4, or 5', HttpStatus.BAD_REQUEST);
      }

      const result = await this.tournamentsService.updateTournamentStatus(tournamentId, status, user);
      return result;
    } catch (error) {
      console.error("UPDATE TOURNAMENT STATUS API Error:", error);
      throw new HttpException(
        error.message || 'Internal Server Error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Public()
  @Post(':id/bulk-register')
  async bulkRegisterUsers(@Param('id') tournamentId: string, @CurrentUser() user: JwtPayloadDto) {
    const id = parseInt(tournamentId);
    if (isNaN(id)) {
      throw new HttpException('Invalid tournament ID', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.tournamentsService.bulkRegisterRandomUsers(id, user);
      return {
        success: true,
        message: 'Bulk registration completed',
        ...result
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to perform bulk registration', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':id/generate-schedule')
  async generateRandomSchedule(@Param('id') tournamentId: string, @CurrentUser() user: JwtPayloadDto) {
    const id = parseInt(tournamentId);
    if (isNaN(id)) {
      throw new HttpException('Invalid tournament ID', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.tournamentsService.generateRandomSchedule(id, user);
      return {
        success: true,
        message: 'Random schedule generated successfully',
        ...result
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to generate random schedule', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('ongoing-without-schedule')
  async getOngoingTournamentsWithoutSchedule(@CurrentUser() user: JwtPayloadDto) {
    try {
      const tournaments = await this.tournamentsService.getOngoingTournamentsWithoutSchedule();
      return tournaments;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to get ongoing tournaments without schedule', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'tournaments',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Post('migrate')
  async migrateRegistrationUserIds() {
    try {
      const result = await this.tournamentsService.migrateRegistrationUserIds();
      return {
        success: true,
        message: 'Migration completed',
        ...result
      };
    } catch (error) {
      console.error("MIGRATION API Error:", error);
      throw new HttpException(
        error.message || 'Migration failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /api/tournaments/:id/create-missing-pairs - Create missing schedule pairs based on rating
  @Post(':id/create-missing-pairs')
  async createMissingSchedulePairs(
    @Param('id') tournamentId: string,
    @Body() body: { targetGamesPerPlayer?: number },
    @CurrentUser() user: JwtPayloadDto,
  ) {
    try {
      const id = parseInt(tournamentId);
      if (isNaN(id)) {
        throw new HttpException('Invalid tournament ID', HttpStatus.BAD_REQUEST);
      }

      // Check if user is admin for this tournament
      const isAdmin = await this.tournamentsService.isUserAdminForTournament(
        user?.role,
        user?.id?.toString(),
        id
      );

      if (!isAdmin) {
        throw new HttpException('Insufficient permissions', HttpStatus.FORBIDDEN);
      }

      const targetGames = body.targetGamesPerPlayer || 20;
      const result = await this.tournamentsService.createMissingSchedulePairs(id, targetGames);

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
}
