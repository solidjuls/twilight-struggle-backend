export interface UserDto {
  id: string;
  name: string;
  countryCode?: string;
  rating?: number;
}

export interface UserWithEmailDto extends UserDto {
  email: string;
}

export interface UserDetailDto {
  id: string;
  first_name: string;
  last_name: string;
  playdek_name: string;
  email: string;
  phone_number?: string;
  last_login_at?: string;
  preferred_gaming_platform?: string;
  preferred_game_duration?: string;
  timezone_id?: string;
  cities?: {
    id: string;
    name: string;
  };
  countries?: {
    id: string;
    country_name: string;
    tld_code: string;
  };
  rating?: number;
}

export interface GetUsersQueryDto {
  tournamentId?: string;
  page?: string;
  pageSize?: string;
  search?: string;
  includeEmail?: string;

  // Legacy parameters for backward compatibility
  t?: string;
  p?: string;
  pso?: string;
}

export interface UsersListResponse {
  results: UserDto[];
  totalRows: number;
  currentPage: number;
  totalPages: number;
}

export interface CreateUserDto {
  first_name: string;
  last_name: string;
  playdek_name: string;
  email: string;
  phone_number?: string;
  preferredGamingPlatform?: string;
  preferredGameDuration?: string;
  city?: number;
  country?: number;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  playdek_name?: string;
  email: string;
  phone?: string;
  preferredGamingPlatform?: string;
  preferredGameDuration?: string;
  city?: number;
  country?: number;
}

export interface UpdatePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface BanUserDto {
  banned: boolean;
}
