export interface TournamentDto {
  id: string;
  tournament_name: string;
  status_id: number;
  waitlist: boolean;
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
  registeredAt: Date;
  userId?: string;
  name: string;
  countryCode?: string;
}

export interface RegisteredPlayerPublicDto {
  registrationId: number;
  status: string;
  registeredAt: Date;
  userId?: string;
  name: string;
  countryCode?: string;
}

export interface WaitlistPlayerDto {
  waitlistId: number;
  email: string; // Will be empty string for non-admin users
  waitlistedAt: Date;
  userId?: string;
  name: string;
  countryCode?: string;
}

export interface WaitlistPlayerPublicDto {
  waitlistId: number;
  waitlistedAt: Date;
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
  waitlist?: boolean;
  admins?: string;
  startingDate?: Date;
  description?: string;
}

export interface UpdateTournamentDto {
  id: number;
  tournamentName?: string;
  status?: number;
  waitlist?: boolean;
  startingDate?: Date;
  description?: string;
}

export interface RegisterTournamentDto {
  id: number;
  userId: string;
}

export interface AddTournamentAdminDto {
  tournamentId: number;
  userId: string;
}

export interface RemoveTournamentAdminDto {
  tournamentId: number;
  userId: string;
}

export interface TournamentAdminDto {
  userId: string;
  name: string;
  email?: string; // Only for admins viewing
}

export interface UpdateTournamentStatusDto {
  tournamentId: number;
  status: number; // 2=START_REGISTRATION, 3=CLOSE_REGISTRATION, 4=START_TOURNAMENT, 5=CLOSE_TOURNAMENT
}
