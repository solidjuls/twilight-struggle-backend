import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import {
  buildGamePayload,
  buildTournamentPayload,
  FRIENDLY_GAME_TOURNAMENT_ID,
  GameRow,
  TournamentRow,
} from './shrkbot.payloads';

const DEFAULT_API_URL = 'https://shrkbot.com/api/twilight-struggle/v1';
const REQUEST_TIMEOUT_MS = 5000;

const PLAYER_SELECT = {
  first_name: true,
  last_name: true,
  discord_user_id: true,
  countries: { select: { tld_code: true } },
};

@Injectable()
export class ShrkbotService implements OnModuleInit {
  private readonly logger = new Logger(ShrkbotService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = (this.configService.get<string>('SHRKBOT_API_URL') || DEFAULT_API_URL).replace(/\/+$/, '');
    this.apiKey = this.configService.get<string>('SHRKBOT_API_KEY') || '';
  }

  onModuleInit() {
    if (!this.apiKey) {
      this.logger.log('SHRKBOT_API_KEY is not set, so nothing is sent to shrkbot');
    }
  }

  async syncTournament(tournamentId: number): Promise<void> {
    if (!this.apiKey) {
      return;
    }

    try {
      await this.pushTournaments([tournamentId]);
    } catch (error) {
      this.logger.error(`Failed to send tournament ${tournamentId} to shrkbot`, error);
    }
  }

  async syncAdministeredTournaments(userId: bigint | number): Promise<void> {
    if (!this.apiKey) {
      return;
    }

    const id = BigInt(userId);

    try {
      const administered = await this.databaseService.tournament_admins.findMany({
        where: { userId: id },
        select: { tournamentId: true },
      });

      await this.pushTournaments(administered.map((admin) => admin.tournamentId));
    } catch (error) {
      this.logger.error(`Failed to send the tournaments administered by ${id} to shrkbot`, error);
    }
  }

  async deleteTournament(tournamentId: number): Promise<void> {
    if (!this.apiKey) {
      return;
    }

    try {
      await this.send('DELETE', `tournaments/${tournamentId}`);
    } catch (error) {
      this.logger.error(`Failed to delete tournament ${tournamentId} from shrkbot`, error);
    }
  }

  async syncGame(gameResultId: bigint | number): Promise<void> {
    if (!this.apiKey) {
      return;
    }

    const id = BigInt(gameResultId);

    try {
      const game = await this.findGame(id);
      if (!game) {
        return;
      }

      if (game.tournament_id !== null && game.tournament_id !== FRIENDLY_GAME_TOURNAMENT_ID) {
        await this.syncTournament(game.tournament_id);
      }

      await this.send('PUT', `games/${id}`, { game: buildGamePayload(game) });
    } catch (error) {
      this.logger.error(`Failed to send game ${id} to shrkbot`, error);
    }
  }

  async deleteGame(gameResultId: bigint | number): Promise<void> {
    if (!this.apiKey) {
      return;
    }

    const id = BigInt(gameResultId);

    try {
      await this.send('DELETE', `games/${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete game ${id} from shrkbot`, error);
    }
  }

  private async pushTournaments(tournamentIds: number[]): Promise<void> {
    const sent = new Set<number>();

    for (const tournamentId of tournamentIds) {
      const lineage = await this.tournamentLineage(tournamentId);

      for (const tournament of lineage) {
        if (sent.has(tournament.id)) {
          continue;
        }

        sent.add(tournament.id);

        await this.send('PUT', `tournaments/${tournament.id}`, {
          tournament: buildTournamentPayload(tournament),
        });
      }
    }
  }

  // Parents first: shrkbot answers 422 for a tournament whose parent it does not know yet.
  private async tournamentLineage(tournamentId: number): Promise<TournamentRow[]> {
    const lineage: TournamentRow[] = [];
    const visited = new Set<number>();
    let nextId: number | null = tournamentId;

    while (nextId && !visited.has(nextId)) {
      visited.add(nextId);

      const tournament = await this.findTournament(nextId);
      if (!tournament) {
        break;
      }

      lineage.unshift(tournament);
      nextId = tournament.parent_id;
    }

    return lineage;
  }

  private async findTournament(id: number): Promise<TournamentRow | null> {
    return await this.databaseService.tournaments.findUnique({
      where: { id },
      select: {
        id: true,
        tournament_name: true,
        parent_id: true,
        TournamentStatus: { select: { status_name: true } },
        tournament_admins: { select: { users: { select: { discord_user_id: true } } } },
      },
    });
  }

  private async findGame(id: bigint): Promise<GameRow | null> {
    return await this.databaseService.game_results.findUnique({
      where: { id },
      select: {
        id: true,
        tournament_id: true,
        game_code: true,
        game_date: true,
        reported_at: true,
        game_winner: true,
        end_turn: true,
        end_mode: true,
        video1: true,
        usa_player_id: true,
        ussr_player_id: true,
        usa_previous_rating: true,
        ussr_previous_rating: true,
        ratings_history: { select: { player_id: true, rating: true } },
        users_game_results_usa_player_idTousers: { select: PLAYER_SELECT },
        users_game_results_ussr_player_idTousers: { select: PLAYER_SELECT },
      },
    });
  }

  private async send(method: 'PUT' | 'DELETE', path: string, body?: unknown): Promise<void> {
    const response = await fetch(`${this.apiUrl}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(body && { 'Content-Type': 'application/json' }),
      },
      ...(body && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`shrkbot answered ${response.status} to ${method} ${path}: ${await response.text()}`);
    }
  }
}
