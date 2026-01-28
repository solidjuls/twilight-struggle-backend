export interface ScheduleDto {
  id: string;
  gameWinner: string | null;
  gameDate: string | null;
  dueDate: string;
  gameCode: string;
  gameResultsId: string | null;
  nameUsa: string;
  nameUssr: string;
  idUsa: string;
  idUssr: string;
  countryUsa: string | null;
  countryUssr: string | null;
  tournamentName: string;
  tournamentId: string;
}

export interface GetSchedulesQueryDto {
  userId?: string; // User ID to filter schedules
  tournamentId?: string; // Tournament ID to filter schedules
  page?: string; // Page number for pagination
  pageSize?: string; // Number of items per page
  onlyPending?: string; // Filter only pending games (without results) - 'true' or 'false'
  orderBy?: 'dueDate' | 'gameDate' | 'tournamentName'; // Field to order by
  orderDirection?: 'asc' | 'desc'; // Order direction
  noOpponent?: boolean; // Filter games where one of the players is null - 'true' or 'false'

  // Legacy parameters for backward compatibility
  uid?: string; // userId (legacy)
  t?: string; // tournament IDs (comma-separated) (legacy)
  u?: string; // userFilter (legacy)
  p?: string; // page (legacy)
  pso?: string; // pageSize (legacy)
  a?: string; // adminView (1 or 0) (legacy)
}

export interface CreateScheduleDto {
  usa: string; // USA player ID
  ussr: string; // USSR player ID
  t: number; // tournament ID
  d: Date; // due date
  gc: string; // game code
}

export interface CsvScheduleRow {
  due_date: string;
  game_code: string;
  usa_player_id: string;
  ussr_player_id: string;
}

export interface UploadCsvScheduleDto {
  file: CsvScheduleRow[];
  tournament: string;
}

export interface UpdateScheduleDto {
  tournaments_id: number;
  game_code: string;
  usa_player_id: string | null;
  ussr_player_id: string | null;
  due_date: string;
  game_results_id?: bigint | null;
  id: number;
}

export interface ReplacePlayersDto {
  pold: string; // old player ID
  pnew: string; // new player ID
  t: number; // tournament ID
}

export interface DeletePlayerDto {
  u: number; // user ID to delete
  t: number; // tournament ID
}

export interface ValidateScheduleDto {
  usaPlayerId: number;
  id: number;
  ussrPlayerId: number;
  gameCode: string;
  tournamentId: number;
}

export interface ScheduleValidationResult {
  game_results_id: bigint | null;
  id: number;
}

export interface ScheduleUpdateResult {
  id: number;
  tournaments_id: number;
  game_code: string;
  usa_player_id: string | null;
  ussr_player_id: string | null;
  due_date: Date;
  game_results_id: bigint | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface ScheduleListResponse {
  results: ScheduleDto[];
  totalRows: number;
  currentPage: number;
  totalPages: number;
  userTournaments?: any[];
  defaultTournament?: string;
}
