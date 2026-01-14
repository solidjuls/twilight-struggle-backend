import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RatingService } from '../rating/rating.service';
import {
  GameDto,
  GameListResponse,
  GameFilterDto,
  GameRatingDto,
  SubmitGameDto,
  RecreateGameDto,
} from './dto/game.dto';
import { PrismaClient } from '@prisma/client';

const FRIENDLY_GAME = 47

@Injectable()
export class GamesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ratingService: RatingService,
  ) {}

  private createPrismaFilter(filter: GameFilterDto): any {
    const prismaFilter: any = {};

    if (filter.id) {
      prismaFilter.id = filter.id;
    }

    if (filter.userFilter && filter.userFilter.length > 0) {
      if (filter.userFilter.length === 1) {
        // Single user: return all games for that user
        prismaFilter.OR = [
          { usa_player_id: BigInt(filter.userFilter[0]) },
          { ussr_player_id: BigInt(filter.userFilter[0]) },
        ];
      } else if (filter.userFilter.length === 2) {
        // Two users: return games played between these 2 users
        const [user1, user2] = filter.userFilter.map(id => BigInt(id));
        prismaFilter.OR = [
          { usa_player_id: user1, ussr_player_id: user2 },
          { usa_player_id: user2, ussr_player_id: user1 },
        ];
      } else {
        // More than 2 users: return all games where any of these users played
        prismaFilter.OR = [
          { usa_player_id: { in: filter.userFilter.map(id => BigInt(id)) } },
          { ussr_player_id: { in: filter.userFilter.map(id => BigInt(id)) } },
        ];
      }
    }

    if (filter.toFilter && filter.toFilter.length > 0) {
      prismaFilter.tournament_id = { in: filter.toFilter };
    }

    if (filter.video === true) {
      prismaFilter.video1 = { not: null };
    }

    return prismaFilter;
  }

  private async getGamesWithRatingDifference(gamesWithRatingRelated: any[]): Promise<GameDto[]> {
    return await Promise.all(
      gamesWithRatingRelated.map(async (game: any) => {
        const ratingsUSA: GameRatingDto = {
          rating: game.ratingHistoryUSA,
          previousRating: game.usa_previous_rating,
        };

        const ratingsUSSR: GameRatingDto = {
          rating: game.ratingHistoryUSSR,
          previousRating: game.ussr_previous_rating,
        };

        const usaRatingDifference = ratingsUSA.rating - ratingsUSA.previousRating;
        const ussrRatingDifference = ratingsUSSR.rating - ratingsUSSR.previousRating;

        return {
          id: game.id.toString(),
          created_at: game.created_at,
          updated_at: game.updated_at,
          usaPlayerId: game.usa_player_id.toString(),
          ussrPlayerId: game.ussr_player_id.toString(),
          usaRatingDifference,
          ussrRatingDifference,
          tournamentName: game.tournaments?.tournament_name || 'Unknown',
          tournamentId: game.tournaments?.id.toString() || '',
          game_code: game.game_code,
          reported_at: game.created_at,
          gameWinner: game.game_winner,
          endTurn: game.end_turn ? Number(game.end_turn) : null,
          endMode: game.end_mode,
          gameDate: game.game_date,
          video1: game.video1,
          videoURL: game.video1 || '',
          reporter_id: game.reporter_id?.toString() || null,
          usaCountryCode: game.users_game_results_usa_player_idTousers?.countries?.tld_code || '',
          ussrCountryCode: game.users_game_results_ussr_player_idTousers?.countries?.tld_code || '',
          usaPlayer: `${game.users_game_results_usa_player_idTousers?.first_name || ''} ${game.users_game_results_usa_player_idTousers?.last_name || ''}`.trim(),
          ussrPlayer: `${game.users_game_results_ussr_player_idTousers?.first_name || ''} ${game.users_game_results_ussr_player_idTousers?.last_name || ''}`.trim(),
          ratingsUSA,
          ratingsUSSR,
        };
      }),
    );
  }

  async getGamesWithRatings(
    filter: GameFilterDto,
    page: number,
    pageSize: number,
  ): Promise<GameListResponse> {
    pageSize = pageSize || 20;
    const skip = (page - 1) * pageSize;

    const prismaFilter = this.createPrismaFilter(filter);

    const totalRows = await this.databaseService.game_results.count({
      where: prismaFilter,
    });

    const games = await this.databaseService.game_results.findMany({
      select: {
        id: true,
        usa_player_id: true,
        ussr_player_id: true,
        created_at: true,
        end_mode: true,
        end_turn: true,
        game_code: true,
        game_date: true,
        video1: true,
        game_winner: true,
        usa_previous_rating: true,
        ussr_previous_rating: true,
        reporter_id: true,
        ratings_history: {
          select: {
            rating: true,
            player_id: true,
          },
        },
        tournaments: {
          select: {
            tournament_name: true,
            id: true,
          },
        },
        users_game_results_usa_player_idTousers: {
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
        users_game_results_ussr_player_idTousers: {
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
      where: prismaFilter,
      skip,
      take: pageSize,
      orderBy: [
        {
          created_at: 'desc',
        },
      ],
    });

    const normalizedGames = games.map((game: any) => {
      let ratingHistoryUSA = 0;
      let ratingHistoryUSSR = 0;
      
      game.ratings_history.forEach(({ rating, player_id }) => {
        if (player_id === game.usa_player_id) {
          ratingHistoryUSA = rating;
        } else if (player_id === game.ussr_player_id) {
          ratingHistoryUSSR = rating;
        }
      });

      return {
        ...game,
        ratingHistoryUSA,
        ratingHistoryUSSR,
      };
    });

    const results = await this.getGamesWithRatingDifference(normalizedGames);

    return {
      results,
      totalRows,
    };
  }

  async getGameById(id: string) {
    const game = await this.databaseService.game_results.findFirst({
      select: {
        created_at: true,
        updated_at: true,
        reported_at: true,
        game_code: true,
        end_turn: true,
        end_mode: true,
        video1: true,
        usa_player_id: true,
        ussr_player_id: true,
        game_winner: true,
        tournament_id: true,
        id: true,
        tournaments: {
          select: {
            id: true,
          },
        },
      },
      where: {
        id: BigInt(id),
      },
    });

    if (!game) {
      return null;
    }

    return {
      ...game,
      id: game.id.toString(),
      usa_player_id: game.usa_player_id.toString(),
      ussr_player_id: game.ussr_player_id.toString(),
    };
  }

  async submitGame(data: SubmitGameDto): Promise<any> {
    try {
      const { newUsaRating, newUssrRating, usaRating, ussrRating } =
        await this.ratingService.calculateRating({
          usaPlayerId: BigInt(data.usaPlayerId),
          ussrPlayerId: BigInt(data.ussrPlayerId),
          gameWinner: data.gameWinner,
          tournamentId: data.tournamentId,
        });

      const dateNow = new Date(Date.now());
      const newGame = {
        created_at: dateNow,
        updated_at: dateNow,
        usa_player_id: BigInt(data.usaPlayerId),
        ussr_player_id: BigInt(data.ussrPlayerId),
        usa_previous_rating: usaRating,
        ussr_previous_rating: ussrRating,
        tournament_id: Number(data.tournamentId),
        game_code: data.gameCode,
        reported_at: dateNow,
        game_winner: data.gameWinner,
        end_turn: Number(data.endTurn),
        end_mode: data.endMode,
        game_date: dateNow,
        video1: data.video1 || null,
        reporter_id: BigInt(data.usaPlayerId),
      };

      const result = await this.databaseService.game_results.create({
        data: {
          ...newGame,
          ratings_history: {
            create: [
              {
                player_id: BigInt(data.usaPlayerId),
                rating: newUsaRating,
                game_code: data.gameCode,
                created_at: dateNow,
                updated_at: dateNow,
              },
              {
                player_id: BigInt(data.ussrPlayerId),
                rating: newUssrRating,
                game_code: data.gameCode,
                created_at: dateNow,
                updated_at: dateNow,
              },
            ],
          },
        },
      });

      // Convert BigInt to string for JSON serialization
      const resultParsed = JSON.stringify(result, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      );

      return JSON.parse(resultParsed);
    } catch (error) {
      console.error('Error submitting game:', error);
      throw error;
    }
  }

  async recreateGame(data: RecreateGameDto, userRole: number, userEmail: string): Promise<any> {
    if (!data.oldId) {
      // If no oldId, treat as new game submission
      return this.submitGame({
        gameWinner: data.gameWinner,
        gameCode: data.gameCode,
        tournamentId: data.tournamentId,
        usaPlayerId: data.usaPlayerId,
        ussrPlayerId: data.ussrPlayerId,
        endTurn: data.endTurn,
        endMode: data.endMode,
        video1: data.video1,
      });
    } else {
      if (data.op === 'delete') {
        return this.deleteGameRecreateRatings(data, userRole, userEmail);
      }
      return this.startRecreatingRatings(data, userRole, userEmail);
    }
  }

  private tournamentRequiresRecreation(oldTournamentId: number, newTournamentId: number) {
    if (oldTournamentId !== newTournamentId && (oldTournamentId === FRIENDLY_GAME || newTournamentId === FRIENDLY_GAME)) {
      return true
    }

    return false
  }

  private async startRecreatingRatings(input: RecreateGameDto, role: number, emailReporter: string): Promise<any> {
    try {
      await this.databaseService.$transaction(
        async (prismaTransaction) => {
          const dateNow = new Date(Date.now());

          // Get the old game data
          const oldGameDate = await this.getGameByGameId(input.oldId, prismaTransaction);

          if (!oldGameDate) {
            throw new Error('Old game id is wrong');
          }

          // Add to log table
          await this.addGameToLogTable(prismaTransaction, oldGameDate, emailReporter);
          console.log('oldGameDate', oldGameDate);

          // Check if only metadata changed (no rating recalculation needed)
          if (
            oldGameDate.usa_player_id.toString() === input.usaPlayerId &&
            oldGameDate.ussr_player_id.toString() === input.ussrPlayerId &&
            oldGameDate.game_winner === input.gameWinner &&
            !this.tournamentRequiresRecreation(oldGameDate.tournament_id, Number(input.tournamentId))
          ) {
            // Only update metadata
            await prismaTransaction.game_results.update({
              data: {
                updated_at: dateNow,
                game_code: input.gameCode,
                end_turn: Number(input.endTurn),
                end_mode: input.endMode,
                video1: input.video1 || null,
                reporter_id: BigInt(input.usaPlayerId),
                tournament_id: Number(input.tournamentId),
              },
              where: {
                id: Number(input.oldId),
              },
            });
            console.log('updated instead of recreated');
            return { success: true };
          }

          console.log('start recreating.....');

          // Get all games affected (created after or at the same time as the old game)
          const allGamesAffected = await prismaTransaction.game_results.findMany({
            select: {
              id: true,
              created_at: true,
              usa_player_id: true,
              ussr_player_id: true,
              game_winner: true,
              game_code: true,
              tournament_id: true,
            },
            where: {
              created_at: {
                gte: new Date(oldGameDate?.created_at as Date),
              },
            },
            orderBy: [
              {
                created_at: 'asc',
              },
            ],
          });

          console.log('allGamesAffected', allGamesAffected);

          // Delete all rating history for affected games
          const ids = allGamesAffected.map((game) => game.id);
          const deletedMany = await prismaTransaction.ratings_history.deleteMany({
            where: {
              game_result_id: {
                in: ids,
              },
            },
          });

          console.log('deletedMany', deletedMany);

          // Recreate ratings for all affected games
          for (const game of allGamesAffected) {
            if (game.id.toString() === input.oldId) {
              // Update the original game with new data and recalculate its rating
              const { usaRating, ussrRating } = await this.createNewRating({
                usaPlayerId: BigInt(input.usaPlayerId),
                ussrPlayerId: BigInt(input.ussrPlayerId),
                gameWinner: input.gameWinner,
                createdAt: game.created_at,
                updatedAt: dateNow,
                gameId: game.id,
                gameType: input.tournamentId,
                prismaTransaction,
              });

              console.log('new rating created for updated game', usaRating, ussrRating);

              // Update the game with new data
              await prismaTransaction.game_results.update({
                data: {
                  updated_at: dateNow,
                  usa_player_id: BigInt(input.usaPlayerId),
                  ussr_player_id: BigInt(input.ussrPlayerId),
                  usa_previous_rating: usaRating,
                  ussr_previous_rating: ussrRating,
                  tournament_id: Number(input.tournamentId),
                  game_code: input.gameCode,
                  game_winner: input.gameWinner,
                  end_turn: Number(input.endTurn),
                  end_mode: input.endMode,
                  video1: input.video1 || null,
                  reporter_id: BigInt(input.usaPlayerId),
                },
                where: {
                  id: game.id,
                },
              });
              console.log('original game updated');
            } else {
              // Recalculate ratings for other affected games
              const { usaRating, ussrRating } = await this.createNewRating({
                usaPlayerId: BigInt(game.usa_player_id),
                ussrPlayerId: BigInt(game.ussr_player_id),
                gameWinner: game.game_winner as any,
                createdAt: game.created_at,
                updatedAt: dateNow,
                gameId: game.id,
                gameType: game.tournament_id?.toString() as string,
                prismaTransaction,
              });

              console.log('new rating created for affected game', usaRating, ussrRating);

              // Update previous ratings
              await prismaTransaction.game_results.update({
                data: {
                  usa_previous_rating: usaRating,
                  ussr_previous_rating: ussrRating,
                },
                where: {
                  id: game.id,
                },
              });
              console.log('affected game updated');
            }
          }
        },
        {
          maxWait: 500000, // 500 seconds
          timeout: 2000000, // 2000 seconds
        },
      );
    } catch (error) {
      console.error('Error recreating ratings:', error);
      throw error;
    }

    return { success: true };
  }

  private async deleteGameRecreateRatings(input: RecreateGameDto, role: number, emailReporter: string): Promise<any> {
    try {
      await this.databaseService.$transaction(
        async (prismaTransaction) => {
          const dateNow = new Date(Date.now());

          // Get the old game data
          const oldGameDate = await this.getGameByGameId(input.oldId, prismaTransaction);

          if (!oldGameDate) {
            throw new Error('Old game id is wrong');
          }

          // Add to log table
          await this.addGameToLogTable(prismaTransaction, oldGameDate, emailReporter);
          console.log('oldGameDate', oldGameDate);

          // Update schedule table to unlink the game result
          await prismaTransaction.schedule.updateMany({
            where: {
              game_results_id: BigInt(input.oldId),
            },
            data: {
              game_results_id: null,
            },
          });

          // Delete ratings_history for the game being deleted
          await prismaTransaction.ratings_history.deleteMany({
            where: {
              game_result_id: BigInt(input.oldId),
            },
          });

          // Delete the game
          const gameDeleted = await prismaTransaction.game_results.delete({
            where: {
              id: Number(input.oldId),
            },
          });

          console.log("gameDeleted", gameDeleted);
          console.log('start recreating.....');

          // Get all games affected (created after or at the same time as the old game)
          const allGamesAffected = await prismaTransaction.game_results.findMany({
            select: {
              id: true,
              created_at: true,
              usa_player_id: true,
              ussr_player_id: true,
              game_winner: true,
              game_code: true,
              tournament_id: true,
            },
            where: {
              created_at: {
                gte: new Date(oldGameDate?.created_at as Date),
              },
            },
            orderBy: [
              {
                created_at: 'asc',
              },
            ],
          });

          console.log('allGamesAffected', allGamesAffected);

          // Delete all rating history for affected games
          const ids = allGamesAffected.map((game) => game.id);
          const deletedMany = await prismaTransaction.ratings_history.deleteMany({
            where: {
              game_result_id: {
                in: ids,
              },
            },
          });

          console.log('deletedMany', deletedMany);

          // Recreate ratings for all affected games
          for (const game of allGamesAffected) {
            if (game.id.toString() === input.oldId) {
              continue;
            } else {
              // Recalculate ratings for other affected games
              const { usaRating, ussrRating } = await this.createNewRating({
                usaPlayerId: BigInt(game.usa_player_id),
                ussrPlayerId: BigInt(game.ussr_player_id),
                gameWinner: game.game_winner as any,
                createdAt: game.created_at,
                updatedAt: dateNow,
                gameId: game.id,
                gameType: game.tournament_id?.toString() as string,
                prismaTransaction,
              });

              console.log('new rating created for affected game', usaRating, ussrRating);

              // Update previous ratings
              await prismaTransaction.game_results.update({
                data: {
                  usa_previous_rating: usaRating,
                  ussr_previous_rating: ussrRating,
                },
                where: {
                  id: game.id,
                },
              });
              console.log('affected game updated');
            }
          }
        },
        {
          maxWait: 500000, // 500 seconds
          timeout: 2000000, // 2000 seconds
        },
      );
    } catch (error) {
      console.error('Error recreating ratings:', error);
      throw error;
    }

    return { success: true };
  }

  private async getGameByGameId(gameId: string, prismaTransaction?: any): Promise<any> {
    const client = prismaTransaction || this.databaseService;

    return await client.game_results.findFirst({
      where: {
        id: Number(gameId),
      },
      include: {
        tournaments: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  private async addGameToLogTable(prismaTransaction: any, input: any, emailReporter: string): Promise<void> {
    const logAdded = await prismaTransaction.game_results_modified_log.create({
      data: {
        gameId: input.id,
        created_at: new Date(Date.now()),
        updated_at: new Date(Date.now()),
        usa_player_id: BigInt(input.usa_player_id),
        ussr_player_id: BigInt(input.ussr_player_id),
        game_type: Number(input.tournaments?.id),
        game_code: input.game_code,
        reported_at: new Date(Date.now()),
        game_winner: input.game_winner,
        end_turn: Number(input.end_turn),
        end_mode: input.end_mode,
        game_date: new Date(Date.now()),
        video1: input.video1 || null,
        reporter_id: emailReporter,
      },
    });
    console.log('logAdded', logAdded);
  }

  private async createNewRating({
    usaPlayerId,
    ussrPlayerId,
    gameWinner,
    createdAt,
    updatedAt,
    gameId,
    gameType,
    prismaTransaction,
  }: {
    usaPlayerId: bigint;
    ussrPlayerId: bigint;
    gameWinner: string;
    createdAt: Date | null;
    updatedAt: Date | null;
    gameId: bigint;
    gameType: string;
    prismaTransaction: any;
  }): Promise<{ usaRating: number; ussrRating: number }> {
    // Calculate new ratings using the rating service
    const { newUsaRating, newUssrRating, usaRating, ussrRating } = await this.ratingService.calculateRating({
      usaPlayerId,
      ussrPlayerId,
      gameWinner: gameWinner as any,
      tournamentId: gameType,
      prismaTransaction,
    });

    console.log('newUsaRating, newUssrRating', gameId, newUsaRating, newUssrRating);

    // Create rating history entries
    await prismaTransaction.ratings_history.createMany({
      data: [
        {
          player_id: BigInt(usaPlayerId),
          rating: newUsaRating,
          game_code: 'recr',
          created_at: createdAt,
          updated_at: updatedAt,
          game_result_id: gameId,
          total_games: 0,
          friendly_games: 0,
          usa_victories: 0,
          usa_losses: 0,
          usa_ties: 0,
          ussr_victories: 0,
          ussr_losses: 0,
          ussr_ties: 0,
        },
        {
          player_id: BigInt(ussrPlayerId),
          rating: newUssrRating,
          game_code: 'recr',
          created_at: createdAt,
          updated_at: updatedAt,
          game_result_id: gameId,
          total_games: 0,
          friendly_games: 0,
          usa_victories: 0,
          usa_losses: 0,
          usa_ties: 0,
          ussr_victories: 0,
          ussr_losses: 0,
          ussr_ties: 0,
        },
      ],
    });

    return { usaRating, ussrRating };
  }

  public async getWinTypeChartData(userId: string, fromDate?: Date): Promise<any> {
    try {
      const usaStats = await this.databaseService.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total_games,
        SUM(CASE WHEN game_winner = '1' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN game_winner = '2' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN game_winner = '3' THEN 1 ELSE 0 END) as ties,
        SUM(CASE WHEN game_winner = '1' AND end_mode = 'DEFCON' THEN 1 ELSE 0 END) as defcon_wins,
        SUM(CASE WHEN game_winner = '1' AND (end_mode = 'Final Scoring' OR end_mode = 'Europe Control') THEN 1 ELSE 0 END) as final_scoring_wins,
        SUM(CASE WHEN game_winner = '1' AND end_mode = 'VP Track (+20)' THEN 1 ELSE 0 END) as vp_track_wins,
        SUM(CASE WHEN game_winner = '1' AND end_mode = 'Wargames' THEN 1 ELSE 0 END) as wargames_wins,
        SUM(CASE WHEN game_winner = '1' AND end_mode = 'Forfeit' THEN 1 ELSE 0 END) as forfeit_wins,
        SUM(CASE WHEN game_winner = '1' AND end_mode = 'Timer Expired' THEN 1 ELSE 0 END) as timer_wins,
        SUM(CASE WHEN game_winner = '1' AND end_mode = 'Cuban Missile Crisis' THEN 1 ELSE 0 END) as cuban_wins,
        SUM(CASE WHEN game_winner = '1' AND end_mode = 'Scoring Card Held' THEN 1 ELSE 0 END) as scoring_card_wins,
        SUM(CASE WHEN game_winner = '1' AND (end_mode IS NULL OR end_mode NOT IN ('DEFCON', 'Final Scoring', 'Europe Control', 'VP Track (+20)', 'Wargames', 'Forfeit', 'Timer Expired', 'Cuban Missile Crisis', 'Scoring Card Held')) THEN 1 ELSE 0 END) as unknown_wins,
        SUM(CASE WHEN game_winner = '2' AND end_mode = 'DEFCON' THEN 1 ELSE 0 END) as defcon_losses,
        SUM(CASE WHEN game_winner = '2' AND (end_mode = 'Final Scoring' OR end_mode = 'Europe Control') THEN 1 ELSE 0 END) as final_scoring_losses,
        SUM(CASE WHEN game_winner = '2' AND end_mode = 'VP Track (+20)' THEN 1 ELSE 0 END) as vp_track_losses,
        SUM(CASE WHEN game_winner = '2' AND end_mode = 'Wargames' THEN 1 ELSE 0 END) as wargames_losses,
        SUM(CASE WHEN game_winner = '2' AND end_mode = 'Forfeit' THEN 1 ELSE 0 END) as forfeit_losses,
        SUM(CASE WHEN game_winner = '2' AND end_mode = 'Timer Expired' THEN 1 ELSE 0 END) as timer_losses,
        SUM(CASE WHEN game_winner = '2' AND end_mode = 'Cuban Missile Crisis' THEN 1 ELSE 0 END) as cuban_losses,
        SUM(CASE WHEN game_winner = '2' AND end_mode = 'Scoring Card Held' THEN 1 ELSE 0 END) as scoring_card_losses,
        SUM(CASE WHEN game_winner = '2' AND (end_mode IS NULL OR end_mode NOT IN ('DEFCON', 'Final Scoring', 'Europe Control', 'VP Track (+20)', 'Wargames', 'Forfeit', 'Timer Expired', 'Cuban Missile Crisis', 'Scoring Card Held')) THEN 1 ELSE 0 END) as unknown_losses
      FROM game_results
      WHERE usa_player_id = ${userId} 
      AND (${fromDate ?? null} IS NULL OR game_date >= ${fromDate})
    `;

    // SQL query to get win/loss statistics for USSR
    const ussrStats = await this.databaseService.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total_games,
        SUM(CASE WHEN game_winner = '2' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN game_winner = '1' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN game_winner = '3' THEN 1 ELSE 0 END) as ties,
        SUM(CASE WHEN game_winner = '2' AND end_mode = 'DEFCON' THEN 1 ELSE 0 END) as defcon_wins,
        SUM(CASE WHEN game_winner = '2' AND (end_mode = 'Final Scoring' OR end_mode = 'Europe Control') THEN 1 ELSE 0 END) as final_scoring_wins,
        SUM(CASE WHEN game_winner = '2' AND end_mode = 'VP Track (+20)' THEN 1 ELSE 0 END) as vp_track_wins,
        SUM(CASE WHEN game_winner = '2' AND end_mode = 'Wargames' THEN 1 ELSE 0 END) as wargames_wins,
        SUM(CASE WHEN game_winner = '2' AND end_mode = 'Forfeit' THEN 1 ELSE 0 END) as forfeit_wins,
        SUM(CASE WHEN game_winner = '2' AND end_mode = 'Timer Expired' THEN 1 ELSE 0 END) as timer_wins,
        SUM(CASE WHEN game_winner = '2' AND end_mode = 'Cuban Missile Crisis' THEN 1 ELSE 0 END) as cuban_wins,
        SUM(CASE WHEN game_winner = '2' AND end_mode = 'Scoring Card Held' THEN 1 ELSE 0 END) as scoring_card_wins,
        SUM(CASE WHEN game_winner = '2' AND (end_mode IS NULL OR end_mode NOT IN ('DEFCON', 'Final Scoring', 'Europe Control', 'VP Track (+20)', 'Wargames', 'Forfeit', 'Timer Expired', 'Cuban Missile Crisis', 'Scoring Card Held')) THEN 1 ELSE 0 END) as unknown_wins,
        SUM(CASE WHEN game_winner = '1' AND end_mode = 'DEFCON' THEN 1 ELSE 0 END) as defcon_losses,
        SUM(CASE WHEN game_winner = '1' AND (end_mode = 'Final Scoring' OR end_mode = 'Europe Control') THEN 1 ELSE 0 END) as final_scoring_losses,
        SUM(CASE WHEN game_winner = '1' AND end_mode = 'VP Track (+20)' THEN 1 ELSE 0 END) as vp_track_losses,
        SUM(CASE WHEN game_winner = '1' AND end_mode = 'Wargames' THEN 1 ELSE 0 END) as wargames_losses,
        SUM(CASE WHEN game_winner = '1' AND end_mode = 'Forfeit' THEN 1 ELSE 0 END) as forfeit_losses,
        SUM(CASE WHEN game_winner = '1' AND end_mode = 'Timer Expired' THEN 1 ELSE 0 END) as timer_losses,
        SUM(CASE WHEN game_winner = '1' AND end_mode = 'Cuban Missile Crisis' THEN 1 ELSE 0 END) as cuban_losses,
        SUM(CASE WHEN game_winner = '1' AND end_mode = 'Scoring Card Held' THEN 1 ELSE 0 END) as scoring_card_losses,
        SUM(CASE WHEN game_winner = '1' AND (end_mode IS NULL OR end_mode NOT IN ('DEFCON', 'Final Scoring', 'Europe Control', 'VP Track (+20)', 'Wargames', 'Forfeit', 'Timer Expired', 'Cuban Missile Crisis', 'Scoring Card Held')) THEN 1 ELSE 0 END) as unknown_losses
      FROM game_results
      WHERE ussr_player_id = ${userId} 
      AND (${fromDate ?? null} IS NULL OR game_date >= ${fromDate})
    `;
      const result = {
        usaStats,
        ussrStats,
      };
      return result;
    } catch (error) {
      console.error('Error executing SQL query:', error);
      throw new Error('Failed to fetch chart data');
    }
  }
  
}

