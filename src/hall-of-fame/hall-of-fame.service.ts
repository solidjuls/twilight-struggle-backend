import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { HallOfFameEntryDto, PlayerDto } from './dto/hall-of-fame.dto';

// Hardcoded name overrides for missing users in RTSL
const overrides: Record<string, Partial<{ second: string; third: string }>> = {
  'RTSL-2018': { second: 'Ackbleh' },
  'RTSL-2019-A': { third: 'Siddhartha' },
  'RATS 2021-A': { second: 'Wrathyy' },
};

@Injectable()
export class HallOfFameService {
  constructor(private databaseService: DatabaseService) {}

  async getHallOfFame(season?: string, league?: string): Promise<HallOfFameEntryDto[]> {
    const filter: any = {};

    if (season) filter.season = season;
    if (league) filter.league_type = league;

    const hallOfFame = await this.databaseService.hall_of_fame.findMany({
      where: filter,
      orderBy: { season: 'asc' },
      include: {
        users_hall_of_fame_winner_idTousers: true,
        users_hall_of_fame_second_idTousers: true,
        users_hall_of_fame_third_idTousers: true,
      },
    });

    return hallOfFame.map((entry) => {
      const key = `${entry.league_type}-${entry.season}`;
      const override = overrides[key] || {};

      const winner = entry.users_hall_of_fame_winner_idTousers;
      const second = entry.users_hall_of_fame_second_idTousers;
      const third = entry.users_hall_of_fame_third_idTousers;

      // Build player objects
      const winnerDto: PlayerDto | null =
        winner && winner.id
          ? {
              id: winner.id.toString(),
              name: `${winner.first_name || ''} ${winner.last_name || ''}`.trim(),
            }
          : null;

      const secondDto: PlayerDto | null = override.second
        ? { id: null, name: override.second }
        : second && second.id
        ? {
            id: second.id.toString(),
            name: `${second.first_name || ''} ${second.last_name || ''}`.trim(),
          }
        : null;

      const thirdDto: PlayerDto | null = override.third
        ? { id: null, name: override.third }
        : third && third.id
        ? {
            id: third.id.toString(),
            name: `${third.first_name || ''} ${third.last_name || ''}`.trim(),
          }
        : null;

      return {
        id: entry.id.toString(),
        season: entry.season,
        league_type: entry.league_type,
        link: entry.link,
        players: entry.players,
        winner_id: entry.winner_id ? entry.winner_id.toString() : null,
        second_id: entry.second_id ? entry.second_id.toString() : null,
        third_id: entry.third_id ? entry.third_id.toString() : null,
        flag1: entry.flag1,
        flag2: entry.flag2,
        flag3: entry.flag3,
        winner: winnerDto,
        second: secondDto,
        third: thirdDto,
      };
    });
  }
}

