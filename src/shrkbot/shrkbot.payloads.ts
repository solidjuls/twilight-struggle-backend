import { COUNTRY_FLAGS } from './country-flags';

export interface TournamentRow {
  id: number;
  tournament_name: string;
  parent_id: number | null;
  TournamentStatus: { status_name: string } | null;
  tournament_admins: { users: { discord_user_id: bigint | null } | null }[];
}

export interface TournamentPayload {
  name: string;
  parent_external_id?: string;
  status?: string;
  admins: string[];
}

export function buildTournamentPayload(tournament: TournamentRow): TournamentPayload {
  return {
    name: tournament.tournament_name,
    ...(tournament.parent_id && { parent_external_id: String(tournament.parent_id) }),
    ...(tournament.TournamentStatus && { status: tournament.TournamentStatus.status_name }),
    admins: (tournament.tournament_admins || [])
      .map((admin) => admin.users?.discord_user_id)
      .filter((discordUserId) => discordUserId !== null && discordUserId !== undefined)
      .map(String),
  };
}

export interface GamePlayerRow {
  first_name: string | null;
  last_name: string | null;
  discord_user_id: bigint | null;
  countries: { tld_code: string } | null;
}

export interface GameRow {
  id: bigint;
  tournament_id: number | null;
  game_code: string | null;
  game_date: Date | null;
  reported_at: Date;
  game_winner: string;
  end_turn: number | null;
  end_mode: string | null;
  video1: string | null;
  usa_player_id: bigint;
  ussr_player_id: bigint;
  usa_previous_rating: number;
  ussr_previous_rating: number;
  ratings_history: { player_id: bigint; rating: number }[];
  users_game_results_usa_player_idTousers: GamePlayerRow | null;
  users_game_results_ussr_player_idTousers: GamePlayerRow | null;
}

export interface PlayerPayload {
  name: string;
  flag?: string;
  discord_id?: string;
  rating_before?: number;
  rating_after?: number;
}

export interface GamePayload {
  tournament_external_id?: string;
  game_code?: string;
  game_date?: string;
  reported_at: string;
  winning_side: string;
  winning_turn?: number;
  winning_method?: string;
  usa: PlayerPayload;
  ussr: PlayerPayload;
  video_urls?: string[];
}

export const FRIENDLY_GAME_TOURNAMENT_ID = 47;

const WINNING_SIDES: Record<string, string> = { '1': 'usa', '2': 'ussr', '3': 'tie' };
const MAX_TEXT_LENGTH = 60;
const FIRST_TURN = 1;
const LAST_TURN = 11;
const WEB_URL = /^https?:\/\//;

export function buildGamePayload(game: GameRow): GamePayload {
  return {
    ...(isTournamentGame(game.tournament_id) && { tournament_external_id: String(game.tournament_id) }),
    ...(game.game_code && { game_code: truncate(game.game_code) }),
    ...(game.game_date && { game_date: game.game_date.toISOString() }),
    reported_at: game.reported_at.toISOString(),
    winning_side: WINNING_SIDES[game.game_winner],
    ...(isPlayableTurn(game.end_turn) && { winning_turn: game.end_turn as number }),
    ...(game.end_mode && { winning_method: truncate(game.end_mode) }),
    usa: buildPlayerPayload(
      game.users_game_results_usa_player_idTousers,
      game.usa_previous_rating,
      ratingAfter(game, game.usa_player_id),
    ),
    ussr: buildPlayerPayload(
      game.users_game_results_ussr_player_idTousers,
      game.ussr_previous_rating,
      ratingAfter(game, game.ussr_player_id),
    ),
    ...(WEB_URL.test(game.video1 || '') && { video_urls: [game.video1 as string] }),
  };
}

function buildPlayerPayload(player: GamePlayerRow | null, ratingBefore: number, ratingAfter?: number): PlayerPayload {
  const flag = player?.countries && COUNTRY_FLAGS[player.countries.tld_code.toLowerCase()];

  return {
    name: `${player?.first_name || ''} ${player?.last_name || ''}`.trim(),
    ...(flag && { flag }),
    ...(player?.discord_user_id && { discord_id: String(player.discord_user_id) }),
    // The columns default to 0, and the site starts every player well above that,
    // so a 0 means the rating was never written rather than a rating of zero.
    ...(ratingBefore && { rating_before: ratingBefore }),
    ...(ratingAfter && { rating_after: ratingAfter }),
  };
}

function ratingAfter(game: GameRow, playerId: bigint): number | undefined {
  return (game.ratings_history || []).find((rating) => rating.player_id === playerId)?.rating;
}

function isTournamentGame(tournamentId: number | null): boolean {
  return tournamentId !== null && tournamentId !== FRIENDLY_GAME_TOURNAMENT_ID;
}

function isPlayableTurn(turn: number | null): boolean {
  return turn !== null && Number.isInteger(turn) && turn >= FIRST_TURN && turn <= LAST_TURN;
}

function truncate(text: string): string {
  return text.slice(0, MAX_TEXT_LENGTH);
}
