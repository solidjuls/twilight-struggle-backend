import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ShrkbotService } from './shrkbot.service';
import { DatabaseService } from '../database/database.service';

const API_URL = 'https://shrkbot.test/api/twilight-struggle/v1';
const API_KEY = 'shrkbot_test_key';

const row = (id: number, parent_id: number | null = null) => ({
  id,
  tournament_name: `Tournament ${id}`,
  parent_id,
  TournamentStatus: { status_name: 'Ongoing' },
  tournament_admins: [{ users: { discord_user_id: BigInt('123456789012345678') } }],
});

describe('ShrkbotService', () => {
  let service: ShrkbotService;
  let findUnique: jest.Mock;
  let fetchMock: jest.Mock;
  let logError: jest.SpyInstance;

  const build = async (config: Record<string, string>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShrkbotService,
        { provide: DatabaseService, useValue: { tournaments: { findUnique } } },
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
