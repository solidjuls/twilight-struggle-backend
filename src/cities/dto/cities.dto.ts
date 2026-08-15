export class CityDto {
  id: string;
  name: string;
}

export class GetCitiesQueryDto {
  q?: string; // Search query (minimum 3 characters)
}
