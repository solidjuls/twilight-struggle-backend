import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreatePlayoffBracketResultDto,
  PlayoffBracketResponseDto,
  PlayoffEntryDto,
} from './dto/playoffs.dto';

/** Number of days to add to current date for matchup due dates */
const PLAYOFF_MATCHUP_DUE_DAYS = 7;

@Injectable()
export class PlayoffsService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Creates a playoff bracket and schedules for the tournament.
   * Players are paired by grouping on nextSquare value.
   */
  async createPlayoffBracket(
    data: PlayoffEntryDto[],
  ): Promise<CreatePlayoffBracketResultDto> {
    if (!data || data.length === 0) {
      throw new HttpException(
        'Bracket data is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const tournamentId = data[0].tournamentId;

    // Check if bracket already exists for this tournament
    const existingBracket = await this.databaseService.playoff_bracket.findFirst({
      where: { tournament_id: tournamentId },
    });

    if (existingBracket) {
      throw new HttpException(
        `Playoff bracket already exists for tournament ${tournamentId}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Insert playoff bracket entries
    const bracketData = data.map((entry) => ({
      tournament_id: entry.tournamentId,
      userId: entry.userId ? BigInt(entry.userId) : null,
      seed: entry.seed ? entry.seed : null,
      playoffSquare: entry.playoffSquare,
      nextSquare: entry.nextSquare,
    }));

    await this.databaseService.playoff_bracket.createMany({
      data: bracketData,
    });

    // Group players by nextSquare to create matchups
    const matchupsByNextSquare = new Map<string, typeof data>();
    for (const entry of data) {
      const existing = matchupsByNextSquare.get(entry.nextSquare) || [];
      existing.push(entry);
      matchupsByNextSquare.set(entry.nextSquare, existing);
    }

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + PLAYOFF_MATCHUP_DUE_DAYS);

    // Create schedule entries for each matchup (where 2 players share nextSquare)
    let schedulesCreated = 0;
    for (const [nextSquare, players] of matchupsByNextSquare) {
      if (players.length === 2 && players[0].userId && players[1].userId) {
        // Assign USA/USSR by order, set random_sides to true
        await this.databaseService.schedule.create({
          data: {
            tournaments_id: tournamentId,
            game_code: `P${nextSquare}`,
            usa_player_id: BigInt(players[0].userId),
            ussr_player_id: BigInt(players[1].userId),
            due_date: dueDate,
            random_sides: true,
          },
        });
        schedulesCreated++;
      }
    }

    return {
      success: true,
      message: 'Playoff bracket created successfully',
      bracketEntriesCreated: data.length,
      schedulesCreated,
    };
  }

  /**
   * Returns the playoff bracket for a tournament.
   */
  async getPlayoffBracket(
    tournamentId: number,
  ): Promise<PlayoffBracketResponseDto[]> {
    const bracket = await this.databaseService.playoff_bracket.findMany({
      where: { tournament_id: tournamentId },
      include: {
        users: {
          include: {
            countries: true,
          },
        },
      },
      orderBy: { playoffSquare: 'asc' },
    });

    return bracket.map((entry) => ({
      id: entry.id.toString(),
      tournamentId: entry.tournament_id?.toString() || '',
      userId: entry.userId ? Number(entry.userId) : null,
      seed: entry.seed,
      playoffSquare: entry.playoffSquare || '',
      nextSquare: entry.nextSquare || '',
      userName: entry.users
        ? `${entry.users.first_name || ''} ${entry.users.last_name || ''}`.trim()
        : undefined,
      countryCode: entry.users?.countries?.tld_code || undefined,
    }));
  }
}

