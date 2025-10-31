import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayloadDto } from '../dto/auth.dto';

// Decorator to mark routes as public (no authentication required)
export const Public = () => SetMetadata('isPublic', true);

// Decorator to specify required roles
export const Roles = (...roles: number[]) => SetMetadata('roles', roles);

// Decorator to get current user from request
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtPayloadDto => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Role constants for better readability
export const USER_ROLES = {
  SUPERADMIN: 1,
  ADMIN: 2,
  PLAYER: 3,
} as const;
