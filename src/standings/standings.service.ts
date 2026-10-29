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
    // Tiebreaker: H2H → sos (only for first position)
    const aBeatsB = h2h[a.userId]?.[b.userId] || 0;
    const bBeatsA = h2h[b.userId]?.[a.userId] || 0;
    if (aBeatsB !== bBeatsA) {
      return bBeatsA - aBeatsB;
    }
    // winRate already equal, so next is sos
    return b.sos - a.sos;
  }

  private comparePlayersNoH2H(a: StandingPlayer, b: StandingPlayer): number {
    // winRate → sos (no H2H)
    if (b.winRate !== a.winRate) {
      return b.winRate - a.winRate;
    }
    return b.sos - a.sos;
  }

  private allPlayersPlayedEachOther(playerIds: string[], h2h: H2HMap): boolean {
    // Check if all players have played against each other
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const aId = playerIds[i];
        const bId = playerIds[j];
        const aBeatsB = h2h[aId]?.[bId] || 0;
        const bBeatsA = h2h[bId]?.[aId] || 0;
        // If no games between them, they haven't played each other
        if (aBeatsB === 0 && bBeatsA === 0) {
          return false;
        }
      }
    }
    return true;
  }

  private sortPlayoffGroup(players: StandingPlayer[], h2h: H2HMap): void {
    if (players.length <= 1) return;

    // Group players by winRate
    const winRateGroups: Record<number, StandingPlayer[]> = {};
    for (const p of players) {
      const wr = p.winRate;
      if (!winRateGroups[wr]) winRateGroups[wr] = [];
      winRateGroups[wr].push(p);
    }

    // Sort each winRate group
    const sortedPlayers: StandingPlayer[] = [];
    const winRates = Object.keys(winRateGroups).map(Number).sort((a, b) => b - a); // descending

    for (const wr of winRates) {
      const group = winRateGroups[wr];
      
      if (group.length === 1) {
        sortedPlayers.push(group[0]);
      } else {
        // Check if all players in this group have played each other
        const playerIds = group.map(p => p.userId);
        const allPlayed = this.allPlayersPlayedEachOther(playerIds, h2h);
        
        if (allPlayed) {
          // Use H2H as tiebreaker
          const cmpWithH2H = (a: StandingPlayer, b: StandingPlayer) =>
            this.comparePlayersPlayoff(a, b, h2h, playerIds);
          group.sort(cmpWithH2H);
        } else {
          // Skip H2H, use winRate → sos only
          const cmpNoH2H = (a: StandingPlayer, b: StandingPlayer) =>
            this.comparePlayersNoH2H(a, b);
          group.sort(cmpNoH2H);
        }
        
        sortedPlayers.push(...group);
      }
    }

    // Update the original array with sorted players
    players.splice(0, players.length, ...sortedPlayers);
  }

  private comparePlayersPlayoff(a: StandingPlayer, b: StandingPlayer, h2h: H2HMap, tiedPlayerIds?: string[]): number {
    // Playoff order: winRate → H2H (if all tied played each other) → sos
    if (b.winRate !== a.winRate) {
      return b.winRate - a.winRate;
    }
    
    // Only apply H2H if all tied players have played against each other
    if (tiedPlayerIds && tiedPlayerIds.length > 2 && !this.allPlayersPlayedEachOther(tiedPlayerIds, h2h)) {
      // Skip H2H, go directly to sos
      return b.sos - a.sos;
    }
    
    const aBeatsB = h2h[a.userId]?.[b.userId] || 0;
    const bBeatsA = h2h[b.userId]?.[a.userId] || 0;
    if (aBeatsB !== bBeatsA) {
      return bBeatsA - aBeatsB;
    }
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

    // Fetch forfeited players for this tournament
    const forfeitedRegistrations = await prisma.tournament_registration.findMany({
      where: {
        tournamentId: Number(tournamentId),
        status: 'forfeited',
      },
      select: {
        userId: true,
      },
    });

    const forfeitedPlayerIds = new Set(
      forfeitedRegistrations
        .filter(r => r.userId !== null)
        .map(r => r.userId!.toString())
    );

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

    // Debug SoS calculations for specific players
    const debugPlayerIds = ['1815', '2429'];
    for (const playerId of debugPlayerIds) {
      if (players[playerId]) {
        const p = players[playerId];
        // console.log(`\n========== SoS DEBUG for Player ${playerId} (${p.name}) ==========`);
        // console.log(`Games: W=${p.gamesWon} L=${p.gamesLost} T=${p.gamesTied}`);
        // console.log(`Win Rate: ${p.winRate} (${p.winRate * 100}%)`);
        // console.log(`Opponents (${p.opponents.length} total):`);
        
        let sum = 0;
        p.opponents.forEach((oppId, idx) => {
          const opp = players[oppId];
          if (opp) {
            const oppTotal = opp.gamesWon + opp.gamesLost + opp.gamesTied;
            // console.log(`  ${idx + 1}. Opponent ${oppId} (${opp.name})`);
            // console.log(`     Games: W=${opp.gamesWon} L=${opp.gamesLost} T=${opp.gamesTied} (total=${oppTotal})`);
            // console.log(`     Win Rate: ${opp.winRate} (${opp.winRate * 100}%)`);
            // console.log(`     Running sum: ${sum} + ${opp.winRate} = ${sum + opp.winRate}`);
            sum += opp.winRate;
          }
        });
        
        // console.log(`\nFinal SoS Calculation:`);
        // console.log(`  Sum of opponent win rates: ${sum}`);
        // console.log(`  Number of opponents: ${p.opponents.length}`);
        // console.log(`  SoS = ${sum} / ${p.opponents.length} = ${p.sos}`);
        // console.log(`  SoS (full precision): ${p.sos.toFixed(10)}`);
        // console.log(`=================================================================\n`);
      }
    }

    // Filter out forfeit players and apply division filter
    const filteredPlayers = Object.values(players).filter(
      p => p.secondaryName !== 'Forfeit' && !forfeitedPlayerIds.has(p.userId) && (division ? p.secondaryName === division : true),
    );

    // Group by (standingName, secondaryName)
    const standingGroups: Record<string, StandingPlayer[]> = {};
    for (const p of filteredPlayers) {
      const key = `${p.standingName}|||${p.secondaryName || ''}`;
      if (!standingGroups[key]) standingGroups[key] = [];
      standingGroups[key].push(p);
    }

    // Sort within each standing group: first position uses H2H, rest use winRate → sos only
    for (const group of Object.values(standingGroups)) {
      // First, sort with H2H to determine first place
      const cmpFirst = (a: StandingPlayer, b: StandingPlayer) =>
        this.comparePlayers(a, b, h2h);
      group.sort(cmpFirst);
      
      // Assign first place
      group[0].standingOrder = 1;
      
      // For remaining positions, sort by winRate → sos only (no H2H)
      if (group.length > 1) {
        const rest = group.slice(1);
        const cmpNoH2H = (a: StandingPlayer, b: StandingPlayer) =>
          this.comparePlayersNoH2H(a, b);
        rest.sort(cmpNoH2H);
        
        // Reassign standingOrder for the rest
        rest.forEach((p, i) => {
          p.standingOrder = i + 2;
        });
        
        // Update the group with the new order
        group.splice(1, group.length - 1, ...rest);
      }
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

      // Sort first place: group by winRate, check H2H for each group
      this.sortPlayoffGroup(firstPlace, h2h);

      // Sort rest: group by winRate, check H2H for each group
      this.sortPlayoffGroup(rest, h2h);

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
