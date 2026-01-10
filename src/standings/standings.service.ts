import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PlayerStandingDto } from './dto/standings.dto';

type StandingPlayer = {
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
  playoffOrder: number;
}

type StandingPlayersType = Record<string, StandingPlayer>

@Injectable()
export class StandingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getHeadToHeadGameResults(usaId: string, ussrId: string, tournamentId: string) {
    return await this.databaseService.game_results.findMany({
      where: {
        tournament_id: Number(tournamentId),
        OR: [
          {
            usa_player_id: BigInt(usaId),
            ussr_player_id: BigInt(ussrId),
          },
          {
            usa_player_id: BigInt(ussrId),
            ussr_player_id: BigInt(usaId),
          },
        ],
      },
    });
  }

  async sortPlayersBySoS(a: StandingPlayer, b: StandingPlayer, tournamentId: string) {
    // If sos is equal, check head to head
    if (b.sos === a.sos) {
      console.log("checking head to head...")
      const H2HGames = await this.getHeadToHeadGameResults(a.userId, b.userId, tournamentId);
      console.log("H2HGames", H2HGames)
    }

    return b.sos - a.sos;
  }

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

    const players: StandingPlayersType = {};

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
          playoffOrder: 0,
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

      if (!players[usaId]) {
        const forfeitUser = await prisma.users.findFirst({
          select: {
            first_name: true,
            last_name: true,
            countries: {
              select: {
                tld_code: true,
              },
            },
          },
          where: {
            id: Number(usaId),
          },
        });
        players[usaId] = {
          userId: usaId,
          standingName: "Forfeit",
          secondaryName: "Forfeit",
          gamesWon: 0,
          gamesLost: 0,
          gamesTied: 0,
          winRate: 0,
          sos: 0,
          playoffOrder: 0,
          tldCode: forfeitUser?.countries?.tld_code,
          name: `${forfeitUser?.first_name} ${forfeitUser?.last_name}`,
          opponents: [],
        };
      }
      if (!players[ussrId]) {
        const forfeitUser = await prisma.users.findFirst({
          select: {
            first_name: true,
            last_name: true,
            countries: {
              select: {
                tld_code: true,
              },
            },
          },
          where: {
            id: Number(usaId),
          },
        });
        players[ussrId] = {
          userId: ussrId,
          standingName: "Forfeit",
          secondaryName: "Forfeit",
          gamesWon: 0,
          gamesLost: 0,
          gamesTied: 0,
          winRate: 0,
          sos: 0,
          playoffOrder: 0,
          tldCode: forfeitUser?.countries?.tld_code,
          name: `${forfeitUser?.first_name} ${forfeitUser?.last_name}`,
          opponents: [],
        };
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
      // round winrate
      players[id].winRate = players[id].winRate// Math.round((players[id].winRate + Number.EPSILON) * 10) / 10;
    });

    // Calculate Strength of Schedule (SoS)
    Object.keys(players).forEach(id => {
      const opponents = players[id].opponents;
      if (opponents.length === 0) {
        return;
      }
      // players[id].sos = Math.round((opponents.reduce((acc, opponent) => acc + players[opponent].winRate, 0) / opponents.length+ Number.EPSILON) * 10) / 10;
      players[id].sos = opponents.reduce((acc, opponent) => acc + players[opponent].winRate, 0) / opponents.length;
    });

    // WE START CALCULATING PLAYOFFS
    // Filter by division 
    const filteredPlayersByDivision = Object.values(players).filter(player => 
      division ? player.secondaryName === division : true
    );

    // Sort players by SoS
    // const sortedPlayersBySos = Object.values(players).sort((a, b) => this.sortPlayersBySoS(a,b,tournamentId));
    
    // Sort players by Win Rate and then by SoS
    const sortedPlayersByWinRate = filteredPlayersByDivision.sort((a, b) => {
      console.log("comparing", a.name, b.name, a.winRate, b.winRate, a.sos, b.sos);
      if (b.winRate === a.winRate) {
        return b.sos - a.sos;
      }
      return b.winRate - a.winRate;
    });

    // Assign playoff order
    sortedPlayersByWinRate.forEach((player, index) => {
      player.playoffOrder = index + 1;
    });

    // Convert to DTO format
    return sortedPlayersByWinRate.map(player => ({
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
      playoffOrder: player.playoffOrder,
    }));
  }
}
