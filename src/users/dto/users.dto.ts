export class UserDto {
  id: string;
  name: string;
  countryCode?: string;
  rating?: number;
}

export class UserWithEmailDto extends UserDto {
  email: string;
}

export class UserDetailDto {
  id: string;
  first_name: string;
  last_name: string;
  playdek_name: string;
  email: string;
  discord_user_id?: string;
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

export class GetUsersQueryDto {
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

export class UsersListResponse {
  results: UserDto[];
  totalRows: number;
  currentPage: number;
  totalPages: number;
}

export class CreateUserDto {
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

export class UpdateUserDto {
  firstName?: string;
  lastName?: string;
  playdek_name?: string;
  email: string;
  discord_user_id?: string | null;
  phone?: string;
  preferredGamingPlatform?: string;
  preferredGameDuration?: string;
  city?: number;
  country?: number;
}

export class UpdatePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export class BanUserDto {
  banned: boolean;
}
