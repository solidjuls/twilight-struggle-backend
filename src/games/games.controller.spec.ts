import { Test, TestingModule } from '@nestjs/testing';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { ScheduleService } from '../schedule/schedule.service';
import { PlayoffsService } from '../playoffs/playoffs.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { SeedType } from './dto/game.dto';

type SeriesGame = {
  id: bigint;
  usa_player_id: bigint;
  ussr_player_id: bigint;
  game_winner: string;
};

const PLAYER_A = 10n;
const PLAYER_B = 20n;

const seedA: SeedType = { userId: PLAYER_A, seed: 1 };
const seedB: SeedType = { userId: PLAYER_B, seed: 4 };

let nextGameId = 1n;

const game = (usa: bigint, ussr: bigint, winner: '1' | '2' | '3'): SeriesGame => ({
  id: nextGameId++,
  usa_player_id: usa,
  ussr_player_id: ussr,
  game_winner: winner,
});

describe('GamesController.getSeriesWinner', () => {
  let controller: GamesController;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamesController],
      providers: [
        { provide: GamesService, useValue: {} },
        { provide: ScheduleService, useValue: {} },
        { provide: PlayoffsService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: UsersService, useValue: {} },
      ],
    }).compile();

    controller = module.get<GamesController>(GamesController);
  });

  it('has no winner before any game is played', () => {
    expect(controller.getSeriesWinner([], 3, seedA, seedB)).toBeNull();
  });

  it('has no winner while the series is still short of the needed wins', () => {
    const games = [game(PLAYER_A, PLAYER_B, '1')];

    expect(controller.getSeriesWinner(games, 3, seedA, seedB)).toBeNull();
  });

  it('awards a best-of-one to whoever won the single game', () => {
    const games = [game(PLAYER_A, PLAYER_B, '1')];

    expect(controller.getSeriesWinner(games, 1, seedA, seedB)).toBe(Number(PLAYER_A));
  });

  it('awards a best-of-three to the first player with two wins, counting each side', () => {
    const games = [
      game(PLAYER_A, PLAYER_B, '1'),
      game(PLAYER_B, PLAYER_A, '2'),
    ];

    expect(controller.getSeriesWinner(games, 3, seedA, seedB)).toBe(Number(PLAYER_A));
  });

  it('breaks a two-game series containing a tie in favour of the higher seed', () => {
    const games = [
      game(PLAYER_A, PLAYER_B, '1'),
      game(PLAYER_A, PLAYER_B, '3'),
    ];

    expect(controller.getSeriesWinner(games, 3, seedA, seedB)).toBe(PLAYER_A);
  });

  it('leaves a two-game series containing a tie undecided when the lower seed won it', () => {
    const games = [
      game(PLAYER_A, PLAYER_B, '2'),
      game(PLAYER_A, PLAYER_B, '3'),
    ];

    expect(controller.getSeriesWinner(games, 3, seedA, seedB)).toBeNull();
  });

  it('breaks a three-game series with no outright winner in favour of the higher seed', () => {
    const games = [
      game(PLAYER_A, PLAYER_B, '1'),
      game(PLAYER_B, PLAYER_A, '1'),
      game(PLAYER_A, PLAYER_B, '3'),
    ];

    expect(controller.getSeriesWinner(games, 3, seedA, seedB)).toBe(PLAYER_A);
  });

  it('reads the higher seed as the lower seed number regardless of argument order', () => {
    const games = [
      game(PLAYER_A, PLAYER_B, '1'),
      game(PLAYER_B, PLAYER_A, '1'),
      game(PLAYER_A, PLAYER_B, '3'),
    ];

    expect(controller.getSeriesWinner(games, 3, seedB, seedA)).toBe(PLAYER_A);
  });
});
