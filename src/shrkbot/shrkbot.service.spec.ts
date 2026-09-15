import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ShrkbotService } from './shrkbot.service';
import { DatabaseService } from '../database/database.service';

const API_URL = 'https://shrkbot.test/api/twilight-struggle/v1';
const API_KEY = 'shrkbot_test_key';

const GAME_ID = BigInt(1024);
const USA_PLAYER_ID = BigInt(11);
const USSR_PLAYER_ID = BigInt(22);

const row = (id: number, parent_id: number | null = null) => ({
  id,
  tournament_name: `Tournament ${id}`,
  parent_id,
  TournamentStatus: { status_name: 'Ongoing' },
  tournament_admins: [{ users: { discord_user_id: BigInt('123456789012345678') } }],
});

const gameRow = (overrides: Record<string, unknown> = {}) => ({
  id: GAME_ID,
  tournament_id: 7,
  game_code: 'R1',
  game_date: new Date('2026-07-20T00:00:00Z'),
  reported_at: new Date('2026-07-24T10:00:00Z'),
  game_winner: '1',
  end_turn: 6,
  end_mode: 'DEFCON',
  video1: null,
  usa_player_id: USA_PLAYER_ID,
  ussr_player_id: USSR_PLAYER_ID,
  usa_previous_rating: 5578,
  ussr_previous_rating: 5824,
  ratings_history: [],
  users_game_results_usa_player_idTousers: {
    first_name: 'Ada',
    last_name: 'Lovelace',
    discord_user_id: null,
    countries: null,
  },
  users_game_results_ussr_player_idTousers: {
    first_name: 'Grace',
    last_name: 'Hopper',
    discord_user_id: null,
    countries: null,
  },
  ...overrides,
});

describe('ShrkbotService', () => {
  let service: ShrkbotService;
  let findUnique: jest.Mock;
  let findGame: jest.Mock;
  let findAdministered: jest.Mock;
  let fetchMock: jest.Mock;
  let logError: jest.SpyInstance;

  const build = async (config: Record<string, string>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShrkbotService,
        {
          provide: DatabaseService,
          useValue: {
            tournaments: { findUnique },
            game_results: { findUnique: findGame },
            tournament_admins: { findMany: findAdministered },
          },
        },
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
      ],
    }).compile();

    return module.get<ShrkbotService>(ShrkbotService);
  };

  const requestTo = (index: number) => ({
    url: fetchMock.mock.calls[index][0],
    options: fetchMock.mock.calls[index][1],
    body: JSON.parse(fetchMock.mock.calls[index][1].body),
  });

  beforeEach(async () => {
    findUnique = jest.fn().mockImplementation(({ where }) => Promise.resolve(row(where.id)));
    findGame = jest.fn().mockResolvedValue(gameRow());
    findAdministered = jest.fn().mockResolvedValue([{ tournamentId: 7 }]);
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    global.fetch = fetchMock as unknown as typeof fetch;
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    service = await build({ SHRKBOT_API_URL: API_URL, SHRKBOT_API_KEY: API_KEY });
  });

  afterEach(() => {
    logError.mockRestore();
  });

  describe('syncTournament', () => {
    it('puts the tournament to its own external id', async () => {
      await service.syncTournament(7);

      expect(requestTo(0).url).toBe(`${API_URL}/tournaments/7`);
      expect(requestTo(0).options.method).toBe('PUT');
    });

    it('authenticates with the configured key', async () => {
      await service.syncTournament(7);

      expect(requestTo(0).options.headers.Authorization).toBe(`Bearer ${API_KEY}`);
      expect(requestTo(0).options.headers['Content-Type']).toBe('application/json');
    });

    it('wraps the payload in a tournament key', async () => {
      await service.syncTournament(7);

      expect(requestTo(0).body).toEqual({
        tournament: {
          name: 'Tournament 7',
          status: 'Ongoing',
          admins: ['123456789012345678'],
        },
      });
    });

    it('sends every ancestor before the tournament itself', async () => {
      findUnique.mockImplementation(({ where }) =>
        Promise.resolve({ 1: row(1), 2: row(2, 1), 3: row(3, 2) }[where.id]),
      );

      await service.syncTournament(3);

      expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
        `${API_URL}/tournaments/1`,
        `${API_URL}/tournaments/2`,
        `${API_URL}/tournaments/3`,
      ]);
    });

    it('stops walking when a tournament is its own ancestor', async () => {
      findUnique.mockImplementation(({ where }) => Promise.resolve(row(where.id, where.id)));

      await service.syncTournament(7);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('sends nothing for a tournament that no longer exists', async () => {
      findUnique.mockResolvedValue(null);

      await service.syncTournament(7);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('logs a rejected request instead of throwing', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 422, text: async () => 'unknown parent' });

      await expect(service.syncTournament(7)).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalled();
    });

    it('logs an unreachable shrkbot instead of throwing', async () => {
      fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));

      await expect(service.syncTournament(7)).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalled();
    });
  });

  describe('syncAdministeredTournaments', () => {
    const lineage = (parents: Record<number, number | null>) => {
      findUnique.mockImplementation(({ where }) => Promise.resolve(row(where.id, parents[where.id])));
    };

    it('looks the tournaments up by the user', async () => {
      await service.syncAdministeredTournaments(BigInt(42));

      expect(findAdministered).toHaveBeenCalledWith({
        where: { userId: BigInt(42) },
        select: { tournamentId: true },
      });
    });

    it('puts every tournament the user administers', async () => {
      findAdministered.mockResolvedValue([{ tournamentId: 7 }, { tournamentId: 9 }]);

      await service.syncAdministeredTournaments(42);

      expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
        `${API_URL}/tournaments/7`,
        `${API_URL}/tournaments/9`,
      ]);
    });

    it('puts a shared ancestor once', async () => {
      findAdministered.mockResolvedValue([{ tournamentId: 2 }, { tournamentId: 3 }]);
      lineage({ 1: null, 2: 1, 3: 1 });

      await service.syncAdministeredTournaments(42);

      expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
        `${API_URL}/tournaments/1`,
        `${API_URL}/tournaments/2`,
        `${API_URL}/tournaments/3`,
      ]);
    });

    it('sends nothing for a user who administers nothing', async () => {
      findAdministered.mockResolvedValue([]);

      await service.syncAdministeredTournaments(42);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('logs a rejected request instead of throwing', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 422, text: async () => 'unknown parent' });

      await expect(service.syncAdministeredTournaments(42)).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalled();
    });
  });

  describe('deleteTournament', () => {
    it('deletes the tournament by its external id', async () => {
      await service.deleteTournament(7);

      expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/tournaments/7`);
      expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
      expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    });

    it('reads nothing from the database', async () => {
      await service.deleteTournament(7);

      expect(findUnique).not.toHaveBeenCalled();
    });

    it('logs a rejected request instead of throwing', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

      await expect(service.deleteTournament(7)).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalled();
    });
  });

  describe('syncGame', () => {
    it('puts the game to its own external id', async () => {
      await service.syncGame(GAME_ID);

      expect(requestTo(1).url).toBe(`${API_URL}/games/1024`);
      expect(requestTo(1).options.method).toBe('PUT');
    });

    it('sends the tournament before the game, which shrkbot needs to place it', async () => {
      await service.syncGame(GAME_ID);

      expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
        `${API_URL}/tournaments/7`,
        `${API_URL}/games/1024`,
      ]);
    });

    it('sends no tournament for a friendly game', async () => {
      findGame.mockResolvedValue(gameRow({ tournament_id: 47 }));

      await service.syncGame(GAME_ID);

      expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([`${API_URL}/games/1024`]);
    });

    it('wraps the payload in a game key', async () => {
      await service.syncGame(GAME_ID);

      expect(requestTo(1).body.game).toMatchObject({
        tournament_external_id: '7',
        winning_side: 'usa',
        usa: { name: 'Ada Lovelace' },
        ussr: { name: 'Grace Hopper' },
      });
    });

    it('accepts the id as a number', async () => {
      await service.syncGame(1024);

      expect(requestTo(1).url).toBe(`${API_URL}/games/1024`);
    });

    it('sends nothing for a game that no longer exists', async () => {
      findGame.mockResolvedValue(null);

      await service.syncGame(GAME_ID);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('logs a rejected request instead of throwing', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 422, text: async () => 'unknown tournament' });

      await expect(service.syncGame(GAME_ID)).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalled();
    });

    it('logs an unreachable shrkbot instead of throwing', async () => {
      fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));

      await expect(service.syncGame(GAME_ID)).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalled();
    });
  });

  describe('deleteGame', () => {
    it('deletes the game by its external id', async () => {
      await service.deleteGame(GAME_ID);

      expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/games/1024`);
      expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
      expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    });

    it('reads nothing from the database', async () => {
      await service.deleteGame(GAME_ID);

      expect(findGame).not.toHaveBeenCalled();
    });

    it('logs a rejected request instead of throwing', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

      await expect(service.deleteGame(GAME_ID)).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalled();
    });
  });

  describe('without an API key', () => {
    beforeEach(async () => {
      service = await build({ SHRKBOT_API_URL: API_URL });
    });

    it('sends no tournament', async () => {
      await service.syncTournament(7);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends no deletion', async () => {
      await service.deleteTournament(7);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends no game', async () => {
      await service.syncGame(GAME_ID);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends no game deletion', async () => {
      await service.deleteGame(GAME_ID);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends no administered tournament, and reads none', async () => {
      await service.syncAdministeredTournaments(42);

      expect(findAdministered).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('without a configured URL', () => {
    beforeEach(async () => {
      service = await build({ SHRKBOT_API_KEY: API_KEY });
    });

    it('falls back to the public API', async () => {
      await service.syncTournament(7);

      expect(fetchMock.mock.calls[0][0]).toBe('https://shrkbot.com/api/twilight-struggle/v1/tournaments/7');
    });
  });

  describe('with a trailing slash on the configured URL', () => {
    beforeEach(async () => {
      service = await build({ SHRKBOT_API_URL: `${API_URL}/`, SHRKBOT_API_KEY: API_KEY });
    });

    it('does not double the separator', async () => {
      await service.syncTournament(7);

      expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/tournaments/7`);
    });
  });
});
