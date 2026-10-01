import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayloadDto } from '../dto/auth.dto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayloadDto): Promise<JwtPayloadDto> {
    if (!payload) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Check if user still exists
    const user = await this.databaseService.users.findFirst({
      where: {
        email: payload.mail,
        id: BigInt(payload.id)
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        role_id: true
      }
    });

    if (!user) {
      throw new UnauthorizedException({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
        error: 'The user associated with this token no longer exists.'
      });
    }

    return {
      mail: payload.mail,
      name: payload.name,
      role: payload.role,
      id: payload.id,
    };
  }
}
