export class TournamentDto {
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

export class RegisteredPlayerDto {
  registrationId: number;
  email: string;
  registeredAt: Date;
  userId?: string;
  name: string;
  countryCode?: string;
}

export class RegisteredPlayerPublicDto {
  registrationId: number;
  status: string;
  registeredAt: Date;
  userId?: string;
  name: string;
  countryCode?: string;
}

export class WaitlistPlayerDto {
  waitlistId: number;
  email: string; // Will be empty string for non-admin users
  waitlistedAt: Date;
  userId?: string;
  name: string;
  countryCode?: string;
}

export class WaitlistPlayerPublicDto {
  waitlistId: number;
  waitlistedAt: Date;
  userId?: string;
  name: string;
  countryCode?: string;
}

export class GetTournamentsQueryDto {
  id?: string;
  status?: string;
  players?: string;
}

export class CreateTournamentDto {
  tournamentName: string;
  status: number;
  waitlist?: boolean;
  admins?: string;
  startingDate?: Date;
  description?: string;
}

export class UpdateTournamentDto {
  id: number;
  tournamentName?: string;
  status?: number;
  waitlist?: boolean;
  startingDate?: Date;
  description?: string;
}

export class RegisterTournamentDto {
  id: number;
  userId: string;
}

export class AddTournamentAdminDto {
  tournamentId: number;
  userId: string;
}

export class RemoveTournamentAdminDto {
  tournamentId: number;
  userId: string;
}

export class TournamentAdminDto {
  userId: string;
  name: string;
  email?: string; // Only for admins viewing
}

export class UpdateTournamentStatusDto {
  tournamentId: number;
  status: number; // 2=START_REGISTRATION, 3=CLOSE_REGISTRATION, 4=START_TOURNAMENT, 5=CLOSE_TOURNAMENT
}

export class CreateSubtournamentDto {
  tournamentName: string;
  description?: string;
  startingDate?: Date;
}
