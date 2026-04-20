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
import { find } from 'rxjs';

const PLAYOFF_MATCHUP_DUE_DAYS = 7;

@Injectable()
export class PlayoffsService {
  constructor(private readonly databaseService: DatabaseService) {}

  highestRValue(params: string[]) {
    if (params.length === 0) return null;

    return params.reduce((maxStr, currentStr) => {
      const currentNum = parseInt(currentStr.match(/r(\d+)/)?.[1] || "0", 10);
      const maxNum = parseInt(maxStr.match(/r(\d+)/)?.[1] || "0", 10);

      return currentNum > maxNum ? currentStr : maxStr;
    });
  }

  async getBOFromPlayoff(userId: bigint, tID: string) {
    const userBrackets = await this.databaseService.playoff_bracket.findMany({
      select: {
        best_of_games: true,
        playoffSquare: true
      },
      where: { userId: userId, tournament_id: Number(tID) },
    });

    // We must find which bracket is related to this userId
    const currentPlayoffSquare = this.highestRValue(userBrackets.map(item => item.playoffSquare))
    const finalBO = userBrackets.find(item => item.playoffSquare === currentPlayoffSquare)
    return finalBO.best_of_games || 3
  }

  async updateBracketFromSubmit(
    userId: bigint,
    tournamentId: number
  ) {
    const userBrackets = await this.databaseService.playoff_bracket.findMany({
      select: {
        nextSquare: true,
        id: true
      },
      where: { userId: userId },
    });
    
    const nextSquare = this.highestRValue(userBrackets.map(item => item.nextSquare))
    const nextItem = userBrackets.find(item => item.nextSquare === nextSquare)
    const squareForEmail = await this.databaseService.playoff_bracket.update({
      data: {
        userId,
      },
      select: {
        nextSquare: true
      },
      where: {
        playoffSquare: nextItem.nextSquare,
        id: nextItem.id
      }
    })
    const playersFromNewBracket = await this.databaseService.playoff_bracket.findMany({
      select: {
        userId: true
      },
      where: {
        nextSquare: squareForEmail?.nextSquare
      }
    })

    return playersFromNewBracket.map(item => item.userId)
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
      if (!entry.id) {
        throw new HttpException(
          'Each bracket entry must have an id for update',
          HttpStatus.BAD_REQUEST,
        );
      }

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
