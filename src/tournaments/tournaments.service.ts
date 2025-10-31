import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TournamentDto, RegisteredPlayerDto } from './dto/tournament.dto';

@Injectable()
export class TournamentsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getTournamentsByStatus(statusArray: string[]): Promise<TournamentDto[]> {
    const filter = statusArray.length > 0
      ? {
          where: {
            status_id: {
              in: statusArray.map(Number)
            }
          },
        }
      : undefined;

    const tournaments = await this.databaseService.tournaments.findMany({
      select: {
        id: true,
        tournament_name: true,
        status_id: true,
        starting_date: true,
        description: true,
        created_at: true,
        updated_at: true,
        tournament_admins: {
          select: {
            users: {
              select: {
                id: true,
                first_name: true,
                last_name: true
              }
            }
          }
        }
      },
      ...filter,
      orderBy: {
        created_at: "desc",
      },
    });

    return tournaments.map(item => ({
      id: item.id.toString(),
      tournament_name: item.tournament_name,
      status_id: item.status_id,
      starting_date: item.starting_date,
      description: item.description,
      created_at: item.created_at,
      updated_at: item.updated_at,
      adminId: item.tournament_admins?.map(admin => admin.users.id.toString()) || [],
      adminName: item.tournament_admins?.map(admin => `${admin.users.first_name} ${admin.users.last_name}`) || []
    }));
  }

  async getTournamentsById(ids: string[]): Promise<TournamentDto[]> {
    const tournaments = await this.databaseService.tournaments.findMany({
      select: {
        id: true,
        tournament_name: true,
        status_id: true,
        description: true,
        starting_date: true,
        created_at: true,
        updated_at: true,
        tournament_admins: {
          select: {
            users: {
              select: {
                id: true,
                first_name: true,
                last_name: true
              }
            }
          }
        }
      },
      where: {
        id: {
          in: ids.map(Number),
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return tournaments.map(item => ({
      id: item.id.toString(),
      tournament_name: item.tournament_name,
      description: item.description,
      status_id: item.status_id,
      starting_date: item.starting_date,
      created_at: item.created_at,
      updated_at: item.updated_at,
      adminId: item.tournament_admins?.map(admin => admin.users.id.toString()) || [],
      adminName: item.tournament_admins?.map(admin => `${admin.users.first_name} ${admin.users.last_name}`) || []
    }));
  }

  async getRegisteredPlayers(tournamentId: number): Promise<RegisteredPlayerDto[]> {
    const registrations = await this.databaseService.tournament_registration.findMany({
      where: {
        tournamentId: tournamentId,
      },
      select: {
        id: true,
        player_email: true,
        status: true,
        created_at: true,
      }
    });

    // Get user details for each registered email
    const userEmails = registrations.map(reg => reg.player_email).filter((email): email is string => email !== null);
    const users = await this.databaseService.users.findMany({
      where: {
        email: {
          in: userEmails,
        },
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        countries: {
          select: {
            tld_code: true,
          },
        },
      },
    });

    // Combine registration data with user data
    return registrations.map(registration => {
      const user = users.find(u => u.email === registration.player_email);
      return {
        registrationId: registration.id,
        email: registration.player_email || '',
        status: registration.status || '',
        registeredAt: registration.created_at || new Date(),
        userId: user?.id?.toString(),
        name: user ? `${user.first_name} ${user.last_name}` : 'Unknown User',
        countryCode: user?.countries?.tld_code,
      };
    });
  }

  async createTournament(tournamentData: any): Promise<TournamentDto> {
    // This will be implemented to call the existing addTournament function
    return {} as TournamentDto;
  }

  async updateTournament(id: number, status: number): Promise<TournamentDto> {
    // This will be implemented to call the existing updateTournament function
    return {} as TournamentDto;
  }

  async updateTournamentFull(id: number, updateData: any): Promise<TournamentDto> {
    // This will be implemented to call the existing updateTournamentFull function
    return {} as TournamentDto;
  }

  async registerForTournament(tournamentId: number, userEmail: string): Promise<any> {
    // This will be implemented to call the existing registerTournament function
    return {};
  }

  async deleteTournament(id: string): Promise<{ id: string }> {
    // This will be implemented to call the existing removeTournament function
    return { id };
  }
}
