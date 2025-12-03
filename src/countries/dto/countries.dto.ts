export interface CountryDto {
  id: string;
  country_name: string;
  tld_code: string;
}

export interface GetCountriesQueryDto {
  q?: string; // Search query (minimum 3 characters)
}
