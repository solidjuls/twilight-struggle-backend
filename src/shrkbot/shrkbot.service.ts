import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { buildTournamentPayload, TournamentRow } from './shrkbot.payloads';

const DEFAULT_API_URL = 'https://shrkbot.com/api/twilight-struggle/v1';
const REQUEST_TIMEOUT_MS = 5000;

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
      const lineage = await this.tournamentLineage(tournamentId);

      for (const tournament of lineage) {
        await this.send('PUT', `tournaments/${tournament.id}`, {
          tournament: buildTournamentPayload(tournament),
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send tournament ${tournamentId} to shrkbot`, error);
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
