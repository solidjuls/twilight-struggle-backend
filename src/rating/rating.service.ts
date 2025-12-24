import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UsersService } from '../users/users.service';
import { GameWinner } from '../games/dto/game.dto';
import { PlayerRatingDto, PlayerRatingListResponse } from './dto/rating.dto';
import { getTopNRatedPlayersWithFilter, getTopNRatedPlayers } from "@prisma/client/sql";

const DEFAULT_RATING = 5000;
const FRIENDLY_GAME = "47"

@Injectable()
export class RatingService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly usersService: UsersService,
  ) {}

  async getRatingByPlayer(playerId: bigint, prismaTransaction?: any): Promise<{ rating: number } | null> {
    const client = prismaTransaction || this.databaseService;
    return await client.ratings_history.findFirst({
      select: {
        rating: true,
      },
      where: {
        player_id: playerId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }
  private roundValue(value: number) {
    if (value < 0) {
      const roundedPositiveValue = Math.round(Math.abs(value));
      return roundedPositiveValue * -1;
    }

    return Math.round(value);
  }
  private  getRatingDifference(
    defeated: number,
    winner: number,
    addValue: number = 100,
    gameType: string,
  ) {
    let basicCalculus = (defeated - winner) * 0.05;
    if (gameType === FRIENDLY_GAME) basicCalculus = basicCalculus / 2;

    const newValue = this.roundValue(basicCalculus) + addValue;

    if (addValue !== 0 && newValue <= 0) {
      return 1;
    }
    if (newValue > 200) {
      return 200;
    }

    return newValue;
  };

  private getSmallerValue(value1: number, value2: number) {
    if (value1 > value2) return { bigger: value1, smaller: value2 };
    if (value1 < value2) return { bigger: value1, smaller: value2 };
    return { bigger: value1, smaller: value2 };
  };

  private getNewRatings(
    usaRating: number,
    ussrRating: number,
    gameWinner: GameWinner,
    tournamentId: string,
  ): {
    newUsaRating: number;
    newUssrRating: number;
    usaRating: number;
    ussrRating: number;
  } {
    let newUsaRating: number = 0;
    let newUssrRating: number = 0;

    if (gameWinner === "1") {
      const ratingDifference: number = this.getRatingDifference(
        ussrRating,
        usaRating,
        tournamentId === FRIENDLY_GAME ? 50 : 100,
        tournamentId,
      );
      newUsaRating = usaRating + ratingDifference;
      newUssrRating = ussrRating - ratingDifference;
    } else if (gameWinner === "2") {
      const ratingDifference: number = this.getRatingDifference(
        usaRating,
        ussrRating,
        tournamentId === FRIENDLY_GAME ? 50 : 100,
        tournamentId,
      );
      newUsaRating = usaRating - ratingDifference;
      newUssrRating = ussrRating + ratingDifference;
    } else if (gameWinner === "3") {
      const { bigger, smaller } = this.getSmallerValue(usaRating, ussrRating);
      const ratingDifference: number = this.getRatingDifference(smaller, bigger, 0, tournamentId);
      console.log("ratingDifference", ratingDifference, usaRating, ussrRating, bigger, smaller);

      if (usaRating <= ussrRating) {
        newUsaRating = usaRating + Math.abs(ratingDifference);
        newUssrRating = ussrRating - Math.abs(ratingDifference);
        console.log("usaRating <= ussrRating", newUsaRating, newUssrRating);
      } else if (usaRating > ussrRating) {
        newUsaRating = usaRating - Math.abs(ratingDifference);
        newUssrRating = ussrRating + Math.abs(ratingDifference);
        console.log("usaRating > ussrRating", newUsaRating, newUssrRating);
      }
    }
    return { newUsaRating, newUssrRating, usaRating, ussrRating };
  }

  async calculateRating({
    usaPlayerId,
    ussrPlayerId,
    gameWinner,
    tournamentId,
    prismaTransaction,
  }: {
    usaPlayerId: bigint;
    ussrPlayerId: bigint;
    gameWinner: GameWinner;
    tournamentId: string;
    prismaTransaction?: any;
  }): Promise<{
    newUsaRating: number;
    newUssrRating: number;
    usaRating: number;
    ussrRating: number;
  }> {
    const usaRatingRecord = await this.getRatingByPlayer(usaPlayerId, prismaTransaction);
    const ussrRatingRecord = await this.getRatingByPlayer(ussrPlayerId, prismaTransaction);

    const usaRating = usaRatingRecord?.rating || DEFAULT_RATING;
    const ussrRating = ussrRatingRecord?.rating || DEFAULT_RATING;

    console.log('usaRating, ussrRating', usaRating, ussrRating, usaRatingRecord?.rating, ussrRatingRecord?.rating);

    return this.getNewRatings(usaRating, ussrRating, gameWinner, tournamentId);
  }

  async getPlayerRatings({
    page,
    pageSize,
    playerIds,
    countryId,
    playdeckName,
    orderDirection = 'desc',
  }: {
    page: number;
    pageSize: number;
    playerIds?: string[];
    countryId?: string;
    playdeckName?: string;
    orderDirection?: 'asc' | 'desc';
  }): Promise<PlayerRatingListResponse> {
    let skip = (page - 1) * pageSize;
    try {
      let results = []
      let usersByCountry = []

      if (playerIds) {
        // @ts-ignore
        results = await this.databaseService.$queryRaw(getTopNRatedPlayersWithFilter(playerIds?.join(','), pageSize, skip));
      } else if (countryId) {
        usersByCountry = await this.usersService.getPlayerIdsByCountry(countryId);
        // @ts-ignore
        results = await this.databaseService.$queryRaw(getTopNRatedPlayersWithFilter(usersByCountry?.join(','), pageSize, skip));
      } else if(playdeckName) {
        const userId = await this.usersService.getPlayerIdByPlaydekName(playdeckName);
        // @ts-ignore
        results = await this.databaseService.$queryRaw(getTopNRatedPlayersWithFilter(userId, pageSize, skip));
      } else {
        // @ts-ignore
        results = await this.databaseService.$queryRaw(getTopNRatedPlayers(pageSize, skip));
      }

      const transformedResults: PlayerRatingDto[] = results.map((row) => ({
        id: row.id.toString(),
        rank: Number(row.ranking),
        name: `${row.first_name} ${row.last_name}`.trim(),
        first_name: row.first_name,
        last_name: row.last_name,
        countryCode: row.tld_code || undefined,
        rating: Number(row.rating),
      }));

      const totalRows = results.length > 0 ? Number(results[0].total_players) : 0;

      return {
        results: transformedResults,
        totalRows,
        currentPage: page,
        totalPages: Math.ceil(totalRows / pageSize),
      };
    } catch (error) {
      console.error('Error executing SQL query:', error);
      throw new Error('Failed to fetch player ratings');
    }
  }
}
