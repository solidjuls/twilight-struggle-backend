import { Controller, Get, Query } from '@nestjs/common';
import { StandingsService } from './standings.service';
import { StandingsQueryDto, PlayerStandingDto } from './dto/standings.dto';
import { Public } from 'src/auth/decorators/auth.decorators';

@Controller('standings')
export class StandingsController {
  constructor(private readonly standingsService: StandingsService) {}

  @Get()
  @Public()
  async getStandings(@Query() query: StandingsQueryDto): Promise<PlayerStandingDto[]> {
    const { id, division } = query;

    if (!id) {
      throw new Error('Tournament ID is required');
    }

    return this.standingsService.getStandings(id, division);
  }

  @Get('health')
  @Public()
  async getHealth(): Promise<{ status: string }> {
    return { status: 'ok' };
  }
}
