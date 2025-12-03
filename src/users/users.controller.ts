import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayloadDto } from '../auth/dto/auth.dto';
import { Public } from '../auth/decorators/public.decorator';
import {
  GetUsersQueryDto,
  UsersListResponse,
  UserDetailDto,
  UserDto,
  CreateUserDto,
  UpdateUserDto,
  UpdatePasswordDto,
} from './dto/users.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Public()
  async getUsers(
    @Query() query: GetUsersQueryDto,
    @CurrentUser() user?: JwtPayloadDto,
  ): Promise<UsersListResponse | UserDto[]> {
    try {
      const {
        tournamentId,
        page = '1',
        pageSize = '50',
        search,
        includeEmail,
        // Legacy parameters for backward compatibility
        t: tournament,
        p,
        pso,
      } = query;

      // Use new parameters if available, otherwise fall back to legacy
      const finalTournamentId = tournamentId || tournament;
      const finalPage = page || p || '1';
      const finalPageSize = pageSize || pso || '50';

      // If tournament filter is provided, return users by tournament
      if (finalTournamentId) {
        const users = await this.usersService.getUsersByTournament(finalTournamentId);
        return users;
      }

      // Otherwise return all users with pagination
      const parsedPage = Number(finalPage);
      const parsedPageSize = Number(finalPageSize);

      // Check if user is admin and wants to include email
      const shouldIncludeEmail = includeEmail === 'true' && user && (user.role === 1 || user.role === 2);

      const result = await this.usersService.getAllUsers({
        page: parsedPage,
        pageSize: parsedPageSize,
        search,
        includeEmail: shouldIncludeEmail,
      });

      return result;
    } catch (error) {
      console.error('[Users GET]', error);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @Public()
  async getUserById(
    @Param('id') id: string,
  ): Promise<UserDetailDto> {
    try {
      const userData = await this.usersService.getUserById(id);
      
      if (!userData) {
        throw new HttpException(
          'User not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return userData;
    } catch (error) {
      console.error('[Users GET by ID]', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async updateUser(
    @Body() userData: UpdateUserDto,
    @CurrentUser() user: JwtPayloadDto,
  ) {
    try {
      const result = await this.usersService.updateUser(userData);
      
      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to update user',
          HttpStatus.BAD_REQUEST,
        );
      }

      return { message: 'User updated successfully' };
    } catch (error) {
      console.error('[Users POST]', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put()
  async createUser(
    @Body() userData: CreateUserDto,
    @CurrentUser() user: JwtPayloadDto,
  ) {
    try {
      // Check if user has admin privileges (role_id 1 = SUPERADMIN, 2 = ADMIN)
      if (user.role !== 1 && user.role !== 2) {
        throw new HttpException(
          'Insufficient privileges to create users',
          HttpStatus.FORBIDDEN,
        );
      }

      const result = await this.usersService.createUser(userData);
      
      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to create user',
          HttpStatus.BAD_REQUEST,
        );
      }

      return { message: 'User created successfully' };
    } catch (error) {
      console.error('[Users PUT]', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('update-password')
  async updatePassword(
    @Body() passwordData: UpdatePasswordDto,
    @CurrentUser() user: JwtPayloadDto,
  ) {
    try {
      const result = await this.usersService.updatePassword(user.mail, passwordData);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to update password',
          HttpStatus.BAD_REQUEST,
        );
      }

      return { message: 'Password updated successfully' };
    } catch (error) {
      console.error('[Users POST update-password]', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @Public()
  getHealth() {
    return { status: 'Users API is healthy', timestamp: new Date().toISOString() };
  }
}
