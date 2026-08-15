export class CountryDto {
  id: string;
  country_name: string;
  tld_code: string;
}

export class GetCountriesQueryDto {
  q?: string; // Search query (minimum 3 characters)
}
