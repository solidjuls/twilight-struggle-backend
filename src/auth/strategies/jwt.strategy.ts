import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayloadDto } from '../dto/auth.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: (req: Request) => {
        // Extract JWT from HTTP-only cookie
        let token = null;
        if (req && req.cookies) {
          token = req.cookies['token'];
        }
        return token;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayloadDto): Promise<JwtPayloadDto> {
    if (!payload) {
      throw new UnauthorizedException('Invalid token payload');
    }
    
    return {
      mail: payload.mail,
      name: payload.name,
      role: payload.role,
      id: payload.id,
      tournamentsAdmin: payload.tournamentsAdmin || [],
      tournamentsRegistered: payload.tournamentsRegistered || [],
    };
  }
}
