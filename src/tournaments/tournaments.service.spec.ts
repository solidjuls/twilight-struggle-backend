import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TournamentsService } from './tournaments.service';
import { DatabaseService } from '../database/database.service';
import { ShrkbotService } from '../shrkbot/shrkbot.service';

const TOURNAMENT_ID = 7;
const PARENT_ID = 3;
const USER_ID = '123';

describe('TournamentsService sends every tournament change to shrkbot', () => {
  let service: TournamentsService;
  let syncTournament: jest.Mock;
  let deleteTournament: jest.Mock;
  let database: any;

  beforeEach(async () => {
    syncTournament = jest.fn().mockResolvedValue(undefined);
    deleteTournament = jest.fn().mockResolvedValue(undefined);

    database = {
      tournaments: {
        create: jest.fn().mockResolvedValue({ id: TOURNAMENT_ID }),
        update: jest.fn().mockResolvedValue({ id: TOURNAMENT_ID }),
        delete: jest.fn().mockResolvedValue({ id: TOURNAMENT_ID }),
        findUnique: jest.fn().mockResolvedValue({ id: PARENT_ID, tournament_admins: [] }),
      },
      tournament_admins: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      tournament_registration: { create: jest.fn().mockResolvedValue({}) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsService,
        { provide: DatabaseService, useValue: database },
        { provide: ShrkbotService, useValue: { syncTournament, deleteTournament } },
      ],
    }).compile();

    service = module.get<TournamentsService>(TournamentsService);
  });

  it('sends a newly created tournament', async () => {
    await service.createTournament({ tournamentName: 'League', status: 1 });

    expect(syncTournament).toHaveBeenCalledWith(TOURNAMENT_ID);
  });

  it('sends a newly created subtournament', async () => {
    await service.createSubtournament(PARENT_ID, { tournamentName: 'Playoffs' });

    expect(syncTournament).toHaveBeenCalledWith(TOURNAMENT_ID);
  });

  it('sends a status change', async () => {
    await service.updateTournament(TOURNAMENT_ID, 4);

    expect(syncTournament).toHaveBeenCalledWith(TOURNAMENT_ID);
  });

  it('sends a detail change', async () => {
    await service.updateTournamentFull(TOURNAMENT_ID, { tournamentName: 'Renamed' });

    expect(syncTournament).toHaveBeenCalledWith(TOURNAMENT_ID);
  });

  it('sends a status change made by an admin', async () => {
    await service.updateTournamentStatus(TOURNAMENT_ID, 4, { id: USER_ID, role: 1 });

    expect(syncTournament).toHaveBeenCalledWith(TOURNAMENT_ID);
  });

  it('sends an added admin', async () => {
    await service.addTournamentAdmin(TOURNAMENT_ID, USER_ID);

    expect(syncTournament).toHaveBeenCalledWith(TOURNAMENT_ID);
  });

  it('sends a removed admin', async () => {
    await service.removeTournamentAdmin(TOURNAMENT_ID, USER_ID);

    expect(syncTournament).toHaveBeenCalledWith(TOURNAMENT_ID);
  });

  it('sends a deleted tournament as a deletion', async () => {
    await service.deleteTournament(String(TOURNAMENT_ID));

    expect(deleteTournament).toHaveBeenCalledWith(TOURNAMENT_ID);
    expect(syncTournament).not.toHaveBeenCalled();
  });

  it('leaves an unauthorized status change unsent', async () => {
    await expect(service.updateTournamentStatus(TOURNAMENT_ID, 4, { id: USER_ID, role: 3 })).rejects.toThrow();

    expect(syncTournament).not.toHaveBeenCalled();
  });

  it('leaves a rejected admin removal unsent', async () => {
    database.tournament_admins.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.removeTournamentAdmin(TOURNAMENT_ID, USER_ID)).rejects.toThrow();

    expect(syncTournament).not.toHaveBeenCalled();
  });
});

describe('TournamentsService keeps writing while shrkbot is unreachable', () => {
  let service: TournamentsService;

  beforeEach(async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) as unknown as typeof fetch;
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsService,
        ShrkbotService,
        {
          provide: DatabaseService,
          useValue: {
            tournaments: {
              create: jest.fn().mockResolvedValue({ id: TOURNAMENT_ID }),
              delete: jest.fn().mockResolvedValue({ id: TOURNAMENT_ID }),
              findUnique: jest.fn().mockResolvedValue({
                id: TOURNAMENT_ID,
                tournament_name: 'League',
                parent_id: null,
                TournamentStatus: { status_name: 'Ongoing' },
                tournament_admins: [],
              }),
            },
          },
        },
        { provide: ConfigService, useValue: { get: (key: string) => ({ SHRKBOT_API_KEY: 'shrkbot_test_key' })[key] } },
      ],
    }).compile();

    service = module.get<TournamentsService>(TournamentsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('still creates the tournament', async () => {
    await expect(service.createTournament({ tournamentName: 'League', status: 1 })).resolves.toEqual({
      id: TOURNAMENT_ID,
    });
  });

  it('still deletes the tournament', async () => {
    await expect(service.deleteTournament(String(TOURNAMENT_ID))).resolves.toEqual({ id: TOURNAMENT_ID });
  });
});
