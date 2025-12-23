import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { EmailService, SMTPConfig } from '../email/email.service';
import { LoginDto, AuthResponseDto, JwtPayloadDto, ResetPasswordDto, CreateUserDto, RegisterUserDto, RegisterUserResponse, EmailVerifyRequestDto, EmailVerifyConfirmDto, EmailVerifyResponse } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async login(loginDto: LoginDto): Promise<{ user: AuthResponseDto; token: string }> {

    const { mail, pwd } = loginDto;

    // Find user by email
    const user = await this.databaseService.users.findFirst({
      where: { email: mail },
    });

    if (!user) {
      throw new UnauthorizedException(
        "User doesn't exist."
      );
    }

    // Check if email is verified
    if (!user.email_verified_at) {
      throw new UnauthorizedException({
        message: 'Email not verified',
        code: 'EMAIL_NOT_VERIFIED',
        error: 'Your email address has not been verified. Please check your email and verify your account before logging in.'
      });
    }

    // Check if user is banned (treat as unverified)
    if (user.banned) {
      throw new UnauthorizedException({
        message: 'Email not verified',
        code: 'EMAIL_NOT_VERIFIED',
        error: 'Your email address has not been verified. Please check your email and verify your account before logging in.'
      });
    }

    if (!user.password) {
      console.log("password")
      throw new UnauthorizedException('The password is incorrect');
    }

    // Verify password
    const isPasswordValid = await compare(pwd, user.password);
    if (!isPasswordValid) {
      console.log("isPasswordValid")
      throw new UnauthorizedException('The password is incorrect');
    }

    return this.generateAuthResponse(user);
  }

  async impersonate(email: string, impersonatorUser: any): Promise<{ user: AuthResponseDto; token: string }> {
    // Check if impersonator is superadmin
    if (impersonatorUser.role !== 1) {
      throw new UnauthorizedException('Only superadmins can impersonate other users');
    }

    // Find user to impersonate by email
    const user = await this.databaseService.users.findFirst({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException("User doesn't exist.");
    }

    // Check if user's email is verified
    if (!user.email_verified_at) {
      throw new UnauthorizedException("Cannot impersonate user: email not verified.");
    }

    // Check if user is banned
    if (user.banned) {
      throw new UnauthorizedException("Cannot impersonate user: user is banned.");
    }

    return this.generateAuthResponse(user);
  }

  private async generateAuthResponse(user: any): Promise<{ user: AuthResponseDto; token: string }> {
    // Create JWT payload
    const payload: JwtPayloadDto = {
      mail: user.email!,
      name: user.first_name!,
      role: user.role_id || 3, // Default to player role if not set
      id: user.id.toString(),
    };

    // Generate JWT token
    const token = this.jwtService.sign(payload, {
      expiresIn: '60d',
    });

    // Prepare response
    const authResponse: AuthResponseDto = {
      name: user.first_name!,
      email: user.email!,
      id: user.id.toString(),
      role: user.role_id || 3,
    };

    return { user: authResponse, token };
  }

  async validateUser(payload: JwtPayloadDto): Promise<JwtPayloadDto | null> {
    // Additional validation can be added here if needed
    // For now, we trust the JWT payload if it's valid
    return payload;
  }

  async resetPasswordRequest(mail: string): Promise<{ success: boolean; message: string }> {
    const user = await this.databaseService.users.findFirst({
      select: { id: true, first_name: true, email: true },
      where: { email: mail },
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      return { success: true, message: 'If an account with this email exists, a password reset email has been sent.' };
    }

    // Generate token for password reset
    const resetToken = this.generateHash(mail);
    const resetUrl = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    // Get SMTP configuration from environment variables
    const smtpConfig: SMTPConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      password: process.env.SMTP_HOST_RESET_PWD || '',
    };

    try {
      const emailSent = await this.emailService.sendPasswordResetEmail(
        mail,
        user.first_name || 'User',
        resetUrl,
        smtpConfig
      );

      if (emailSent) {
        return {
          success: true,
          message: 'Password reset email sent! Please check your inbox.'
        };
      } else {
        return {
          success: false,
          message: 'Failed to send password reset email. Please try again later.'
        };
      }
    } catch (error) {
      console.error('Password reset email error:', error);
      return {
        success: false,
        message: 'Failed to send password reset email. Please try again later.'
      };
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`token`, token);
      const decrypted = this.decryptHash(token);
      const values = decrypted.split('#');

      if (values.length !== 2) {
        return { success: false, message: 'Invalid reset token format' };
      }

      const mail = values[0];
      const timestamp = parseInt(values[1]);

      // Check if token is expired (24 hours)
      const tokenAge = Date.now() - timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

      if (tokenAge > maxAge) {
        return {
          success: false,
          message: 'Password reset link has expired. Please request a new one.'
        };
      }
console.log(`mail`, mail, newPassword);
      // Find user by email
      const user = await this.databaseService.users.findFirst({
        where: { email: mail },
        select: { id: true, email: true }
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found. The reset link may be invalid.'
        };
      }

      // Hash and update password
      const hashedPassword = await hash(newPassword, 12);

      await this.databaseService.users.update({
        where: { email: mail },
        data: { password: hashedPassword },
      });
console.log(`hashedPassword`, hashedPassword);
      console.log(`✅ Password reset successfully for user: ${mail}`);

      return { success: true, message: 'Your password has been successfully reset! You can now log in.' };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, message: 'Invalid or expired reset link. Please request a new one.' };
    }
  }

  private generateHash(mail: string): string {
    // Implement your hash generation logic here
    // This should match your existing implementation
    const timestamp = Date.now();
    const data = `${mail}#${timestamp}`;
    return Buffer.from(data).toString('base64');
  }

  private decryptHash(hash: string): string {
    // Implement your hash decryption logic here
    // This should match your existing implementation
    const buff = Buffer.from(hash, 'base64');
    return buff.toString('ascii');
  }

  async createUser(createUserDto: CreateUserDto): Promise<{ success: boolean; user?: AuthResponseDto }> {
    const { email, password, playdek_name, first_name, last_name, role_id } = createUserDto;

    // Check if user already exists
    const existingUser = await this.databaseService.users.findFirst({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException(`User with email ${email} already exists`);
    }

    // Hash the password
    const hashedPassword = await hash(password, 12);

    // Create the user
    const newUser = await this.databaseService.users.create({
      data: {
        email,
        password: hashedPassword,
        playdek_name: playdek_name,
        first_name: first_name,
        last_name: last_name,
        role_id: role_id || 3,
      },
    });

    // Prepare response
    const userResponse: AuthResponseDto = {
      name: newUser.first_name!,
      email: newUser.email!,
      id: newUser.id.toString(),
      role: newUser.role_id || 3,
    };

    return { success: true, user: userResponse };
  }

  async registerUser(registerDto: RegisterUserDto): Promise<RegisterUserResponse> {
    const {
      email,
      password,
      confirmPassword,
      firstName,
      lastName,
      playdek_name,
      countryId,
      cityId,
      phoneNumber,
      preferredGamingPlatform,
      preferredGameDuration
    } = registerDto;

    // Validate password confirmation
    if (password !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Check if user already exists
    const existingUser = await this.databaseService.users.findFirst({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create user with provided fields and defaults for missing required fields
    const newUser = await this.databaseService.users.create({
      data: {
        email,
        password: hashedPassword,
        playdek_name: playdek_name,
        first_name: firstName,
        last_name: lastName,
        role_id: 3, // Default to player role
        created_at: new Date(),
        updated_at: new Date(),
        // Use provided fields or defaults
        country_id: countryId ? BigInt(countryId) : null,
        city_id: cityId ? BigInt(cityId) : null,
        phone_number: phoneNumber || null,
        preferred_gaming_platform: preferredGamingPlatform || null,
        preferred_game_duration: preferredGameDuration || null,
        // Defaults for other required fields
        timezone_id: null,
        last_login_at: null,
      },
    });

    // Prepare response
    const userResponse: AuthResponseDto = {
      name: firstName,
      email: newUser.email!,
      id: newUser.id.toString(),
      role: newUser.role_id || 3,
    };

    return {
      success: true,
      message: 'User registered successfully',
      user: userResponse
    };
  }

  async requestEmailVerification(email: string): Promise<EmailVerifyResponse> {
    // Find user by email
    const user = await this.databaseService.users.findFirst({
      where: { email },
      select: { id: true, email: true, first_name: true, email_verified_at: true }
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      return {
        success: true,
        message: 'If an account with this email exists, a verification email has been sent.'
      };
    }

    // Check if email is already verified
    if (user.email_verified_at) {
      return {
        success: false,
        message: 'Email is already verified. You can log in to your account.'
      };
    }

    // Generate verification token
    const verificationToken = this.generateEmailVerificationToken(email);
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/email-verify/${verificationToken}`;

    // Get SMTP configuration from environment variables
    const smtpConfig: SMTPConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_VERIFY_USER || '',
      password: process.env.SMTP_VERIFY_PWD || '',
    };

    // Check if SMTP is configured
    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.password) {
      // Fallback to console logging if SMTP is not configured
      console.log('📧 EMAIL VERIFICATION REQUEST (SMTP not configured)');
      console.log('===============================');
      console.log(`To: ${email}`);
      console.log(`Name: ${user.first_name || 'User'}`);
      console.log(`Verification URL: ${verificationUrl}`);
      console.log('===============================');

      return {
        success: true,
        message: 'Verification email sent! Please check your inbox and click the verification link.'
      };
    }

    // Send verification email using email service
    try {
      const emailSent = await this.emailService.sendVerificationEmail(
        email,
        user.first_name || 'User',
        verificationUrl,
        smtpConfig
      );

      if (emailSent) {
        return {
          success: true,
          message: 'Verification email sent! Please check your inbox and click the verification link.'
        };
      } else {
        return {
          success: false,
          message: 'Failed to send verification email. Please try again later.'
        };
      }
    } catch (error) {
      console.error('Email sending error:', error);
      return {
        success: false,
        message: 'Failed to send verification email. Please try again later.'
      };
    }
  }

  async confirmEmailVerification(token: string): Promise<EmailVerifyResponse> {
    try {
      // Decrypt and validate the token
      const decrypted = this.decryptEmailVerificationToken(token);
      const values = decrypted.split('#');

      if (values.length !== 2) {
        throw new BadRequestException('Invalid verification token format');
      }

      const email = values[0];
      const timestamp = parseInt(values[1]);

      // Check if token is expired (24 hours)
      const tokenAge = Date.now() - timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

      if (tokenAge > maxAge) {
        return {
          success: false,
          message: 'Verification link has expired. Please request a new verification email.'
        };
      }

      // Find user by email
      const user = await this.databaseService.users.findFirst({
        where: { email },
        select: { id: true, email: true, email_verified_at: true }
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found. The verification link may be invalid.'
        };
      }

      // Check if already verified
      if (user.email_verified_at) {
        return {
          success: true,
          message: 'Email is already verified. You can log in to your account.'
        };
      }

      // Update email_verified_at field with current timestamp
      await this.databaseService.users.update({
        where: { email },
        data: {
          email_verified_at: new Date().toISOString()
        }
      });

      console.log(`✅ Email verified successfully for user: ${email}`);

      return {
        success: true,
        message: 'Your email has been successfully verified! You can now log in to your account.'
      };

    } catch (error) {
      console.error('Email verification error:', error);
      return {
        success: false,
        message: 'Invalid or expired verification link. Please request a new verification email.'
      };
    }
  }

  private generateEmailVerificationToken(email: string): string {
    const timestamp = Date.now();
    const data = `${email}#${timestamp}`;
    return Buffer.from(data).toString('base64');
  }

  private decryptEmailVerificationToken(token: string): string {
    try {
      return Buffer.from(token, 'base64').toString('utf-8');
    } catch (error) {
      throw new BadRequestException('Invalid verification token format');
    }
  }
}
