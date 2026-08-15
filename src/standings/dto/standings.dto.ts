export class StandingsQueryDto {
  id: string;
  division?: string;
}

export class PlayerStandingDto {
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
