import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  ScheduleDto,
  ValidateScheduleDto,
  ScheduleValidationResult,
  ScheduleUpdateResult,
  ScheduleListResponse,
  UploadCsvScheduleDto,
} from './dto/schedule.dto';
import { TournamentDto } from 'src/tournaments/dto/tournament.dto';

@Injectable()
export class ScheduleService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getSchedules({
    userId,
    tournament,
    page,
    pageSize,
    adminView,
    onlyPending,
    noOpponent,
    orderBy,
    orderDirection
  }: {
    userId?: number;
    tournament?: string[] | undefined;
    page: number;
    pageSize: number;
    adminView: boolean;
    onlyPending?: boolean;
    noOpponent?: boolean;
    orderBy?: string;
    orderDirection?: string;
  }): Promise<ScheduleListResponse> {
    pageSize = pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {
      AND: []
    };

    // Add tournament filter if provided
    if (tournament && tournament.length > 0) {
      where.AND.push({
        tournaments_id: { in: tournament.map(t => Number(t)) }
      });
    }
    // Add user filter if not admin view or if specific user is requested
    if (!adminView && userId) {
      where.AND.push({
        OR: [
          { usa_player_id: userId },
          { ussr_player_id: userId },
        ],
      });
    }

    // Add pending games filter (games without results)
    // if (onlyPending) {
      where.AND.push({
        game_results_id: null
      });
    // }

    if (noOpponent) {
      where.AND.push({
        OR: [
          { usa_player_id: null },
          { ussr_player_id: null },
        ],
      });
    }

    // Build dynamic orderBy based on parameters
    const prismaOrderBy: any = [];

    // Map orderBy field to database field
    const orderByFieldMap = {
      'dueDate': 'due_date',
      'gameDate': { game_results: { game_date: orderDirection || 'asc' } },
      'tournamentName': { tournaments: { tournament_name: orderDirection || 'asc' } }
    };

    if (orderBy && orderByFieldMap[orderBy]) {
      if (orderBy === 'dueDate') {
        prismaOrderBy.push({
          [orderByFieldMap[orderBy]]: orderDirection || 'asc'
        });
      } else {
        prismaOrderBy.push(orderByFieldMap[orderBy]);
      }
    } else {
      // Default ordering
      if (!adminView) {
        prismaOrderBy.push({
          game_results_id: 'asc',
        });
      }
      prismaOrderBy.push({
        due_date: 'asc',
      });
    }
    prismaOrderBy.push({
      id: 'asc',
    });
    const totalRows = await this.databaseService.schedule.count({
      where: where.AND.length > 0 ? where : undefined,
    });

    const scheduleResults = await this.databaseService.schedule.findMany({
      select: {
        game_results: {
          select: {
            game_winner: true,
            game_date: true,
          }
        },
        game_code: true,
        id: true,
        game_results_id: true,
        due_date: true,
        random_sides: true,
        best_of: true,
        tournaments: {
          select: {
            tournament_name: true,
            id: true,
          },
        },
        users_schedule_usa_player_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            countries: {
              select: {
                tld_code: true,
              },
            },
          },
        },
        users_schedule_ussr_player_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            countries: {
              select: {
                tld_code: true,
              },
            },
          },
        },
      },
      orderBy: prismaOrderBy,
      where: where.AND.length > 0 ? where : undefined,
      skip,
      take: pageSize,
    });

    const results: ScheduleDto[] = scheduleResults.map(result => ({
      gameWinner: result.game_results?.game_winner || null,
      gameDate: result.game_results?.game_date?.toISOString() || null,
      dueDate: result.due_date.toISOString(),
      gameCode: result.game_code,
      randomSides: result.random_sides,
      bestOf: result.best_of,
      id: result.id.toString(),
      gameResultsId: result.game_results_id?.toString() || null,
      nameUsa: `${result.users_schedule_usa_player_idTousers?.first_name || ''} ${result.users_schedule_usa_player_idTousers?.last_name || ''}`,
      nameUssr: `${result.users_schedule_ussr_player_idTousers?.first_name || ''} ${result.users_schedule_ussr_player_idTousers?.last_name || ''}`,
      idUsa: result.users_schedule_usa_player_idTousers?.id?.toString() || '',
      countryUsa: result.users_schedule_usa_player_idTousers?.countries?.tld_code || null,
      countryUssr: result.users_schedule_ussr_player_idTousers?.countries?.tld_code || null,
      idUssr: result.users_schedule_ussr_player_idTousers?.id?.toString() || '',
      tournamentName: result.tournaments.tournament_name,
      tournamentId: result.tournaments.id.toString()
    }));

    const totalPages = Math.ceil(totalRows / pageSize);

    return {
      results,
      totalRows,
      currentPage: page,
      totalPages
    };
  }

  async filterTournamentsBySchedule(tournaments: TournamentDto[], userId: number) {
    if (!tournaments.length) {
      return [];
    }
  
    const where: any = {
      AND: []
    };
    where.AND.push({
      OR: [
        { usa_player_id: userId },
        { ussr_player_id: userId },
      ],
    });
    const tournamentIds = tournaments.map((t) => Number(t.id));

    if (tournamentIds.includes(318)) {
      tournamentIds.push(345)
      tournamentIds.push(346)
      tournamentIds.push(347)
      tournamentIds.push(348)
    }

    where.AND.push({
      tournaments_id: {
        in: tournamentIds,
      },
    })
    where.AND.push({
      game_results_id: null
    })
    
    const schedules = await this.databaseService.schedule.findMany({
      where,
      select: {
        tournaments_id: true,
      },
      distinct: ['tournaments_id'],
    });

    const scheduledTournamentIds = new Set(
      schedules.map(s => s.tournaments_id),
    );
    const filteredTournaments = tournaments.filter(t => {
      if (t.id === "318") {
        if (scheduledTournamentIds.has(345)) return true
        if (scheduledTournamentIds.has(346)) return true
        if (scheduledTournamentIds.has(347)) return true
        if (scheduledTournamentIds.has(348)) return true
      }
      return scheduledTournamentIds.has(Number(t.id))
    }
    );


    return filteredTournaments
  }
  
  async validateScheduleIntegrity({
    usaPlayerId,
    id,
    ussrPlayerId,
    gameCode,
    tournamentId
  }: ValidateScheduleDto): Promise<ScheduleValidationResult | null> {
    const schedule = await this.databaseService.schedule.findFirst({
      select: {
        game_results_id: true,
        id: true,
      },
      where: {
        id: id,
        usa_player_id: BigInt(usaPlayerId),
        ussr_player_id: BigInt(ussrPlayerId),
        game_code: gameCode,
        tournaments_id: tournamentId,
      }
    });

    return schedule;
  }

  async updateSchedule({
    gameResultId,
    scheduleId,
    dueDate
  }: {
    gameResultId?: number;
    scheduleId: number;
    dueDate?: Date;
  }): Promise<ScheduleUpdateResult> {
    const updateData: any = {};
    
    if (gameResultId !== undefined) {
      updateData.game_results_id = gameResultId;
    }
    
    if (dueDate !== undefined) {
      updateData.due_date = dueDate;
    }

    const updated = await this.databaseService.schedule.update({
      data: updateData,
      where: {
        id: scheduleId
      }
    });

    return {
      ...updated,
      usa_player_id: updated.usa_player_id?.toString(),
      ussr_player_id: updated.ussr_player_id?.toString(),
    };
  }

  generateCode(length: number = 4): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      result += chars[randomIndex];
    }

    return result.toUpperCase();
  }

  async addSchedulePlayers(
    usa: string,
    ussr: string,
    t: number,
    d: Date,
    gc: string,
    bo: number | null,
    randomSides?: boolean,
  ): Promise<ScheduleUpdateResult> {
    // check the schedule does not exist already
    const existingSchedule = await this.databaseService.schedule.findFirst({
      where: {
        tournaments_id: t,
        usa_player_id: BigInt(usa),
        ussr_player_id: BigInt(ussr),
      }
    });
    if (existingSchedule) {
      throw new Error('Schedule already exists');
    } 
    const schedule = await this.databaseService.schedule.create({
      data: {
        tournaments_id: t,
        game_code: gc,
        usa_player_id: BigInt(usa),
        ussr_player_id: BigInt(ussr),
        due_date: d,
        random_sides: randomSides,
        best_of: Number(bo)
      }
    });
    return {
      ...schedule,
      usa_player_id: schedule.usa_player_id?.toString(),
      ussr_player_id: schedule.ussr_player_id?.toString(),
    }
  }

  async replaceSchedulePlayers(
    oldPlayer: string,
    newPlayer: string,
    tournamentId: number
  ): Promise<any> {
    const updatedUSA = await this.databaseService.schedule.updateMany({
      data: {
        usa_player_id: BigInt(newPlayer),
      },
      where: {
        OR: [
          { usa_player_id: BigInt(oldPlayer) },
        ],
        tournaments_id: tournamentId,
        game_results_id: null
      }
    });

    const updatedUSSR = await this.databaseService.schedule.updateMany({
      data: {
        ussr_player_id: BigInt(newPlayer),
      },
      where: {
        ussr_player_id: BigInt(oldPlayer),
        tournaments_id: tournamentId,
        game_results_id: null
      }
    });

    const updatedStandings = await this.databaseService.standing_players.updateMany({
      data: {
        user_id: BigInt(newPlayer),
      },
      where: {
        user_id: BigInt(oldPlayer),
        standings: {
          tournaments_id: tournamentId,
        },
      },
    });

    return { updatedUSA, updatedUSSR, updatedStandings };
  }

  async deleteSchedulePlayer(playerId: number, tournamentId: number): Promise<any> {
    const updatedUSA = await this.databaseService.schedule.updateMany({
      where: {
        tournaments_id: tournamentId,
        usa_player_id: playerId,
      },
      data: {
        usa_player_id: null,
      },
    });

    const updatedUSSR = await this.databaseService.schedule.updateMany({
      where: {
        tournaments_id: tournamentId,
        ussr_player_id: playerId,
      },
      data: {
        ussr_player_id: null,
      },
    });

    return { updatedUSA, updatedUSSR };
  }

  async uploadCsvSchedule(data: UploadCsvScheduleDto): Promise<{ created: number; errors: string[] }> {
    const { file, tournament } = data;
    const tournamentId = parseInt(tournament);

    const scheduleData = file.map((row) => ({
      due_date: new Date(row.due_date),
      game_code: row.game_code,
      tournaments_id: tournamentId,
      usa_player_id: BigInt(row.usa_player_id),
      ussr_player_id: BigInt(row.ussr_player_id),
      random_sides: row.random ? Boolean(Number(row.random)) : false
    }));

    // Bulk insert all records at once
    const result = await this.databaseService.schedule.createMany({
      data: scheduleData,
    });

    return { created: result.count, errors: [] };
  }

  async deleteSchedule(scheduleId: number): Promise<{ success: boolean }> {
    const schedule = await this.databaseService.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new Error(`Schedule with ID ${scheduleId} not found`);
    }

    // Delete the schedule
    await this.databaseService.schedule.delete({
      where: { id: scheduleId },
    });

    return { success: true };
  }

  findFullNameById(id: bigint, registeredPlayers: any[]) {
    const player = registeredPlayers.find(p => p.users.id === id);
    return player ? `${player.users.first_name} ${player.users.last_name}` : 'Unknown Player';
  }

  async getPlayersWithMissingGames(tournamentId: number, targetGamesPerPlayer: number = 20): Promise<any> {
    // 1. Get all registered players for the tournament
    // het first nameand last name from users table
    const registeredPlayers = await this.databaseService.tournament_registration.findMany({
      select: {
        status: true,
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          }
        },
      },
      where: { tournamentId },
    });

    if (registeredPlayers.length < 2) {
      throw new Error('Not enough registered players');
    }

    // 2. Get current schedule counts for each player
    const schedules = await this.databaseService.schedule.findMany({
      where: {
        tournaments_id: tournamentId,
      },
      select: {
        id: true,
        usa_player_id: true,
        ussr_player_id: true,
        game_results_id: true,
        game_code: true,
      }
    });

    // find the registered players with status forfeited
    const forfeitedPlayers = registeredPlayers.filter(p => p.status === 'forfeited');
    const activePlayers = registeredPlayers.filter(p => p.status !== 'forfeited');

    // find players ids who have not a single schedule comparing schedules with registeredplayers
    const playersWithoutSchedule = registeredPlayers.filter(p => {
      return !schedules.find(sch => sch.usa_player_id === p.users.id || sch.ussr_player_id === p.users.id);
    });

    // set to null the ids from schedules locally where the player is in the forfeitedPlayers array
    const schedulesWithMissingOpponent: Array<{
      id: number;
      existingPlayerId: bigint;
      isUSA: boolean;
    }> = [];
    const playerGameCount = new Map<string, number>();

    for (const player of registeredPlayers) {
      playerGameCount.set(player.users.id.toString(), 0);
    }

    for (const player of forfeitedPlayers) { 
      for (let schedule of schedules) {
        if (schedule.game_results_id !== null) continue;

        if (schedule.usa_player_id === player.users.id) {
          schedule.usa_player_id = null;
          schedulesWithMissingOpponent.push({
            id: schedule.id,
            existingPlayerId: schedule.usa_player_id,
            isUSA: true
          });
        }
        if (schedule.ussr_player_id === player.users.id) {
          schedule.ussr_player_id = null;
          schedulesWithMissingOpponent.push({
            id: schedule.id,
            existingPlayerId: schedule.ussr_player_id,
            isUSA: false
          });
        }
      }
    }

    const gameCodes: string[] = []
    for (const schedule of schedules) {
      const usaId = schedule.usa_player_id?.toString();
      const ussrId = schedule.ussr_player_id?.toString();

      // hack to compensate for DDB errors leading to inconsistent shcedule data
      if (schedule.game_results_id !== null && ((!usaId && ussrId) || (usaId && !ussrId))) {
        if (usaId) {
          playerGameCount.set(usaId, (playerGameCount.get(usaId) || 0) + 1);
        }
        if (ussrId) {
          playerGameCount.set(ussrId, (playerGameCount.get(ussrId) || 0) + 1);
        }
      }

      if (ussrId && usaId && playerGameCount.has(usaId)) {
        playerGameCount.set(usaId, (playerGameCount.get(usaId) || 0) + 1);
      }
      if (ussrId && usaId && playerGameCount.has(ussrId)) {
        playerGameCount.set(ussrId, (playerGameCount.get(ussrId) || 0) + 1);
      }

      if (schedule.game_results_id === null && ((!usaId && ussrId) || (usaId && !ussrId))) {
        !gameCodes.includes(schedule.game_code) && gameCodes.push(schedule.game_code);
      }
    }

    // 3. Get ratings for all players
    const playerRatings = new Map<string, number>();
    for (const player of activePlayers) {
      const ratingRecord = await this.databaseService.ratings_history.findFirst({
        where: { player_id: player.users.id },
        orderBy: { created_at: 'desc' },
        select: { rating: true }  
      });
      playerRatings.set(player.users.id.toString(), ratingRecord?.rating || 1500);
    }

    // 4. Find players who need more games
    const playersNeedingGames: Array<{ id: bigint; fullName: string; gamesNeeded: number; rating: number }> = [];
    for (const player of activePlayers) {
      const currentGames = playerGameCount.get(player.users.id.toString()) || 0;
      if (currentGames < targetGamesPerPlayer) {
        playersNeedingGames.push({
          id: player.users.id,
          fullName: this.findFullNameById(player.users.id, registeredPlayers),
          gamesNeeded: targetGamesPerPlayer - currentGames,
          rating: playerRatings.get(player.users.id.toString()) || 1500
        });
      }
    }

    // Sort by rating for pairing
    playersNeedingGames.sort((a, b) => a.rating - b.rating);

    // remove Otto Wefer from playersNeedingGames if he exists
    const playersNeedingGamesFiltered = playersNeedingGames// .filter(p => p.fullName !== 'Otto Wefer' || 'Alejandro Granese');

    const suggestedPairings = []
    // 5. Suggest pairings
    for (const player of playersNeedingGamesFiltered) {
      // if player exists in suggestedPairings, skip
        if (suggestedPairings.find(p => p.player1 === player.fullName || p.player2 === player.fullName)) continue;

      for (const otherPlayer of playersNeedingGamesFiltered) {
        if (player.id === otherPlayer.id) continue;
        if (suggestedPairings.find(p => p.player1 === otherPlayer.fullName || p.player2 === otherPlayer.fullName)) continue;

        const existingSchedule = await this.databaseService.schedule.findFirst({
          where: {
            tournaments_id: 318,
            OR: [
              {
                usa_player_id: BigInt(player.id),
                ussr_player_id: BigInt(otherPlayer.id),
              },
              {
                usa_player_id: BigInt(otherPlayer.id),
                ussr_player_id: BigInt(player.id),
              },
            ],
          },
        });
        
        if (!existingSchedule) {
          suggestedPairings.push({
            player1: player.fullName,
            player2: otherPlayer.fullName,
          });
          // console.log(`SUGGESTED PAIRING: ${player.fullName} vs ${otherPlayer.fullName}`);
          break;
        }

      }
    }

    let schedulesUpdated = 0;
    let schedulesCreated = 0;
    const errors: string[] = [];
    console.log("suggestedPairings", suggestedPairings);
     console.log("gameCodes", gameCodes);

    // create a schedule for each suggested pairing, the game code should be random 4 char string, starting by J
    for (const pairing of suggestedPairings) {
      const gameCode = `J${Math.random().toString(36).substring(2, 6)}`;
      const usaPlayer = playersNeedingGamesFiltered.find(p => p.fullName === pairing.player1);
      const ussrPlayer = playersNeedingGamesFiltered.find(p => p.fullName === pairing.player2);
      // date Apr 1st
      const dueDate = new Date('2025-04-02');
      // await this.databaseService.schedule.create({
      //   data: {
      //     tournaments_id: 318,
      //     game_code: gameCode,
      //     usa_player_id: BigInt(usaPlayer.id),
      //     ussr_player_id: BigInt(ussrPlayer.id),
      //     due_date: dueDate,
      //   }
      // });
      schedulesCreated++;
    }
   
 console.log("schedulesCreated", schedulesCreated, playersNeedingGamesFiltered);
      // remove all schedules with the game code in the array, except 'Otto Wefer'
    const scheduleIds = await this.databaseService.schedule.findMany({
      where: {
        game_code: {
          in: gameCodes,
        },
        tournaments_id: 318,
      },
      select: {
        id: true,
      }
    });

    const filteredScheduleIds = scheduleIds.filter(s => s.id !== 8947);
  console.log("scheduleIds", filteredScheduleIds);
    // const deleted = await this.databaseService.schedule.deleteMany({
    //   where: {
    //     id: {
    //       in: filteredScheduleIds.map(s => s.id),
    //     }
    //   },
    // });
    // console.log("deleted", deleted);
  }
}
