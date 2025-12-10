import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayloadDto } from '../dto/auth.dto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        // Extract JWT from HTTP-only cookie
        let token = null;
        if (req && req.cookies) {
          token = req.cookies['token'];
        }
        console.log('JWT extraction:', {
          hasCookies: !!req?.cookies,
          hasToken: !!token,
          cookieKeys: req?.cookies ? Object.keys(req.cookies) : []
        });
        return token;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayloadDto): Promise<JwtPayloadDto> {
    console.log('JWT validate called with payload:', payload);

    if (!payload) {
      console.log('JWT validate: No payload');
      throw new UnauthorizedException('Invalid token payload');
    }

    try {
      // Check if user still exists and email is verified
      const user = await this.databaseService.users.findFirst({
        where: {
          email: payload.mail,
          id: BigInt(payload.id)
        },
        select: {
          id: true,
          email: true,
          email_verified_at: true,
          first_name: true,
          role_id: true,
          banned: true
        }
      });

      console.log('JWT validate: User lookup result:', user ? 'found' : 'not found');

      if (!user) {
        throw new UnauthorizedException({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
          error: 'The user associated with this token no longer exists.'
        });
      }

      // Check if email is still verified
      if (!user.email_verified_at) {
        throw new UnauthorizedException({
          message: 'Email not verified',
          code: 'EMAIL_NOT_VERIFIED',
          error: 'Your email address is not verified. Please verify your email to continue using the application.'
        });
      }

      // Check if user is banned (treat as unverified)
      if (user.banned) {
        throw new UnauthorizedException({
          message: 'Email not verified',
          code: 'EMAIL_NOT_VERIFIED',
          error: 'Your email address is not verified. Please verify your email to continue using the application.'
        });
      }

      return {
        mail: payload.mail,
        name: payload.name,
        role: payload.role,
        id: payload.id,
      };
    } catch (error) {
      console.error('JWT validate error:', error);
      throw error;
    }
  }
}
