import {
  buildGamePayload,
  buildTournamentPayload,
  FRIENDLY_GAME_TOURNAMENT_ID,
  GamePlayerRow,
  GameRow,
  TournamentRow,
} from './shrkbot.payloads';

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

const player = (overrides: Partial<GamePlayerRow> = {}): GamePlayerRow => ({
  first_name: 'Ada',
  last_name: 'Lovelace',
  discord_user_id: null,
  countries: null,
  ...overrides,
});

const USA_PLAYER_ID = BigInt(11);
const USSR_PLAYER_ID = BigInt(22);

const game = (overrides: Partial<GameRow> = {}): GameRow => ({
  id: BigInt(1024),
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
  users_game_results_usa_player_idTousers: player(),
  users_game_results_ussr_player_idTousers: player({ first_name: 'Grace', last_name: 'Hopper' }),
  ...overrides,
});

describe('buildGamePayload', () => {
  it('names the tournament the game belongs to', () => {
    expect(buildGamePayload(game()).tournament_external_id).toBe('7');
  });

  it('omits the tournament for a friendly game', () => {
    const payload = buildGamePayload(game({ tournament_id: FRIENDLY_GAME_TOURNAMENT_ID }));

    expect(payload).not.toHaveProperty('tournament_external_id');
  });

  it('omits the tournament for a game that belongs to none', () => {
    expect(buildGamePayload(game({ tournament_id: null }))).not.toHaveProperty('tournament_external_id');
  });

  it('translates a USA win', () => {
    expect(buildGamePayload(game({ game_winner: '1' })).winning_side).toBe('usa');
  });

  it('translates a USSR win', () => {
    expect(buildGamePayload(game({ game_winner: '2' })).winning_side).toBe('ussr');
  });

  it('translates a tie', () => {
    expect(buildGamePayload(game({ game_winner: '3' })).winning_side).toBe('tie');
  });

  it('sends both dates as ISO 8601', () => {
    const payload = buildGamePayload(game());

    expect(payload.game_date).toBe('2026-07-20T00:00:00.000Z');
    expect(payload.reported_at).toBe('2026-07-24T10:00:00.000Z');
  });

  it('sends the winning turn as a number', () => {
    expect(buildGamePayload(game()).winning_turn).toBe(6);
  });

  it('omits the winning turn when the game does not record one', () => {
    expect(buildGamePayload(game({ end_turn: null }))).not.toHaveProperty('winning_turn');
  });

  it('omits a winning turn that is outside the turns of a game', () => {
    expect(buildGamePayload(game({ end_turn: 12 }))).not.toHaveProperty('winning_turn');
    expect(buildGamePayload(game({ end_turn: 0 }))).not.toHaveProperty('winning_turn');
  });

  it('sends the end mode as the winning method', () => {
    expect(buildGamePayload(game()).winning_method).toBe('DEFCON');
  });

  it('omits the winning method when the game does not record one', () => {
    expect(buildGamePayload(game({ end_mode: null }))).not.toHaveProperty('winning_method');
  });

  it('shortens a game code and a winning method to the length the contract allows', () => {
    const payload = buildGamePayload(game({ game_code: 'C'.repeat(70), end_mode: 'M'.repeat(70) }));

    expect(payload.game_code).toHaveLength(60);
    expect(payload.winning_method).toHaveLength(60);
  });

  it('sends the recorded video as a single URL', () => {
    const payload = buildGamePayload(game({ video1: 'https://youtu.be/dQw4w9WgXcQ' }));

    expect(payload.video_urls).toEqual(['https://youtu.be/dQw4w9WgXcQ']);
  });

  it('omits the videos when the game has none', () => {
    expect(buildGamePayload(game())).not.toHaveProperty('video_urls');
  });

  it('omits a video that is not a web address, which the contract rejects', () => {
    expect(buildGamePayload(game({ video1: 'ask Juli for the recording' }))).not.toHaveProperty('video_urls');
  });

  it('joins both parts of a player name', () => {
    const payload = buildGamePayload(game());

    expect(payload.usa.name).toBe('Ada Lovelace');
    expect(payload.ussr.name).toBe('Grace Hopper');
  });

  it('sends the part of the name it has', () => {
    const payload = buildGamePayload(game({ users_game_results_usa_player_idTousers: player({ last_name: null }) }));

    expect(payload.usa.name).toBe('Ada');
  });

  it('sends the flag of the player country', () => {
    const payload = buildGamePayload(
      game({ users_game_results_usa_player_idTousers: player({ countries: { tld_code: 'DE' } }) }),
    );

    expect(payload.usa.flag).toBe('🇩🇪');
  });

  it('sends the British flag for the United Kingdom, whose code is not its flag', () => {
    const payload = buildGamePayload(
      game({ users_game_results_usa_player_idTousers: player({ countries: { tld_code: 'UK' } }) }),
    );

    expect(payload.usa.flag).toBe('🇬🇧');
  });

  it('omits the flag for a country the table does not cover', () => {
    const payload = buildGamePayload(
      game({ users_game_results_usa_player_idTousers: player({ countries: { tld_code: 'ZZ' } }) }),
    );

    expect(payload.usa).not.toHaveProperty('flag');
  });

  it('omits the flag for a player who states no country', () => {
    expect(buildGamePayload(game()).usa).not.toHaveProperty('flag');
  });

  it('sends the player Discord ID as a string', () => {
    const payload = buildGamePayload(
      game({ users_game_results_usa_player_idTousers: player({ discord_user_id: BigInt('123456789012345678') }) }),
    );

    expect(payload.usa.discord_id).toBe('123456789012345678');
  });

  it('omits the Discord ID of a player who has not given one', () => {
    expect(buildGamePayload(game()).usa).not.toHaveProperty('discord_id');
  });

  it('sends the rating each player held before the game', () => {
    const payload = buildGamePayload(game());

    expect(payload.usa.rating_before).toBe(5578);
    expect(payload.ussr.rating_before).toBe(5824);
  });

  it('sends the rating each player holds after the game', () => {
    const payload = buildGamePayload(
      game({
        ratings_history: [
          { player_id: USSR_PLAYER_ID, rating: 5736 },
          { player_id: USA_PLAYER_ID, rating: 5666 },
        ],
      }),
    );

    expect(payload.usa.rating_after).toBe(5666);
    expect(payload.ussr.rating_after).toBe(5736);
  });

  it('omits the later rating of a player who has no rating row for this game', () => {
    const payload = buildGamePayload(game({ ratings_history: [{ player_id: USA_PLAYER_ID, rating: 5666 }] }));

    expect(payload.ussr).not.toHaveProperty('rating_after');
  });

  it('omits a rating of zero, which means the column was never written', () => {
    const payload = buildGamePayload(
      game({ usa_previous_rating: 0, ratings_history: [{ player_id: USA_PLAYER_ID, rating: 0 }] }),
    );

    expect(payload.usa).not.toHaveProperty('rating_before');
    expect(payload.usa).not.toHaveProperty('rating_after');
  });
});
