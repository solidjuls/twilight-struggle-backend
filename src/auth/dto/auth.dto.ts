export interface LoginDto {
  mail: string;
  pwd: string;
}

export interface AuthResponseDto {
  name: string;
  email: string;
  id: string;
  role: number;
  tournaments: number[];
}

export interface JwtPayloadDto {
  mail: string;
  name: string;
  role: number;
  id: string;
  tournamentsAdmin: number[];
  tournamentsRegistered: number[];
  iat?: number;
  exp?: number;
}

export interface UserFromTokenDto {
  id: number;
  name: string;
  mail: string;
  role: number;
  tournamentsAdmin: number[];
  tournamentsRegistered: number[];
}

export interface ResetPasswordDto {
  mail?: string;
  token?: string;
  pwd?: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  first_name?: string;
  last_name?: string;
  role_id?: number;
}

export interface RegisterUserDto {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

export interface RegisterUserResponse {
  success: boolean;
  message: string;
  user: {
    name: string;
    email: string;
    id: string;
    role: number;
    tournaments: number[];
  };
}
