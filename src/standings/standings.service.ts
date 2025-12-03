import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PlayerStandingDto } from './dto/standings.dto';

@Injectable()
export class StandingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getStandings(tournamentId: string, division?: string): Promise<PlayerStandingDto[]> {
    const prisma = this.databaseService;

    // Get standing players with user details in a single query
    const standingPlayers = await prisma.standings.findMany({
      where: {
        tournaments_id: Number(tournamentId),
      },
      select: {
        standing_players: {
          select: {
            user_id: true,
            users: {
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
        },
        standing_name: true,
        secondary_name: true,
      }
    });

    const players: Record<
      string,
      {
        userId: string;
        tldCode: string | undefined;
        opponents: string[];
        name: string;
        gamesWon: number;
        gamesLost: number;
        gamesTied: number;
        winRate: number;
        sos: number;
        standingName: string;
        secondaryName: string | null
      }
    > = {};

    // Initialize players data structure with user details
    standingPlayers?.forEach(userByStanding => {
      userByStanding.standing_players.forEach(standingPlayer => {
        const id = standingPlayer.user_id.toString();
        const user = standingPlayer.users;

        players[id] = {
          userId: id,
          standingName: userByStanding.standing_name,
          secondaryName: userByStanding.secondary_name,
          gamesWon: 0,
          gamesLost: 0,
          gamesTied: 0,
          winRate: 0,
          sos: 0,
          tldCode: user?.countries?.tld_code,
          name: user ? `${user.first_name} ${user.last_name}` : "",
          opponents: [],
        };
      });
    });

    if (!standingPlayers || standingPlayers.length === 0) {
      return [];
    }

    // Get all game results for the tournament
    const games = await prisma.game_results.findMany({
      where: { tournament_id: Number(tournamentId) },
    });

    // Process game results to calculate wins, losses, ties
    for (const game of games) {
      const usaId = game.usa_player_id.toString();
      const ussrId = game.ussr_player_id.toString();

      if (!players[usaId] || !players[ussrId]) {
        continue;
      }
      
      // Track opponents for SoS calculation
      players[usaId].opponents.push(ussrId);
      players[ussrId].opponents.push(usaId);

      switch (game.game_winner) {
        case "1":
          players[usaId].gamesWon++;
          players[ussrId].gamesLost++;
          break;
        case "2":
          players[ussrId].gamesWon++;
          players[usaId].gamesLost++;
          break;
        case "3":
          players[usaId].gamesTied++;
          players[ussrId].gamesTied++;
          break;
      }
    }

    // Calculate win rates
    Object.keys(players).forEach(id => {
      const gamesWon = players[id].gamesWon;
      const gamesLost = players[id].gamesLost;
      const gamesTied = players[id].gamesTied;
      if (gamesWon + gamesLost + gamesTied === 0) {
        return;
      }
      players[id].winRate = (gamesWon + (0.5 * gamesTied)) / (gamesWon + gamesLost + gamesTied);
    });

    // Calculate Strength of Schedule (SoS)
    Object.keys(players).forEach(id => {
      const opponents = players[id].opponents;
      if (opponents.length === 0) {
        return;
      }
      players[id].sos = opponents.reduce((acc, opponent) => acc + players[opponent].winRate, 0) / opponents.length;
    });

    // Filter by division if specified
    const filteredPlayers = Object.values(players).filter(player => 
      division ? player.secondaryName === division : true
    );

    // Convert to DTO format
    return filteredPlayers.map(player => ({
      userId: player.userId,
      name: player.name,
      secondaryName: player.secondaryName || undefined,
      standingName: player.standingName,
      tldCode: player.tldCode || '',
      gamesWon: player.gamesWon,
      gamesLost: player.gamesLost,
      gamesTied: player.gamesTied,
      winRate: player.winRate,
      sos: player.sos,
    }));
  }
}
