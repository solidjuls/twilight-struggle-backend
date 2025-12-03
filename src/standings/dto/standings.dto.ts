export interface StandingsQueryDto {
  id: string;
  division?: string;
}

export interface PlayerStandingDto {
  userId: string;
  name: string;
  secondaryName?: string;
  standingName: string;
  tldCode: string;
  gamesWon: number;
  gamesLost: number;
  gamesTied: number;
  winRate: number;
  sos: number;
}
