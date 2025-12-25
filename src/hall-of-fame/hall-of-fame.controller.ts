import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HallOfFameService } from './hall-of-fame.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { HallOfFameQueryDto, HallOfFameEntryDto } from './dto/hall-of-fame.dto';

@Controller('hall-of-fame')
@UseGuards(JwtAuthGuard)
export class HallOfFameController {
  constructor(private readonly hallOfFameService: HallOfFameService) {}

  @Get()
  @Public()
  async getHallOfFame(
    @Query() query: HallOfFameQueryDto,
  ): Promise<HallOfFameEntryDto[]> {
    const { season, league } = query;
    return this.hallOfFameService.getHallOfFame(season, league);
  }
}

