export interface TournamentDto {
  id: string;
  tournament_name: string;
  status_id: number;
  starting_date: Date | null;
  adminId: string[];
  adminName: string[];
  description?: string | null;
  created_at?: Date | null;
  updated_at?: Date | null;
}

export interface RegisteredPlayerDto {
  registrationId: number;
  email: string;
  status: string;
  registeredAt: Date;
  userId?: string;
  name: string;
  countryCode?: string;
}

export interface GetTournamentsQueryDto {
  id?: string;
  status?: string;
  players?: string;
}

export interface CreateTournamentDto {
  tournamentName: string;
  status: number;
  admins?: string;
  startingDate?: Date;
  description?: string;
}

export interface UpdateTournamentDto {
  id: number;
  tournamentName?: string;
  status?: number;
  startingDate?: Date;
  description?: string;
}

export interface RegisterTournamentDto {
  id: number;
  userEmail: string;
}
