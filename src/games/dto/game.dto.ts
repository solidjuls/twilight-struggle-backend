export interface GameRatingDto {
  rating: number;
  previousRating: number;
}

export interface GetGameChartQueryDto {
  type: 'winType';
  userId: string;
  fromDate: string;
}

export interface GameDto {
  id: string;
  created_at: Date | null;
  updated_at: Date | null;
  usaPlayerId: string;
  ussrPlayerId: string;
  usaRatingDifference: number;
  ussrRatingDifference: number;
  tournamentId: string;
  game_code: string;
  reported_at: Date;
  gameWinner: string;
  endTurn: number | null;
  endMode: string | null;
  gameDate: Date;
  video1: string | null;
  videoURL: string;
  reporter_id: string | null;
  usaCountryCode: string;
  ussrCountryCode: string;
  usaPlayer: string;
  ussrPlayer: string;
  ratingsUSA: GameRatingDto;
  ratingsUSSR: GameRatingDto;
}

export type GameWinner = "1" | "2" | "3";

export interface SubmitGameDto {
  scheduleId?: string;
  gameWinner: GameWinner;
  gameCode: string;
  tournamentId: string;
  usaPlayerId: string;
  ussrPlayerId: string;
  endTurn: string;
  endMode: string;
  video1?: string;
}

export interface RecreateGameDto {
  oldId: string;
  gameDate: string;
  op: 'delete' | undefined;
  gameWinner: GameWinner;
  gameCode: string;
  tournamentId: string;
  usaPlayerId: string;
  ussrPlayerId: string;
  endTurn: string;
  endMode: string;
  video1?: string;
}

export interface SubmitGameRequestDto {
  data: SubmitGameDto;
}

export interface GetGamesQueryDto {
  id?: string;
  p?: string; // page
  pageSize?: string;
  userFilter?: string; // comma-separated user IDs
  toFilter?: string; // comma-separated tournament IDs
  video?: string; // "true" to filter games with videos
}

export interface GameListResponse {
  results: GameDto[];
  totalRows: number;
}

export interface CreateGameDto {
  usaPlayerId: string;
  ussrPlayerId: string;
  tournamentId: string;
  gameCode: string;
  gameWinner: string;
  endTurn: string;
  endMode: string;
  gameDate: string;
  video1?: string;
}

export interface UpdateGameDto {
  id: string;
  usaPlayerId: string;
  ussrPlayerId: string;
  tournamentId: string;
  gameCode: string;
  gameWinner: string;
  endTurn: string;
  endMode: string;
  gameDate: string;
  video1?: string;
}

export interface GameFilterDto {
  id?: number;
  userFilter?: number[];
  toFilter?: number[];
  video?: boolean;
}
