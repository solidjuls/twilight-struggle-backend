import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GamesService } from './games.service';
import { DatabaseService } from '../database/database.service';
import { RatingService } from '../rating/rating.service';
import { ShrkbotService } from '../shrkbot/shrkbot.service';
import { RecreateGameDto, SubmitGameDto } from './dto/game.dto';

const GAME_ID = 1024;
const USA_PLAYER_ID = '11';
const USSR_PLAYER_ID = '22';

const submission = (overrides: Partial<SubmitGameDto> = {}): SubmitGameDto => ({
  gameWinner: '1',
  gameCode: 'R1',
  tournamentId: '7',
  usaPlayerId: USA_PLAYER_ID,
  ussrPlayerId: USSR_PLAYER_ID,
  endTurn: '6',
  endMode: 'DEFCON',
  ...overrides,
});

const recreation = (overrides: Partial<RecreateGameDto> = {}): RecreateGameDto => ({
  oldId: String(GAME_ID),
  gameDate: '2026-07-20',
  op: undefined,
  ...submission(),
  ...overrides,
});

const storedGame = () => ({
  id: BigInt(GAME_ID),
  created_at: new Date('2026-07-20T00:00:00Z'),
  usa_player_id: BigInt(USA_PLAYER_ID),
  ussr_player_id: BigInt(USSR_PLAYER_ID),
  game_winner: '1',
  tournament_id: 7,
  game_code: 'R1',
});

const databaseDouble = () => {
  const transactionClient = {
    game_results: {
      findFirst: jest.fn().mockResolvedValue(storedGame()),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(storedGame()),
      delete: jest.fn().mockResolvedValue(storedGame()),
    },
    game_results_modified_log: { create: jest.fn().mockResolvedValue({}) },
    ratings_history: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    schedule: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };

  return {
    transactionClient,
    game_results: { create: jest.fn().mockResolvedValue({ id: BigInt(GAME_ID) }) },
    $transaction: jest.fn().mockImplementation((run: any) => run(transactionClient)),
  };
};

const ratingDouble = () => ({
  calculateRating: jest.fn().mockResolvedValue({
    newUsaRating: 5666,
    newUssrRating: 5736,
    usaRating: 5578,
    ussrRating: 5824,
  }),
});

describe('GamesService sends every reported result to shrkbot', () => {
  let service: GamesService;
  let syncGame: jest.Mock;
  let deleteGame: jest.Mock;

  beforeEach(async () => {
    syncGame = jest.fn().mockResolvedValue(undefined);
    deleteGame = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        { provide: DatabaseService, useValue: databaseDouble() },
        { provide: RatingService, useValue: ratingDouble() },
        { provide: ShrkbotService, useValue: { syncGame, deleteGame } },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
  });

  it('sends a newly submitted game', async () => {
    await service.submitGame(submission());

    expect(syncGame).toHaveBeenCalledWith(BigInt(GAME_ID));
  });

  it('sends an edited game', async () => {
    await service.recreateGame(recreation(), 1, 'admin@example.com');

    expect(syncGame).toHaveBeenCalledWith(GAME_ID);
    expect(deleteGame).not.toHaveBeenCalled();
  });

  it('sends a removed game as a deletion', async () => {
    await service.recreateGame(recreation({ op: 'delete' }), 1, 'admin@example.com');

    expect(deleteGame).toHaveBeenCalledWith(GAME_ID);
    expect(syncGame).not.toHaveBeenCalled();
  });

  it('sends a recreation without an earlier game once, as the submission it is', async () => {
    await service.recreateGame(recreation({ oldId: '' }), 1, 'admin@example.com');

    expect(syncGame).toHaveBeenCalledTimes(1);
    expect(syncGame).toHaveBeenCalledWith(BigInt(GAME_ID));
  });
});

describe('GamesService keeps writing while shrkbot is unreachable', () => {
  let service: GamesService;

  beforeEach(async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) as unknown as typeof fetch;
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const database: any = databaseDouble();
    database.game_results.findUnique = jest.fn().mockResolvedValue({
      ...storedGame(),
      game_date: new Date('2026-07-20T00:00:00Z'),
      reported_at: new Date('2026-07-24T10:00:00Z'),
      end_turn: 6,
      end_mode: 'DEFCON',
      video1: null,
      usa_previous_rating: 5578,
      ussr_previous_rating: 5824,
      ratings_history: [],
      users_game_results_usa_player_idTousers: null,
      users_game_results_ussr_player_idTousers: null,
    });
    database.tournaments = { findUnique: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        ShrkbotService,
        { provide: DatabaseService, useValue: database },
        { provide: RatingService, useValue: ratingDouble() },
        { provide: ConfigService, useValue: { get: (key: string) => ({ SHRKBOT_API_KEY: 'shrkbot_test_key' })[key] } },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('still stores a submitted game', async () => {
    await expect(service.submitGame(submission())).resolves.toEqual({ id: String(GAME_ID) });
  });

  it('still removes a deleted game', async () => {
    await expect(service.recreateGame(recreation({ op: 'delete' }), 1, 'admin@example.com')).resolves.toEqual({
      success: true,
    });
  });
});
