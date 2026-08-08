import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreatePlayoffBracketResultDto,
  PlayoffBracketResponseDto,
  PlayoffEntryDto,
  PlayoffSummaryDto,
  UpdatePlayoffBracketResultDto,
  UpdatePlayoffWinnerDto,
  UpdatePlayoffWinnerResultDto,
} from './dto/playoffs.dto';

const PLAYOFF_MATCHUP_DUE_DAYS = 7;

@Injectable()
export class PlayoffsService {
  constructor(private readonly databaseService: DatabaseService) {}

    async getSeedsFromPlayers(userId: bigint, tID: number) {
      const result =  await this.databaseService.playoff_bracket.findFirst({
        select: {
          seed: true,
        },
        where: { userId: userId, tournament_id: tID },
      });
      return { userId, seed: result.seed }
    }

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

    const existingBracket = await this.databaseService.playoff_bracket.findFirst({
      where: { tournament_id: tournamentId },
    });

    if (existingBracket) {
      throw new HttpException(
        `Playoff bracket already exists for tournament ${tournamentId}`,
        HttpStatus.BAD_REQUEST,
      );
    }

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

    // const matchupsByNextSquare = new Map<string, typeof data>();
    // for (const entry of data) {
    //   const existing = matchupsByNextSquare.get(entry.nextSquare) || [];
    //   existing.push(entry);
    //   matchupsByNextSquare.set(entry.nextSquare, existing);
    // }

    // const dueDate = new Date();
    // dueDate.setDate(dueDate.getDate() + PLAYOFF_MATCHUP_DUE_DAYS);

    // let schedulesCreated = 0;
    // for (const [nextSquare, players] of matchupsByNextSquare) {
    //   if (players.length === 2 && players[0].userId && players[1].userId) {
    //     // Assign USA/USSR by order, set random_sides to true
    //     await this.databaseService.schedule.create({
    //       data: {
    //         tournaments_id: tournamentId,
    //         game_code: `P${nextSquare}`,
    //         usa_player_id: BigInt(players[0].userId),
    //         ussr_player_id: BigInt(players[1].userId),
    //         due_date: dueDate,
    //         random_sides: true,
    //       },
    //     });
    //     schedulesCreated++;
    //   }
    // }

    return {
      success: true,
      message: 'Playoff bracket created successfully',
      bracketEntriesCreated: data.length,
      schedulesCreated: 0,
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
          select: {
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
      orderBy: { playoffSquare: 'asc' },
    });

    return bracket.map((entry) => ({
      id: entry.id.toString(),
      tournamentId: entry.tournament_id?.toString() || '',
      userId: entry.userId ? Number(entry.userId) : null,
      seed: entry.seed,
      playoffSquare: entry.playoffSquare || '',
      nextSquare: entry.nextSquare || '',
      userName: entry.users ? `${entry.users.first_name} ${entry.users.last_name}`.trim() : undefined,
      countryCode: entry.users?.countries?.tld_code || undefined,
      winnerUserId: Boolean((entry as any).winnerUserId),
    }));
  }

  /**
   * Returns all playoffs (tournaments with type 'playoff').
   */
  async getAllPlayoffs(): Promise<PlayoffSummaryDto[]> {
    const playoffs = await this.databaseService.tournaments.findMany({
      where: { type: 'playoff' },
      select: {
        id: true,
        tournament_name: true,
      },
      orderBy: { id: 'desc' },
    });

    return playoffs.map((playoff) => ({
      id: playoff.id,
      name: playoff.tournament_name,
    }));
  }

  /**
   * Updates playoff bracket entries by their IDs.
   */
  async updatePlayoffBracket(
    data: PlayoffEntryDto[],
  ): Promise<UpdatePlayoffBracketResultDto> {
    if (!data || data.length === 0) {
      throw new HttpException(
        'Bracket data is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    let updatedCount = 0;

    for (const entry of data) {
      if (entry.id) {
        await this.databaseService.playoff_bracket.update({
          where: { id: Number(entry.id) },
          data: {
            tournament_id: entry.tournamentId,
            userId: entry.userId ? BigInt(entry.userId) : null,
            seed: entry.seed ?? null,
            playoffSquare: entry.playoffSquare,
            nextSquare: entry.nextSquare,
          },
        });
      } else {
        await this.databaseService.playoff_bracket.create({
          data: {
            tournament_id: entry.tournamentId,
            userId: entry.userId ? BigInt(entry.userId) : null,
            seed: entry.seed ?? null,
            playoffSquare: entry.playoffSquare,
            nextSquare: entry.nextSquare,
          },
        });
      }
      updatedCount++;
    }

    return {
      success: true,
      message: 'Playoff bracket updated successfully',
      updatedEntries: updatedCount,
    };
  }

  /**
   * Updates the winnerUserId field for a playoff bracket entry.
   */
  async updatePlayoffWinner(
    data: UpdatePlayoffWinnerDto,
  ): Promise<UpdatePlayoffWinnerResultDto> {
    if (!data.id) {
      throw new HttpException(
        'Bracket id is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.databaseService.playoff_bracket.findUnique({
      where: { id: Number(data.id) },
    });

    await this.databaseService.playoff_bracket.update({
      where: { id: Number(data.id) },
      data: {
        winnerUserId: !Boolean((existing as any)?.winnerUserId),
      } as any,
    });

    return {
      success: true,
      message: 'Playoff winner updated successfully',
    };
  }
}
