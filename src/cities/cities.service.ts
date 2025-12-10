import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CityDto } from './dto/cities.dto';

@Injectable()
export class CitiesService {
  constructor(private databaseService: DatabaseService) {}

  async getCities(searchQuery?: string): Promise<CityDto[]> {
    // If no search query or less than 3 characters, return empty array
    if (!searchQuery || searchQuery.length < 3) {
      return [];
    }

    const cities = await this.databaseService.cities.findMany({
      select: {
        id: true,
        name: true,
        timeZoneId: true,
      },
      where: {
        name: {
          contains: searchQuery,
        },
      },
      orderBy: {
        name: 'asc',
      },
      take: 50, // Limit results to prevent too many suggestions
    });

    return cities.map(city => ({
      id: city.id.toString(),
      name: `${city.name} - ${city.timeZoneId}`,
    }));
  }
}
