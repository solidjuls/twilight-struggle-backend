import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { GetTournamentsQueryDto, TournamentDto, RegisteredPlayerDto } from './dto/tournament.dto';
import { Public } from '../auth/decorators/auth.decorators';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  async getTournaments(@Query() query: GetTournamentsQueryDto) {
    try {
      const { id, status, players } = query;

      // Get registered players for a tournament
      if (typeof id === "string" && players === "true") {
        const registeredPlayers: RegisteredPlayerDto[] = await this.tournamentsService.getRegisteredPlayers(Number(id));
        return registeredPlayers;
      }

      // Get tournaments by ID(s)
      if (typeof id === "string") {
        console.log("(userId, tournamentId) ", id);
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

  @Public()
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'tournaments',
      timestamp: new Date().toISOString(),
    };
  }
}
