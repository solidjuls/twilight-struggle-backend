import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';
import { UpdateUserDto } from './dto/users.dto';

const SESSION_USER_ID = '42';

describe('UsersService.updateUser', () => {
  let service: UsersService;
  let update: jest.Mock;

  const profile: UpdateUserDto = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    playdek_name: 'ada',
    phone: '555',
    preferredGamingPlatform: 'Playdek',
    preferredGameDuration: 'Long',
    city: 3,
    country: 7,
  };

  beforeEach(async () => {
    update = jest.fn().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DatabaseService, useValue: { users: { update } } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('updates the account the session belongs to', async () => {
    await service.updateUser(SESSION_USER_ID, profile);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BigInt(SESSION_USER_ID) } }),
    );
  });

  it('ignores an email supplied in the request body', async () => {
    const spoofed = { ...profile, email: 'victim@example.com' } as UpdateUserDto;

    await service.updateUser(SESSION_USER_ID, spoofed);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BigInt(SESSION_USER_ID) } }),
    );
  });

  it('never identifies the account by email', async () => {
    await service.updateUser(SESSION_USER_ID, profile);

    expect(update.mock.calls[0][0].where).not.toHaveProperty('email');
  });

  it('writes the submitted profile fields', async () => {
    await service.updateUser(SESSION_USER_ID, profile);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          first_name: 'Ada',
          last_name: 'Lovelace',
          playdek_name: 'ada',
          phone_number: '555',
          preferred_gaming_platform: 'Playdek',
          preferred_game_duration: 'Long',
          city_id: 3,
          country_id: 7,
        }),
      }),
    );
  });

  it('leaves the email column alone', async () => {
    await service.updateUser(SESSION_USER_ID, profile);

    expect(update.mock.calls[0][0].data).not.toHaveProperty('email');
  });

  it('reports failure when the write throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    update.mockRejectedValue(new Error('no such user'));

    await expect(service.updateUser(SESSION_USER_ID, profile)).resolves.toEqual({
      success: false,
      error: 'Failed to update user',
    });
  });
});

describe('UsersService.updatePassword', () => {
  let service: UsersService;
  let findUnique: jest.Mock;
  let update: jest.Mock;

  const passwords = {
    currentPassword: 'old-password',
    newPassword: 'new-password',
    confirmPassword: 'new-password',
  };

  beforeEach(async () => {
    findUnique = jest.fn().mockResolvedValue({ id: BigInt(SESSION_USER_ID), password: 'hashed' });
    update = jest.fn().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DatabaseService, useValue: { users: { findUnique, update } } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('finds the account by id rather than by email', async () => {
    await service.updatePassword(SESSION_USER_ID, passwords);

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BigInt(SESSION_USER_ID) } }),
    );
  });

  it('rejects a confirmation that does not match', async () => {
    const mismatched = { ...passwords, confirmPassword: 'something-else' };

    await expect(service.updatePassword(SESSION_USER_ID, mismatched)).resolves.toEqual({
      success: false,
      error: 'New passwords do not match',
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects a wrong current password without writing', async () => {
    await expect(service.updatePassword(SESSION_USER_ID, passwords)).resolves.toEqual({
      success: false,
      error: 'Current password is incorrect',
    });
    expect(update).not.toHaveBeenCalled();
  });
});
