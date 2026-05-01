export interface PlayoffEntryDto {
  id?: number;
  tournamentId: number;
  nextSquare: string;
  playoffSquare: string;
  userId: number | null;
  seed: number;
}

export interface PlayoffBracketResponseDto {
  id: string;
  tournamentId: string;
  userId: number | null;
  seed: number;
  playoffSquare: string;
  nextSquare: string;
  userName?: string;
  countryCode?: string;
  winnerUserId: boolean;
}

export interface CreatePlayoffBracketResultDto {
  success: boolean;
  message: string;
  bracketEntriesCreated: number;
  schedulesCreated: number;
}

export interface PlayoffSummaryDto {
  id: number;
  name: string;
}

export interface CreatePlayoffScheduleDto {
  usaPlayerId: string;
  ussrPlayerId: string;
  randomSides: boolean;
  tournamentId: number;
  tournamentName: string;
  gameCode: string;
  due_date: Date;
}

export interface CreatePlayoffScheduleResultDto {
  success: boolean;
  message: string;
  scheduleId?: number;
  emailSent?: boolean;
}

export interface UpdatePlayoffBracketResultDto {
  success: boolean;
  message: string;
  updatedEntries: number;
}

export interface UpdatePlayoffWinnerDto {
  id: number;
  winnerUserId: boolean;
}

export interface UpdatePlayoffWinnerResultDto {
  success: boolean;
  message: string;
}
