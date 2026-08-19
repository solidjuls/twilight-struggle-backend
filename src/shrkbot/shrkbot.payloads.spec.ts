import { buildTournamentPayload, TournamentRow } from './shrkbot.payloads';

const admin = (discord_user_id: bigint | null) => ({ users: { discord_user_id } });

const tournament = (overrides: Partial<TournamentRow> = {}): TournamentRow => ({
  id: 7,
  tournament_name: 'Online Twilight Struggle League',
  parent_id: null,
  TournamentStatus: { status_name: 'Ongoing' },
  tournament_admins: [],
  ...overrides,
});

describe('buildTournamentPayload', () => {
  it('sends the tournament name', () => {
    expect(buildTournamentPayload(tournament()).name).toBe('Online Twilight Struggle League');
  });

  it('sends the status name', () => {
    expect(buildTournamentPayload(tournament()).status).toBe('Ongoing');
  });

  it('omits the status when the tournament has none', () => {
    const payload = buildTournamentPayload(tournament({ TournamentStatus: null }));

    expect(payload).not.toHaveProperty('status');
  });

  it('sends the parent id as a string', () => {
    expect(buildTournamentPayload(tournament({ parent_id: 3 })).parent_external_id).toBe('3');
  });

  it('omits the parent id for a top level tournament', () => {
    expect(buildTournamentPayload(tournament())).not.toHaveProperty('parent_external_id');
  });

  it('sends every admin Discord ID as a string', () => {
    const payload = buildTournamentPayload(
      tournament({
        tournament_admins: [admin(BigInt('123456789012345678')), admin(BigInt('987654321098765432'))],
      }),
    );

    expect(payload.admins).toEqual(['123456789012345678', '987654321098765432']);
  });

  it('drops admins who have no Discord ID', () => {
    const payload = buildTournamentPayload(
      tournament({ tournament_admins: [admin(null), admin(BigInt('123456789012345678'))] }),
    );

    expect(payload.admins).toEqual(['123456789012345678']);
  });

  it('sends an empty list when no admin has a Discord ID', () => {
    const payload = buildTournamentPayload(tournament({ tournament_admins: [admin(null)] }));

    expect(payload.admins).toEqual([]);
  });
});
