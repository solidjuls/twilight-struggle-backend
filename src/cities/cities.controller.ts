import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { Public } from '../auth/decorators/public.decorator';
import { CityDto, GetCitiesQueryDto } from './dto/cities.dto';

@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get()
  @Public()
  async getCities(@Query() query: GetCitiesQueryDto): Promise<CityDto[]> {
    try {
      const { q: searchQuery } = query;
      return await this.citiesService.getCities(searchQuery);
    } catch (error) {
      console.error('[Cities GET]', error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @Public()
  getHealth() {
    return { 
      status: 'Cities API is healthy', 
      timestamp: new Date().toISOString() 
    };
  }
}
