export interface ScheduleDto {
  id: string;
  gameWinner: string | null;
  gameDate: string | null;
  dueDate: string;
  randomSides?: boolean;
  bestOf?: number | null
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
  tournamentId?: string;
  userId?: string; // view another user's schedule
  fullSchedule?: boolean; // view full tournament schedule
  page?: string;
  pageSize?: string;
}

export interface CreateScheduleDto {
  scheduleId?: number; // existing schedule ID — if present, updates instead of creating
  usa: string; // USA player ID
  ussr: string; // USSR player ID
  t: number; // tournament ID
  d: Date; // due date
  r: boolean; // is random
  gc: string; // game code
  randomSides?: boolean; // random sides
  best_of?: 1 | 3 | 5 | 7 | null;
}

export interface CsvScheduleRow {
  due_date: string;
  game_code: string;
  usa_player_id: string;
  ussr_player_id: string;
  random?: 1 | 0
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
  best_of: number | null;
}

export interface ScheduleListResponse {
  results: ScheduleDto[];
  totalRows: number;
  currentPage: number;
  totalPages: number;
  userTournaments?: any[];
  defaultTournament?: string;
}
