import { Test, TestingModule } from '@nestjs/testing';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { UsersService } from '../users/users.service';
import { JwtPayloadDto } from '../auth/dto/auth.dto';

const TOURNAMENT_ID = 7;
const PLAYER = 3;

const payload = (overrides: Partial<JwtPayloadDto> = {}): JwtPayloadDto => ({
  mail: 'player@example.com',
  name: 'Ada Lovelace',
  role: PLAYER,
  id: '5',
  ...overrides,
});

describe('TournamentsController.getWaitlistPlayers', () => {
  let controller: TournamentsController;
  let getWaitlistPlayers: jest.Mock;

  beforeEach(async () => {
    getWaitlistPlayers = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TournamentsController],
      providers: [
        { provide: TournamentsService, useValue: { getWaitlistPlayers } },
        { provide: UsersService, useValue: {} },
      ],
    }).compile();

    controller = module.get<TournamentsController>(TournamentsController);
  });

  it('treats a token that carries no role as a player, never as a site admin', async () => {
    await controller.getWaitlistPlayers(String(TOURNAMENT_ID), { ...payload(), role: undefined } as unknown as JwtPayloadDto);

    expect(getWaitlistPlayers).toHaveBeenCalledWith(TOURNAMENT_ID, PLAYER, '5');
  });

  it('passes the role the token carries', async () => {
    await controller.getWaitlistPlayers(String(TOURNAMENT_ID), payload({ role: 1 }));

    expect(getWaitlistPlayers).toHaveBeenCalledWith(TOURNAMENT_ID, 1, '5');
  });
});
