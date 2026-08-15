export class LoginDto {
  mail: string;
  pwd: string;
}

export class ImpersonateDto {
  email: string;
}

export class AuthResponseDto {
  name: string;
  email: string;
  id: string;
  role: number;
}

export class JwtPayloadDto {
  mail: string;
  name: string;
  role: number;
  id: string;
  iat?: number;
  exp?: number;
}

export class UserFromTokenDto {
  id: number;
  playdek_name: string;
  mail: string;
  role: number;
}

export class ResetPasswordDto {
  mail?: string;
  token?: string;
  pwd?: string;
  newPassword?: string;
}

export class CreateUserDto {
  email: string;
  password: string;
  playdek_name: string;
  first_name?: string;
  last_name?: string;
  role_id?: number;
}

export class RegisterUserDto {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  playdek_name: string;
  countryId?: string;
  cityId?: string;
  phoneNumber?: string;
  preferredGamingPlatform?: string;
  preferredGameDuration?: string;
}

export class RegisterUserResponse {
  success: boolean;
  message: string;
  user: {
    name: string;
    email: string;
    id: string;
    role: number;
  };
}

export class EmailVerifyRequestDto {
  email: string;
}

export class EmailVerifyConfirmDto {
  token: string;
}

export class EmailVerifyResponse {
  success: boolean;
  message: string;
}
