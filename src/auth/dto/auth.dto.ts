export interface LoginDto {
  mail: string;
  pwd: string;
}

export interface ImpersonateDto {
  email: string;
}

export interface AuthResponseDto {
  name: string;
  email: string;
  id: string;
  role: number;
}

export interface JwtPayloadDto {
  mail: string;
  name: string;
  role: number;
  id: string;
  iat?: number;
  exp?: number;
}

export interface UserFromTokenDto {
  id: number;
  playdek_name: string;
  mail: string;
  role: number;
}

export interface ResetPasswordDto {
  mail?: string;
  token?: string;
  pwd?: string;
  newPassword?: string;
}

export interface EmailVerifyRequestDto {
  email: string;
}

export interface EmailVerifyConfirmDto {
  token: string;
}

export interface EmailVerifyResponse {
  success: boolean;
  message: string;
}
