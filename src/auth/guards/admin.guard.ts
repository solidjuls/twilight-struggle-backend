import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayloadDto } from '../dto/auth.dto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: JwtPayloadDto = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user is SUPERADMIN (role 1) or ADMIN (role 2)
    if (user.role === 1 || user.role === 2) {
      return true;
    }

    // For tournament-specific admin checks, check if user is admin of specific tournament
    const tournamentId = request.params?.id || request.query?.id || request.body?.id;
    
    if (tournamentId) {
      const isAdmin = await this.checkTournamentAdmin(user.mail, Number(tournamentId));
      if (isAdmin) {
        return true;
      }
    }

    throw new ForbiddenException('Admin access required');
  }

  private async checkTournamentAdmin(userEmail: string, tournamentId: number): Promise<boolean> {
    try {
      const user = await this.databaseService.users.findFirst({
        where: { email: userEmail },
        select: { id: true },
      });

      if (!user) {
        return false;
      }

      const adminRecord = await this.databaseService.tournament_admins.findFirst({
        where: {
          userId: user.id,
          tournamentId: tournamentId,
        },
      });

      return !!adminRecord;
    } catch (error) {
      console.error('Error checking tournament admin:', error);
      return false;
    }
  }
}
