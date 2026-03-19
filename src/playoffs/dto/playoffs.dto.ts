export interface PlayoffEntryDto {
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
}

export interface CreatePlayoffBracketResultDto {
  success: boolean;
  message: string;
  bracketEntriesCreated: number;
  schedulesCreated: number;
}

