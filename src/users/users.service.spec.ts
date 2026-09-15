import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';
import { ShrkbotService } from '../shrkbot/shrkbot.service';
import { UpdateUserDto } from './dto/users.dto';

const USER_ID = '42';
const USER_EMAIL = 'ada@example.com';

describe('UsersService.updateUser with a Discord User ID', () => {
  let service: UsersService;
  let update: jest.Mock;
  let findUnique: jest.Mock;

  const profile: UpdateUserDto = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: USER_EMAIL,
  };

  const submitted = (discord_user_id: string | null): UpdateUserDto => ({
    ...profile,
    discord_user_id,
  });

  const writtenData = () => update.mock.calls[0][0].data;

  beforeEach(async () => {
    update = jest.fn().mockResolvedValue({ id: BigInt(USER_ID) });
    findUnique = jest.fn().mockResolvedValue({ discord_user_id: null });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DatabaseService, useValue: { users: { update, findUnique } } },
        { provide: ShrkbotService, useValue: { syncAdministeredTournaments: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('stores a snowflake as a number', async () => {
    await service.updateUser(submitted('123456789012345678'));

    expect(writtenData().discord_user_id).toEqual(BigInt('123456789012345678'));
  });

  it('accepts the shortest and the longest snowflake', async () => {
    await service.updateUser(submitted('1'.repeat(17)));
    await service.updateUser(submitted('9'.repeat(20)));

    expect(update.mock.calls[0][0].data.discord_user_id).toEqual(BigInt('1'.repeat(17)));
    expect(update.mock.calls[1][0].data.discord_user_id).toEqual(BigInt('9'.repeat(20)));
  });

  it('ignores surrounding whitespace', async () => {
    await service.updateUser(submitted('  123456789012345678  '));

    expect(writtenData().discord_user_id).toEqual(BigInt('123456789012345678'));
  });

  it('clears the column when the value is empty', async () => {
    await service.updateUser(submitted('   '));

    expect(writtenData().discord_user_id).toBeNull();
  });

  it('clears the column when the value is null', async () => {
    await service.updateUser(submitted(null));

    expect(writtenData().discord_user_id).toBeNull();
  });

  it('leaves the column alone when the key is absent', async () => {
    await service.updateUser(profile);

    expect(writtenData().discord_user_id).toBeUndefined();
  });

  it.each([
    ['too short', '1234567890123456'],
    ['too long', '123456789012345678901'],
    ['not a number', '12345678901234567a'],
    ['a user name', 'ada#1234'],
  ])('rejects a value that is %s', async (_case, value) => {
    await expect(service.updateUser(submitted(value))).rejects.toThrow(
      'Discord User ID must be 17 to 20 digits',
    );
  });

  it('writes nothing when the value is invalid', async () => {
    await expect(service.updateUser(submitted('nope'))).rejects.toThrow();

    expect(update).not.toHaveBeenCalled();
  });
});

describe('UsersService.updateUser and the tournaments the user administers', () => {
  let service: UsersService;
  let update: jest.Mock;
  let findUnique: jest.Mock;
  let syncAdministeredTournaments: jest.Mock;

  const SNOWFLAKE = '123456789012345678';

  const profile: UpdateUserDto = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: USER_EMAIL,
  };

  const stored = (discord_user_id: bigint | null) => {
    findUnique.mockResolvedValue({ discord_user_id });
  };

  beforeEach(async () => {
    update = jest.fn().mockResolvedValue({ id: BigInt(USER_ID) });
    findUnique = jest.fn().mockResolvedValue({ discord_user_id: null });
    syncAdministeredTournaments = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DatabaseService, useValue: { users: { update, findUnique } } },
        { provide: ShrkbotService, useValue: { syncAdministeredTournaments } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('sends them when the user sets a Discord User ID', async () => {
    await service.updateUser({ ...profile, discord_user_id: SNOWFLAKE });

    expect(syncAdministeredTournaments).toHaveBeenCalledWith(BigInt(USER_ID));
  });

  it('sends them when the user clears a Discord User ID, so that shrkbot drops the access', async () => {
    stored(BigInt(SNOWFLAKE));

    await service.updateUser({ ...profile, discord_user_id: null });

    expect(syncAdministeredTournaments).toHaveBeenCalled();
  });

  it('sends nothing when the submitted ID is the stored one', async () => {
    stored(BigInt(SNOWFLAKE));

    await service.updateUser({ ...profile, discord_user_id: SNOWFLAKE });

    expect(syncAdministeredTournaments).not.toHaveBeenCalled();
  });

  it('sends nothing when the rest of the profile changes', async () => {
    await service.updateUser({ ...profile, firstName: 'Augusta' });

    expect(syncAdministeredTournaments).not.toHaveBeenCalled();
  });

  it('sends nothing when the update fails', async () => {
    update.mockRejectedValue(new Error('no such user'));

    await service.updateUser({ ...profile, discord_user_id: SNOWFLAKE });

    expect(syncAdministeredTournaments).not.toHaveBeenCalled();
  });
});

describe('UsersService.getUserById', () => {
  let service: UsersService;
  let findFirst: jest.Mock;

  const row = {
    id: BigInt(USER_ID),
    first_name: 'Ada',
    last_name: 'Lovelace',
    playdek_name: 'ada',
    email: USER_EMAIL,
    discord_user_id: BigInt('123456789012345678'),
    phone_number: null,
    last_login_at: null,
    preferred_gaming_platform: null,
    preferred_game_duration: null,
    timezone_id: null,
    cities: null,
    countries: null,
  };

  beforeEach(async () => {
    findFirst = jest.fn().mockResolvedValue(row);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DatabaseService,
          useValue: {
            users: { findFirst },
            ratings_history: { findFirst: jest.fn().mockResolvedValue(null) },
          },
        },
        { provide: ShrkbotService, useValue: { syncAdministeredTournaments: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('returns the Discord User ID as a string', async () => {
    const user = await service.getUserById(USER_ID);

    expect(user.discord_user_id).toBe('123456789012345678');
  });

  it('returns no Discord User ID when the column is empty', async () => {
    findFirst.mockResolvedValue({ ...row, discord_user_id: null });

    const user = await service.getUserById(USER_ID);

    expect(user.discord_user_id).toBeUndefined();
  });
});
