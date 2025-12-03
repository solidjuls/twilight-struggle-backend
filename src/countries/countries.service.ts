import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CountryDto } from './dto/countries.dto';

@Injectable()
export class CountriesService {
  constructor(private databaseService: DatabaseService) {}

  async getCountries(searchQuery?: string): Promise<CountryDto[]> {
    let whereClause = {};
    let takeLimit = undefined;

    // If search query is provided and has at least 3 characters, filter by it
    if (searchQuery && searchQuery.length >= 3) {
      whereClause = {
        country_name: {
          contains: searchQuery,
        },
      };
      takeLimit = 50; // Limit results for search to prevent too many suggestions
    }
    // If no search query, return all countries (for dropdowns)
    // If search query is less than 3 characters, return empty array (for typeahead)
    else if (searchQuery && searchQuery.length < 3) {
      return [];
    }

    const countries = await this.databaseService.countries.findMany({
      select: {
        id: true,
        country_name: true,
        tld_code: true,
      },
      where: whereClause,
      orderBy: {
        country_name: 'asc',
      },
      ...(takeLimit && { take: takeLimit }),
    });

    return countries.map(country => ({
      id: country.id.toString(),
      country_name: country.country_name,
      tld_code: country.tld_code,
    }));
  }
}
