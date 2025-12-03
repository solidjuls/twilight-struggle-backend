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
  };
  rating?: number;
}

export interface GetUsersQueryDto {
  tournamentId?: string; // Tournament ID to filter users by tournament
  page?: string; // Page number for pagination
  pageSize?: string; // Number of items per page
  search?: string; // Search term for user names
  includeEmail?: string; // Include email in response (admin only)

  // Legacy parameters for backward compatibility
  t?: string; // tournament ID (legacy)
  p?: string; // page (legacy)
  pso?: string; // pageSize (legacy)
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
  name: string;
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
  name?: string;
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
