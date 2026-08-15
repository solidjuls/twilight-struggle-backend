export class PlayoffEntryDto {
  id?: number;
  tournamentId: number;
  nextSquare: string;
  playoffSquare: string;
  userId: number | null;
  seed: number;
}

export class PlayoffBracketResponseDto {
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

export class CreatePlayoffBracketResultDto {
  success: boolean;
  message: string;
  bracketEntriesCreated: number;
  schedulesCreated: number;
}

export class PlayoffSummaryDto {
  id: number;
  name: string;
}

export class CreatePlayoffScheduleDto {
  usaPlayerId: string;
  ussrPlayerId: string;
  usaSeed: string;
  ussrSeed: string;
  randomSides: boolean;
  tournamentId: number;
  tournamentName: string;
  gameCode: string;
  due_date: Date;
  bo: string;
}

export class CreatePlayoffScheduleResultDto {
  success: boolean;
  message: string;
  scheduleId?: number;
  emailSent?: boolean;
}

export class UpdatePlayoffBracketResultDto {
  success: boolean;
  message: string;
  updatedEntries: number;
}

export class UpdatePlayoffWinnerDto {
  id: number;
  winnerUserId: boolean;
}

export class UpdatePlayoffWinnerResultDto {
  success: boolean;
  message: string;
}
