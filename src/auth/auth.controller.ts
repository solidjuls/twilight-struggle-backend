import { Controller, Post, Body, Res, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, ResetPasswordDto, CreateUserDto, RegisterUserDto } from './dto/auth.dto';
import { Public, CurrentUser } from './decorators/auth.decorators';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { user, token } = await this.authService.login(loginDto);

    // Set HTTP-only cookie
    response.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 8640000, // 100 days in seconds
      path: '/',
    });

    return user;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) response: Response) {
    // Clear the token cookie
    response.cookie('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      expires: new Date(0),
      path: '/',
    });

    return { success: true };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterUserDto) {
    return await this.authService.registerUser(registerDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return {
      id: user.id,
      email: user.mail,
      name: user.name,
      role: user.role,
      tournamentsAdmin: user.tournamentsAdmin,
      tournamentsRegistered: user.tournamentsRegistered,
    };
  }

  @Public()
  @Post('reset-password-request')
  @HttpCode(HttpStatus.OK)
  async resetPasswordRequest(@Body() body: { mail: string }) {
    return this.authService.resetPasswordRequest(body.mail);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const { token, pwd, mail } = resetPasswordDto;

    if (token && pwd) {
      return this.authService.resetPassword(token, pwd);
    } else if (mail) {
      return this.authService.resetPasswordRequest(mail);
    }

    return { success: false };
  }

  @Public()
  @Post('create-user')
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.authService.createUser(createUserDto);
  }

  @Public()
  @Get('health')
  async healthCheck() {
    return {
      status: 'ok',
      service: 'auth',
      timestamp: new Date().toISOString(),
    };
  }
}
