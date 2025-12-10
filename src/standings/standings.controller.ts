import { Controller, Get, Query } from '@nestjs/common';
import { StandingsService } from './standings.service';
import { StandingsQueryDto, PlayerStandingDto } from './dto/standings.dto';

@Controller('standings')
export class StandingsController {
  constructor(private readonly standingsService: StandingsService) {}

  @Get()
  async getStandings(@Query() query: StandingsQueryDto): Promise<PlayerStandingDto[]> {
    const { id, division } = query;

    if (!id) {
      throw new Error('Tournament ID is required');
    }

    return this.standingsService.getStandings(id, division);
  }

  @Get('health')
  async getHealth(): Promise<{ status: string }> {
    return { status: 'ok' };
  }
}
