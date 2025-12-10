import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { CountriesService } from './countries.service';
import { Public } from '../auth/decorators/public.decorator';
import { CountryDto, GetCountriesQueryDto } from './dto/countries.dto';

@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @Public()
  async getCountries(@Query() query: GetCountriesQueryDto): Promise<CountryDto[]> {
    try {
      const { q: searchQuery } = query;
      return await this.countriesService.getCountries(searchQuery);
    } catch (error) {
      console.error('[Countries GET]', error);
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
      status: 'Countries API is healthy', 
      timestamp: new Date().toISOString() 
    };
  }
}
