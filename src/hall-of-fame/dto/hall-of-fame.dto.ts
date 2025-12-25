export class HallOfFameQueryDto {
  season?: string;
  league?: string;
}

export class PlayerDto {
  id: string | null;
  name: string;
}

export class HallOfFameEntryDto {
  id: string;
  season: string;
  league_type: string;
  link: string | null;
  players: number | null;
  winner_id: string | null;
  second_id: string | null;
  third_id: string | null;
  flag1: string | null;
  flag2: string | null;
  flag3: string | null;
  winner: PlayerDto | null;
  second: PlayerDto | null;
  third: PlayerDto | null;
}

