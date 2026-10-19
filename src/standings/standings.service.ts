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
  secondaryName: string | null;
  standingOrder: number;
  playoffOrder: number;
}

type StandingPlayersType = Record<string, StandingPlayer>;

// h2hMap[aId][bId] = number of wins aId has against bId
type H2HMap = Record<string, Record<string, number>>;

@Injectable()
export class StandingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  private buildH2HMap(games: { usa_player_id: bigint; ussr_player_id: bigint; game_winner: string | null }[]): H2HMap {
    const h2h: H2HMap = {};
    for (const game of games) {
      const usaId = game.usa_player_id.toString();
      const ussrId = game.ussr_player_id.toString();
      if (!h2h[usaId]) h2h[usaId] = {};
      if (!h2h[ussrId]) h2h[ussrId] = {};
      if (game.game_winner === '1') {
        h2h[usaId][ussrId] = (h2h[usaId][ussrId] || 0) + 1;
      } else if (game.game_winner === '2') {
        h2h[ussrId][usaId] = (h2h[ussrId][usaId] || 0) + 1;
      }
    }
    return h2h;
  }

  private comparePlayers(a: StandingPlayer, b: StandingPlayer, h2h: H2HMap): number {
    // Primary: winRate desc
    if (b.winRate !== a.winRate) {
      return b.winRate - a.winRate;
    }
    // Tiebreaker: H2H → winRate → sos
    const aBeatsB = h2h[a.userId]?.[b.userId] || 0;
    const bBeatsA = h2h[b.userId]?.[a.userId] || 0;
    if (aBeatsB !== bBeatsA) {
      console.log(`[Standings] H2H tiebreaker: ${a.name} vs ${b.name} — H2H: ${aBeatsB}-${bBeatsA}, sos: ${a.sos.toFixed(4)}-${b.sos.toFixed(4)}`);
      return bBeatsA - aBeatsB;
    }
    // winRate already equal, so next is sos
    console.log(`[Standings] SoS tiebreaker: ${a.name} vs ${b.name} — H2H: ${aBeatsB}-${bBeatsA} (tied), sos: ${a.sos.toFixed(4)}-${b.sos.toFixed(4)}`);
    return b.sos - a.sos;
  }

  private comparePlayersPlayoff(a: StandingPlayer, b: StandingPlayer, h2h: H2HMap): number {
    // Playoff order: winRate → H2H → sos
    if (b.winRate !== a.winRate) {
      return b.winRate - a.winRate;
    }
    const aBeatsB = h2h[a.userId]?.[b.userId] || 0;
    const bBeatsA = h2h[b.userId]?.[a.userId] || 0;
    if (aBeatsB !== bBeatsA) {
      console.log(`[Playoff] H2H tiebreaker: ${a.name} vs ${b.name} — H2H: ${aBeatsB}-${bBeatsA}, sos: ${a.sos.toFixed(4)}-${b.sos.toFixed(4)}`);
      return bBeatsA - aBeatsB;
    }
    // console.log(`[Playoff] SoS tiebreaker: ${a.name} vs ${b.name} — H2H: ${aBeatsB}-${bBeatsA} (tied), sos: ${a.sos.toFixed(4)}-${b.sos.toFixed(4)}`);
    return b.sos - a.sos;
  }

  async getStandings(tournamentId: string, division?: string): Promise<PlayerStandingDto[]> {
    const prisma = this.databaseService;

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
      },
    });

    const players: StandingPlayersType = {};

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
          standingOrder: 0,
          playoffOrder: 0,
          tldCode: user?.countries?.tld_code,
          name: user ? `${user.first_name} ${user.last_name}` : '',
          opponents: [],
        };
      });
    });

    if (!standingPlayers || standingPlayers.length === 0) {
      return [];
    }

    const games = await prisma.game_results.findMany({
      where: { tournament_id: Number(tournamentId) },
    });

    const h2h = this.buildH2HMap(games);

    for (const game of games) {
      const usaId = game.usa_player_id.toString();
      const ussrId = game.ussr_player_id.toString();

      if (!players[usaId]) {
        const forfeitUser = await prisma.users.findFirst({
          select: { first_name: true, last_name: true, countries: { select: { tld_code: true } } },
          where: { id: Number(usaId) },
        });
        players[usaId] = {
          userId: usaId,
          standingName: 'Forfeit',
          secondaryName: 'Forfeit',
          gamesWon: 0,
          gamesLost: 0,
          gamesTied: 0,
          winRate: 0,
          sos: 0,
          standingOrder: 0,
          playoffOrder: 0,
          tldCode: forfeitUser?.countries?.tld_code,
          name: `${forfeitUser?.first_name} ${forfeitUser?.last_name}`,
          opponents: [],
        };
      }
      if (!players[ussrId]) {
        const forfeitUser = await prisma.users.findFirst({
          select: { first_name: true, last_name: true, countries: { select: { tld_code: true } } },
          where: { id: Number(usaId) },
        });
        players[ussrId] = {
          userId: ussrId,
          standingName: 'Forfeit',
          secondaryName: 'Forfeit',
          gamesWon: 0,
          gamesLost: 0,
          gamesTied: 0,
          winRate: 0,
          sos: 0,
          standingOrder: 0,
          playoffOrder: 0,
          tldCode: forfeitUser?.countries?.tld_code,
          name: `${forfeitUser?.first_name} ${forfeitUser?.last_name}`,
          opponents: [],
        };
      }

      players[usaId].opponents.push(ussrId);
      players[ussrId].opponents.push(usaId);

      switch (game.game_winner) {
        case '1':
          players[usaId].gamesWon++;
          players[ussrId].gamesLost++;
          break;
        case '2':
          players[ussrId].gamesWon++;
          players[usaId].gamesLost++;
          break;
        case '3':
          players[usaId].gamesTied++;
          players[ussrId].gamesTied++;
          break;
      }
    }

    // Calculate win rates
    Object.keys(players).forEach(id => {
      const p = players[id];
      const total = p.gamesWon + p.gamesLost + p.gamesTied;
      if (total === 0) return;
      p.winRate = (p.gamesWon + 0.5 * p.gamesTied) / total;
    });

    // Calculate Strength of Schedule
    Object.keys(players).forEach(id => {
      const opponents = players[id].opponents;
      if (opponents.length === 0) return;
      players[id].sos = opponents.reduce((acc, opp) => acc + players[opp].winRate, 0) / opponents.length;
    });

    // Filter out forfeit players and apply division filter
    const filteredPlayers = Object.values(players).filter(
      p => p.secondaryName !== 'Forfeit' && (division ? p.secondaryName === division : true),
    );

    // Group by (standingName, secondaryName)
    const standingGroups: Record<string, StandingPlayer[]> = {};
    for (const p of filteredPlayers) {
      const key = `${p.standingName}|||${p.secondaryName || ''}`;
      if (!standingGroups[key]) standingGroups[key] = [];
      standingGroups[key].push(p);
    }

    // Sort within each standing group: winRate → H2H → sos, assign standingOrder
    const cmp = (a: StandingPlayer, b: StandingPlayer) =>
      this.comparePlayers(a, b, h2h);

    for (const group of Object.values(standingGroups)) {
      group.sort(cmp);
      group.forEach((p, i) => {
        p.standingOrder = i + 1;
      });
    }

    // Calculate playoff order per secondaryName
    const bySecondary: Record<string, StandingPlayer[]> = {};
    for (const p of filteredPlayers) {
      const sec = p.secondaryName || '';
      if (!bySecondary[sec]) bySecondary[sec] = [];
      bySecondary[sec].push(p);
    }

    for (const secPlayers of Object.values(bySecondary)) {
      // First-place players (standingOrder === 1) from each standing
      const firstPlace: StandingPlayer[] = [];
      const rest: StandingPlayer[] = [];

      for (const p of secPlayers) {
        if (p.standingOrder === 1) {
          firstPlace.push(p);
        } else {
          rest.push(p);
        }
      }

      const playoffCmp = (a: StandingPlayer, b: StandingPlayer) =>
        this.comparePlayersPlayoff(a, b, h2h);

      firstPlace.sort(playoffCmp);
      rest.sort(playoffCmp);

      const ordered = [...firstPlace, ...rest];
      ordered.forEach((p, i) => {
        p.playoffOrder = i + 1;
      });
    }

    // Return sorted by secondaryName, then standingName, then standingOrder
    filteredPlayers.sort((a, b) => {
      const secCmp = (a.secondaryName || '').localeCompare(b.secondaryName || '');
      if (secCmp !== 0) return secCmp;
      const standCmp = a.standingName.localeCompare(b.standingName);
      if (standCmp !== 0) return standCmp;
      return a.standingOrder - b.standingOrder;
    });

    return filteredPlayers.map(p => ({
      userId: p.userId,
      name: p.name,
      secondaryName: p.secondaryName || undefined,
      standingName: p.standingName,
      tldCode: p.tldCode || '',
      gamesWon: p.gamesWon,
      gamesLost: p.gamesLost,
      gamesTied: p.gamesTied,
      winRate: p.winRate,
      sos: p.sos,
      standingOrder: p.standingOrder,
      playoffOrder: p.playoffOrder,
    }));
  }
}
