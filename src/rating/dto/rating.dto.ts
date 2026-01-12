export interface PlayerRatingDto {
  id: string;
  rank: number;
  name: string;
  first_name: string;
  last_name: string;
  countryCode?: string;
  country_name?: string;
  rating: number;
  playdek_name?: string;
}

export interface PlayerRatingHistoryDto {
  userId: string;
  fromDate: number;
}

export interface PlayerRatingListResponse {
  results: PlayerRatingDto[];
  totalRows: number;
  currentPage: number;
  totalPages: number;
}

export interface GetPlayerRatingsQueryDto {
  // Pagination (legacy parameters)
  p?: string; // page
  pso?: string; // page size

  // Pagination (new parameters)
  page?: string; // page number
  pageSize?: string; // page size

  // Filters
  playerFilter?: string; // comma-separated player IDs
  countrySelected?: string; // country ID
  playdeck?: string; // playdek name filter

  // Sorting
  orderDirection?: 'asc' | 'desc';
}
