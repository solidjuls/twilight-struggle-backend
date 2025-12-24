import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, ImpersonateDto, ResetPasswordDto, CreateUserDto, RegisterUserDto, EmailVerifyRequestDto, EmailVerifyConfirmDto } from './dto/auth.dto';
import { Public, CurrentUser } from './decorators/auth.decorators';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const { user, token } = await this.authService.login(loginDto);

    return { user, token };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    // Token invalidation would be handled client-side by removing the token
    // For server-side invalidation, you would need a token blacklist
    return { success: true };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterUserDto) {
    return await this.authService.registerUser(registerDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('impersonate')
  @HttpCode(HttpStatus.OK)
  async impersonate(@Body() impersonateDto: ImpersonateDto, @CurrentUser() user: any) {
    const { user: impersonatedUser, token } = await this.authService.impersonate(impersonateDto.email, user);

    return { user: impersonatedUser, token };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return {
      id: user.id,
      email: user.mail,
      name: user.name,
      role: user.role,
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
    const { token, pwd, mail, newPassword } = resetPasswordDto;

    const password = newPassword || pwd;
    if (token && password) {
      return this.authService.resetPassword(token, password);
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
  @Post('email-verify')
  @HttpCode(HttpStatus.OK)
  async requestEmailVerification(@Body() body: { email: string }) {
    return this.authService.requestEmailVerification(body.email);
  }

  @Public()
  @Post('email-verify/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmEmailVerification(@Body() body: { token: string }) {
    return this.authService.confirmEmailVerification(body.token);
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
