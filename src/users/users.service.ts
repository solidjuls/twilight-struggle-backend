import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { hash, compare } from 'bcrypt';
import {
  UserDto,
  UserDetailDto,
  UsersListResponse,
  CreateUserDto,
  UpdateUserDto,
  UpdatePasswordDto,
} from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getUserById(id: string): Promise<UserDetailDto | null> {
    const user = await this.databaseService.users.findFirst({
      select: {
        id: true,
        first_name: true,
        last_name: true,
        playdek_name: true,
        email: true,
        phone_number: true,
        last_login_at: true,
        preferred_gaming_platform: true,
        preferred_game_duration: true,
        timezone_id: true,
        cities: {
          select: {
            id: true,
            name: true,
            timeZoneId: true,
          },
        },
        countries: {
          select: {
            id: true,
            country_name: true,
          },
        },
      },
      where: {
        id: Number(id),
      },
    });

    if (!user) return null;

    // Get user rating
    const rating = await this.getUserRating(user.id);

    return {
      id: user.id.toString(),
      first_name: user.first_name,
      last_name: user.last_name,
      playdek_name: user.playdek_name,
      email: user.email,
      phone_number: user.phone_number,
      last_login_at: user.last_login_at?.toISOString(),
      preferred_gaming_platform: user.preferred_gaming_platform,
      preferred_game_duration: user.preferred_game_duration,
      timezone_id: user.timezone_id,
      cities: user.cities ? {
        id: user.cities.id.toString(),
        name: `${user.cities.name} - ${user.cities.timeZoneId}`,
      } : undefined,
      countries: user.countries ? {
        id: user.countries.id.toString(),
        country_name: user.countries.country_name,
      } : undefined,
      rating: rating,
    };
  }

  async getUsersByTournament(tournamentId: string): Promise<UserDto[]> {
    // Get user IDs registered for the tournament (using userId instead of player_email)
    const userIds = await this.databaseService.tournament_registration.findMany({
      select: {
        userId: true,
      },
      where: {
        tournamentId: Number(tournamentId),
      },
    });

    if (userIds.length === 0) {
      return [];
    }

    // Get users by IDs
    const users = await this.databaseService.users.findMany({
      where: {
        id: {
          in: userIds.map(item => item.userId),
        },
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        countries: {
          select: {
            tld_code: true,
          },
        },
      },
    });

    // Map users without rating (rating only available on :id endpoint)
    return users.map((user) => ({
      id: user.id.toString(),
      name: `${user.first_name} ${user.last_name}`,
      countryCode: user.countries?.tld_code,
    }));
  }

  async getAllUsers({
    page = 1,
    pageSize = 50,
    search,
    includeEmail = false,
  }: {
    page?: number;
    pageSize?: number;
    search?: string;
    includeEmail?: boolean;
  } = {}): Promise<UsersListResponse> {
    const skip = (page - 1) * pageSize;

    const where: any = {};

    // Add search filter if provided
    if (search) {
      const trimmedSearch = search.trim();

      // Check if search contains whitespace (indicating first_name + last_name search)
      // if (trimmedSearch.includes(' ')) {
        const searchParts = trimmedSearch.split(/\s+/); // Split by any whitespace
        const firstName = searchParts[0];
        const lastName = searchParts.slice(1).join(' '); // Join remaining parts as last name

        where.OR = [
          // Exact first_name + last_name match
          {
            AND: [
              {
                first_name: {
                  contains: firstName,
                },
              },
              {
                last_name: {
                  contains: lastName,
                },
              },
            ],
          },
          // // Reverse order: last_name + first_name match
          // {
          //   AND: [
          //     {
          //       first_name: {
          //         contains: lastName,
          //         mode: 'insensitive',
          //       },
          //     },
          //     {
          //       last_name: {
          //         contains: firstName,
          //         mode: 'insensitive',
          //       },
          //     },
          //   ],
          // },
          // // Fallback: search entire string in individual fields
          // {
          //   first_name: {
          //     contains: trimmedSearch,
          //     mode: 'insensitive',
          //   },
          // },
          // {
          //   last_name: {
          //     contains: trimmedSearch,
          //     mode: 'insensitive',
          //   },
          // },
          // {
          //   email: {
          //     contains: trimmedSearch,
          //     mode: 'insensitive',
          //   },
          // },
        ];
      // } else {
      //   // Single term search - search in first_name, last_name, and email
      //   where.OR = [
      //     {
      //       first_name: {
      //         contains: trimmedSearch,
      //         mode: 'insensitive',
      //       },
      //     },
      //     {
      //       last_name: {
      //         contains: trimmedSearch,
      //         mode: 'insensitive',
      //       },
      //     },
      //     {
      //       email: {
      //         contains: trimmedSearch,
      //         mode: 'insensitive',
      //       },
      //     },
      //   ];
      // }
    }

    // Get total count
    const totalRows = await this.databaseService.users.count({
      where,
    });

    // Get users
    const users = await this.databaseService.users.findMany({
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: includeEmail,
        countries: {
          select: {
            tld_code: true,
          },
        },
      },
      where,
      skip,
      take: pageSize,
      orderBy: [
        { first_name: 'asc' },
        { last_name: 'asc' },
      ],
    });

    // Map users without rating (rating only available on :id endpoint)
    const mappedUsers = users.map((user) => {
      const result: any = {
        id: user.id.toString(),
        name: `${user.first_name} ${user.last_name}`,
        countryCode: user.countries?.tld_code,
      };

      // Include email if requested and available
      if (includeEmail && user.email) {
        result.email = user.email;
      }

      return result;
    });

    const totalPages = Math.ceil(totalRows / pageSize);

    return {
      results: mappedUsers,
      totalRows,
      currentPage: page,
      totalPages,
    };
  }

  private async getUserRating(userId: bigint): Promise<number | undefined> {
    try {
      // Get the latest rating for the user
      const rating = await this.databaseService.ratings_history.findFirst({
        select: {
          rating: true,
        },
        where: {
          player_id: userId,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      return rating?.rating ? Number(rating.rating) : undefined;
    } catch (error) {
      console.error('Error fetching user rating:', error);
      return undefined;
    }
  }

  async createUser(userData: CreateUserDto): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user already exists
      const existingUser = await this.databaseService.users.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        return { success: false, error: `User with email ${userData.email} already exists` };
      }

      // Create new user
      await this.databaseService.users.create({
        data: {
          first_name: userData.first_name,
          last_name: userData.last_name,
          playdek_name: userData.name,
          email: userData.email,
          phone_number: userData.phone_number,
          preferred_gaming_platform: userData.preferredGamingPlatform,
          preferred_game_duration: userData.preferredGameDuration,
          city_id: userData.city,
          country_id: userData.country,
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error creating user:', error);
      return { success: false, error: 'Failed to create user' };
    }
  }

  async updateUser(userData: UpdateUserDto): Promise<{ success: boolean; error?: string }> {
    try {
      await this.databaseService.users.update({
        where: {
          email: userData.email,
        },
        data: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          playdek_name: userData.name,
          phone_number: userData.phone,
          last_login_at: new Date(),
          preferred_gaming_platform: userData.preferredGamingPlatform,
          preferred_game_duration: userData.preferredGameDuration,
          city_id: userData.city,
          country_id: userData.country,
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, error: 'Failed to update user' };
    }
  }

  async updatePassword(email: string, passwordData: UpdatePasswordDto): Promise<{ success: boolean; error?: string }> {
    try {
      const { currentPassword, newPassword, confirmPassword } = passwordData;

      // Validate password confirmation
      if (newPassword !== confirmPassword) {
        return { success: false, error: 'New passwords do not match' };
      }

      // Get user with current password
      const user = await this.databaseService.users.findUnique({
        where: { email },
        select: { id: true, password: true },
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Verify current password
      const isCurrentPasswordValid = await compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return { success: false, error: 'Current password is incorrect' };
      }

      // Hash new password
      const hashedNewPassword = await hash(newPassword, 12);

      // Update password
      await this.databaseService.users.update({
        where: { email },
        data: { password: hashedNewPassword },
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating password:', error);
      return { success: false, error: 'Failed to update password' };
    }
  }

  async banUser(userId: string, banned: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await this.databaseService.users.findFirst({
        where: { id: BigInt(userId) },
        select: { id: true },
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      await this.databaseService.users.update({
        where: { id: BigInt(userId) },
        data: { banned },
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating user ban status:', error);
      return { success: false, error: 'Failed to update user ban status' };
    }
  }
}
