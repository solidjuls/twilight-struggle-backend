import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TournamentDto, RegisteredPlayerDto } from './dto/tournament.dto';
import { ScheduleDto } from 'src/schedule/dto/schedule.dto';

@Injectable()
export class TournamentsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getTournamentsByStatus(statusArray: string[]): Promise<TournamentDto[]> {
    const filter = statusArray.length > 0
      ? {
          where: {
            status_id: {
              in: statusArray.map(Number)
            }
          },
        }
      : undefined;

    const tournaments = await this.databaseService.tournaments.findMany({
      select: {
        id: true,
        tournament_name: true,
        status_id: true,
        waitlist: true,
        starting_date: true,
        description: true,
        created_at: true,
        updated_at: true,
        tournament_admins: {
          select: {
            users: {
              select: {
                id: true,
                first_name: true,
                last_name: true
              }
            }
          }
        }
      },
      ...filter,
      orderBy: {
        created_at: "desc",
      },
    });

    return tournaments.map(item => ({
      id: item.id.toString(),
      tournament_name: item.tournament_name,
      status_id: item.status_id,
      waitlist: item.waitlist,
      starting_date: item.starting_date,
      description: item.description,
      created_at: item.created_at,
      updated_at: item.updated_at,
      adminId: item.tournament_admins?.map(admin => admin.users.id.toString()) || [],
      adminName: item.tournament_admins?.map(admin => `${admin.users.first_name} ${admin.users.last_name}`) || []
    }));
  }

  async getTournamentsById(ids: string[]): Promise<TournamentDto[]> {
    const tournaments = await this.databaseService.tournaments.findMany({
      select: {
        id: true,
        tournament_name: true,
        status_id: true,
        waitlist: true,
        description: true,
        starting_date: true,
        created_at: true,
        updated_at: true,
        tournament_admins: {
          select: {
            users: {
              select: {
                id: true,
                first_name: true,
                last_name: true
              }
            }
          }
        }
      },
      where: {
        id: {
          in: ids.map(Number),
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return tournaments.map(item => ({
      id: item.id.toString(),
      tournament_name: item.tournament_name,
      description: item.description,
      status_id: item.status_id,
      waitlist: item.waitlist,
      starting_date: item.starting_date,
      created_at: item.created_at,
      updated_at: item.updated_at,
      adminId: item.tournament_admins?.map(admin => admin.users.id.toString()) || [],
      adminName: item.tournament_admins?.map(admin => `${admin.users.first_name} ${admin.users.last_name}`) || []
    }));
  }

  async getRegisteredPlayers(
    tournamentId: number,
    userRole?: number,
    userId?: string
  ): Promise<RegisteredPlayerDto[]> {
    const registrations = await this.databaseService.tournament_registration.findMany({
      where: {
        tournamentId: tournamentId,
      },
      select: {
        id: true,
        userId: true,
        created_at: true,
        users: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            phone_number: true,
            playdek_name: true,
            countries: {
              select: {
                tld_code: true,
              },
            },
          },
        },
      }
    });

    const isAdmin = await this.isUserAdminForTournament(userRole, userId, tournamentId);

    return registrations.map(registration => {
      const user = registration.users;
      return {
        registrationId: registration.id,
        email: isAdmin ? (user?.email || '') : '',
        phoneNumber: isAdmin ? (user?.phone_number || '') : '',
        playdekName: user?.playdek_name,
        registeredAt: registration.created_at || new Date(),
        userId: user?.id?.toString(),
        name: user ? `${user.first_name} ${user.last_name}` : 'Unknown User',
        countryCode: user?.countries?.tld_code,
      };
    });
  }

  async isUserAdminForTournament(userRole?: number, userId?: string, tournamentId?: number): Promise<boolean> {
    // Check if user is tournament-specific admin
    if (userId && tournamentId) {
      try {
        const adminRecord = await this.databaseService.tournament_admins.findFirst({
          where: {
            userId: BigInt(userId),
            tournamentId: tournamentId,
          },
        });

        return !!adminRecord;
      } catch (error) {
        console.error('Error checking tournament admin:', error);
        return false;
      }
    }

    return false;
  }

  async createTournament(tournamentData: {
    tournamentName: string;
    status: number;
    waitlist?: boolean;
    admins?: number;
    startingDate?: Date;
    description?: string;
  }): Promise<any> {
    const { tournamentName, status, waitlist, admins, startingDate, description } = tournamentData;

    // Create the tournament
    const newTournament = await this.databaseService.tournaments.create({
      data: {
        tournament_name: tournamentName,
        status_id: Number(status),
        waitlist: waitlist || false,
        starting_date: startingDate || null,
        description: description || null,
      },
    });

    // Add admin if provided
    if (admins) {
      await this.databaseService.tournament_admins.create({
        data: {
          tournamentId: newTournament.id,
          userId: admins
        }
      });
      await this.databaseService.tournament_registration.create({
        data: {
          tournamentId: newTournament.id,
          userId: admins
        }
      });
    }

    return newTournament;
  }

  async updateTournament(id: number, status: number): Promise<any> {
    return await this.databaseService.tournaments.update({
      where: {
        id: id,
      },
      data: {
        status_id: Number(status),
      },
    });
  }

  async updateTournamentFull(id: number, updateData: {
    tournamentName?: string;
    status?: number;
    waitlist?: boolean;
    startingDate?: Date;
    description?: string;
  }): Promise<any> {
    return await this.databaseService.tournaments.update({
      where: {
        id: id,
      },
      data: {
        ...(updateData.tournamentName && { tournament_name: updateData.tournamentName }),
        ...(updateData.status && { status_id: Number(updateData.status) }),
        ...(updateData.waitlist !== undefined && { waitlist: updateData.waitlist }),
        ...(updateData.startingDate && { starting_date: updateData.startingDate }),
        ...(updateData.description !== undefined && { description: updateData.description }),
      },
    });
  }

  async registerForTournament(tournamentId: number, userId: string): Promise<any> {
    return await this.databaseService.tournament_registration.create({
      data: {
        tournamentId: tournamentId,
        userId: BigInt(userId),
        status: 'pending'
      }
    });
  }

  async getUserRegisteredTournaments(userId: string): Promise<TournamentDto[]> {
    const registrations = await this.databaseService.tournament_registration.findMany({
      where: {
        userId: BigInt(userId),
      },
      include: {
        tournaments: {
          include: {
            tournament_admins: {
              include: {
                users: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Map to tournament DTOs
    return registrations.map(registration => {
      const tournament = registration.tournaments;
      return {
        id: tournament.id.toString(),
        tournament_name: tournament.tournament_name,
        status_id: tournament.status_id,
        waitlist: tournament.waitlist,
        starting_date: tournament.starting_date,
        description: tournament.description,
        created_at: tournament.created_at,
        updated_at: tournament.updated_at,
        adminId: tournament.tournament_admins.map(admin => admin.users.id.toString()),
        adminName: tournament.tournament_admins.map(admin =>
          `${admin.users.first_name} ${admin.users.last_name}`
        ),
      };
    });
  }

  async getUserAdminTournaments(userId: string): Promise<TournamentDto[]> {
    // Get tournaments where user is admin
    const adminTournaments = await this.databaseService.tournament_admins.findMany({
      where: {
        userId: BigInt(userId),
        tournaments: {
          status_id: {
            in: [1, 2, 3, 4]
          }
        }
      },
      include: {
        tournaments: {
          include: {
            tournament_admins: {
              include: {
                users: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Map to tournament DTOs
    return adminTournaments.map(adminTournament => {
      const tournament = adminTournament.tournaments;
      return {
        id: tournament.id.toString(),
        tournament_name: tournament.tournament_name,
        status_id: tournament.status_id,
        waitlist: tournament.waitlist,
        starting_date: tournament.starting_date,
        description: tournament.description,
        created_at: tournament.created_at,
        updated_at: tournament.updated_at,
        adminId: tournament.tournament_admins.map(admin => admin.users.id.toString()),
        adminName: tournament.tournament_admins.map(admin =>
          `${admin.users.first_name} ${admin.users.last_name}`
        ),
      };
    });
  }

  async getUserAvailableTournamentsWithSchedule(userId: string): Promise<{
    tournaments: TournamentDto[];
    defaultSchedule: any;
    isAdmin: boolean;
  }> {
    const tournaments: TournamentDto[] = [];
    let isAdmin = false;

    // Get tournaments where user is registered (status: open = 1)
    const registrations = await this.databaseService.tournament_registration.findMany({
      where: {
        userId: BigInt(userId),
        tournaments: {
          status_id: {
            in: [2, 3, 4]
          }
        }
      },
      include: {
        tournaments: {
          include: {
            tournament_admins: {
              include: {
                users: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Add registered open tournaments
    tournaments.push(...registrations.map(registration => {
      const tournament = registration.tournaments;
      return {
        id: tournament.id.toString(),
        tournament_name: tournament.tournament_name,
        status_id: tournament.status_id,
        waitlist: tournament.waitlist,
        starting_date: tournament.starting_date,
        description: tournament.description,
        created_at: tournament.created_at,
        updated_at: tournament.updated_at,
        adminId: tournament.tournament_admins.map(admin => admin.users.id.toString()),
        adminName: tournament.tournament_admins.map(admin =>
          `${admin.users.first_name} ${admin.users.last_name}`
        ),
      };
    }));

    // Get default schedule for first tournament if available
    let defaultSchedule = null;
    if (tournaments.length > 0) {
      const firstTournamentId = tournaments[0].id;

      // Get schedule for first tournament
      const scheduleResults = await this.databaseService.schedule.findMany({
        where: {
          tournaments_id: parseInt(firstTournamentId),
        },
        include: {
          users_schedule_usa_player_idTousers: {
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
          },
          users_schedule_ussr_player_idTousers: {
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
          },
          tournaments: {
            select: {
              id: true,
              tournament_name: true,
            },
          },
          game_results: {
            select: {
              game_winner: true,
              game_date: true,
            },
          },
        },
        orderBy: {
          due_date: 'asc',
        },
        take: 20, // First page
      });

      const scheduleParsed : ScheduleDto[] = scheduleResults.map(result => ({
        gameWinner: result.game_results?.game_winner || null,
        gameDate: result.game_results?.game_date?.toISOString() || null,
        dueDate: result.due_date.toISOString(),
        gameCode: result.game_code,
        id: result.id.toString(),
        gameResultsId: result.game_results_id?.toString() || null,
        nameUsa: `${result.users_schedule_usa_player_idTousers?.first_name || ''} ${result.users_schedule_usa_player_idTousers?.last_name || ''}`,
        nameUssr: `${result.users_schedule_ussr_player_idTousers?.first_name || ''} ${result.users_schedule_ussr_player_idTousers?.last_name || ''}`,
        idUsa: result.users_schedule_usa_player_idTousers?.id?.toString() || '',
        countryUsa: result.users_schedule_usa_player_idTousers?.countries?.tld_code || null,
        countryUssr: result.users_schedule_ussr_player_idTousers?.countries?.tld_code || null,
        idUssr: result.users_schedule_ussr_player_idTousers?.id?.toString() || '',
        tournamentName: result.tournaments.tournament_name,
        tournamentId: result.tournaments.id.toString()
      }));
console.log("scheduleParsed", scheduleParsed);
      defaultSchedule = {
        results: scheduleParsed,
        totalCount: scheduleResults.length,
        totalPages: Math.ceil(scheduleResults.length / 20),
        currentPage: 1,
      };
    }

    return {
      tournaments,
      defaultSchedule,
      isAdmin,
    };
  }

  async deleteTournament(id: string): Promise<{ id: number }> {
    const deleted = await this.databaseService.tournaments.delete({
      where: {
        id: Number(id),
      },
    });
    return { id: deleted.id };
  }

  async unregisterByRegistrationId(tournamentId: number, registrationId: string): Promise<any> {
    return await this.databaseService.tournament_registration.deleteMany({
      where: {
        tournamentId: tournamentId,
        id: Number(registrationId),
      }
    });
  }

  async unregisterByUserId(tournamentId: number, userId: string): Promise<any> {
    return await this.databaseService.tournament_registration.deleteMany({
      where: {
        tournamentId: tournamentId,
        userId: BigInt(userId),
      }
    });
  }

  async forfeitPlayer(tournamentId: number, registrationId: number): Promise<any> {
    return await this.databaseService.tournament_registration.update({
      where: {
        id: registrationId,
        tournamentId: tournamentId,
      },
      data: {
        status: 'forfeited',
        updated_at: new Date(),
      }
    });
  }

  // Tournament Admin Management Methods
  async getTournamentAdmins(tournamentId: number, requestingUserRole?: number): Promise<any[]> {
    const admins = await this.databaseService.tournament_admins.findMany({
      where: {
        tournamentId: tournamentId,
      },
      include: {
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          }
        }
      }
    });

    // Only include email for global admins
    const includeEmail = requestingUserRole === 1 || requestingUserRole === 2;

    return admins.map(admin => ({
      userId: admin.users.id.toString(),
      name: `${admin.users.first_name} ${admin.users.last_name}`,
      email: includeEmail ? admin.users.email : undefined,
    }));
  }

  async addTournamentAdmin(tournamentId: number, userId: string): Promise<any> {
    // Check if admin relationship already exists
    const existingAdmin = await this.databaseService.tournament_admins.findFirst({
      where: {
        tournamentId: tournamentId,
        userId: BigInt(userId),
      }
    });

    if (existingAdmin) {
      throw new Error('User is already an admin for this tournament');
    }

    return await this.databaseService.tournament_admins.create({
      data: {
        tournamentId: tournamentId,
        userId: BigInt(userId),
      }
    });
  }

  async removeTournamentAdmin(tournamentId: number, userId: string): Promise<any> {
    const result = await this.databaseService.tournament_admins.deleteMany({
      where: {
        tournamentId: tournamentId,
        userId: BigInt(userId),
      }
    });

    if (result.count === 0) {
      throw new Error('Admin relationship not found');
    }

    return result;
  }

  // Waitlist methods
  async getWaitlistPlayers(tournamentId: number, userRole: number, userId: string): Promise<any[]> {
    const waitlistEntries = await this.databaseService.tournament_waitlist.findMany({
      where: {
        tournamentId: tournamentId,
      },
      include: {
        users: {
          include: {
            countries: true,
          }
        }
      },
      orderBy: {
        created_at: 'asc', // First come, first served
      },
    });

    // Check if user is admin (global admin or tournament admin)
    const isAdmin = await this.isUserAdminForTournament(userRole, userId, tournamentId);

    // Map waitlist data with user data
    return waitlistEntries.map(entry => {
      const user = entry.users;
      return {
        waitlistId: entry.id,
        email: isAdmin ? (user?.email || '') : '', // Only include email for admins
        waitlistedAt: entry.created_at || new Date(),
        userId: user?.id?.toString(),
        name: user ? `${user.first_name} ${user.last_name}` : 'Unknown User',
        countryCode: user?.countries?.tld_code,
      };
    });
  }

  async addToWaitlist(tournamentId: number, userId: string): Promise<any> {
    return await this.databaseService.tournament_waitlist.create({
      data: {
        tournamentId: tournamentId,
        userId: BigInt(userId),
      }
    });
  }

  async removeFromWaitlist(tournamentId: number, userId: string): Promise<any> {
    return await this.databaseService.tournament_waitlist.deleteMany({
      where: {
        tournamentId: tournamentId,
        userId: BigInt(userId),
      }
    });
  }

  async removeFromWaitlistById(tournamentId: number, waitlistId: string): Promise<any> {
    return await this.databaseService.tournament_waitlist.deleteMany({
      where: {
        tournamentId: tournamentId,
        id: Number(waitlistId),
      }
    });
  }

  async toggleWaitlist(tournamentId: number): Promise<any> {
    const tournament = await this.databaseService.tournaments.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    return await this.databaseService.tournaments.update({
      where: { id: tournamentId },
      data: { waitlist: !tournament.waitlist },
      select: {
        id: true,
        tournament_name: true,
        waitlist: true,
      },
    });
  }

  async updateTournamentStatus(tournamentId: number, status: number, user: any): Promise<any> {
    // First, verify the tournament exists and user has permission to update it
    const tournament = await this.databaseService.tournaments.findUnique({
      where: { id: tournamentId },
      include: {
        tournament_admins: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Check if user is authorized (superadmin or tournament admin)
    const isSuperAdmin = user.role === 1; // SUPERADMIN role
    const isAdmin = user.role === 2; // ADMIN role
    const isTournamentAdmin = tournament.tournament_admins.some(
      admin => admin.userId.toString() === user.id.toString()
    );

    if (!isSuperAdmin && !isAdmin && !isTournamentAdmin) {
      throw new Error('Unauthorized to update tournament status');
    }

    // Update the tournament status
    const updatedTournament = await this.databaseService.tournaments.update({
      where: { id: tournamentId },
      data: {
        status_id: status,
        updated_at: new Date()
      }
    });

    return {
      success: true,
      message: 'Tournament status updated successfully',
      tournament: {
        id: updatedTournament.id,
        status_id: updatedTournament.status_id,
        updated_at: updatedTournament.updated_at
      }
    };
  }

  async bulkRegisterRandomUsers(tournamentId: number, user: any): Promise<any> {
    // Check if user has permission to perform bulk registration
    const userRole = user.role || 3; // Default to PLAYER if no role
    const isSuperAdmin = userRole === 1; // SUPERADMIN
    const isAdmin = userRole === 2; // ADMIN

    // Check if user is tournament admin
    let isTournamentAdmin = false;
    if (!isSuperAdmin && !isAdmin) {
      const tournamentAdmins = await this.databaseService.tournament_admins.findMany({
        where: {
          tournamentId: tournamentId,
          userId: BigInt(user.id)
        }
      });
      isTournamentAdmin = tournamentAdmins.length > 0;
    }

    if (!isSuperAdmin && !isAdmin && !isTournamentAdmin) {
      throw new Error('Insufficient permissions to perform bulk registration');
    }

    // Check if tournament exists and allows registration
    const tournament = await this.databaseService.tournaments.findUnique({
      where: { id: tournamentId }
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Check if tournament allows registration (status_id = 2)
    if (tournament.status_id !== 2) {
      throw new Error('Tournament is not open for registration');
    }

    // Generate 192 random unique user IDs from 1600-2800 (16 standings × 12 users each)
    const minUserId = 1600;
    const maxUserId = 2800;
    const usersToRegister = 192; // 16 standings × 12 users each
    const totalUsers = maxUserId - minUserId + 1;

    const selectedUserIds = new Set<number>();
    while (selectedUserIds.size < usersToRegister) {
      const randomId = Math.floor(Math.random() * totalUsers) + minUserId;
      selectedUserIds.add(randomId);
    }

    console.log(`🎯 Generated ${selectedUserIds.size} random user IDs for tournament ${tournamentId}:`);
    console.log('Selected User IDs:', Array.from(selectedUserIds).sort((a, b) => a - b));

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const registeredUserIds: number[] = [];

    // Register users one by one
    for (const userId of selectedUserIds) {
      try {
        // Check if user exists
        const userExists = await this.databaseService.users.findUnique({
          where: { id: BigInt(userId) }
        });

        if (!userExists) {
          errorCount++;
          errors.push(`User ${userId} does not exist`);
          continue;
        }

        // Check if user is already registered
        const existingRegistration = await this.databaseService.tournament_registration.findFirst({
          where: {
            tournamentId: tournamentId,
            userId: BigInt(userId)
          }
        });

        if (existingRegistration) {
          errorCount++;
          errors.push(`User ${userId} is already registered`);
          continue;
        }

        // Register the user
        await this.databaseService.tournament_registration.create({
          data: {
            tournamentId: tournamentId,
            userId: BigInt(userId),
            status: 'accepted',
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        registeredUserIds.push(userId);
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Failed to register user ${userId}: ${error.message}`);
      }
    }

    console.log(`✅ Successfully registered ${successCount} users out of ${usersToRegister} attempted:`);
    console.log('Registered User IDs:', registeredUserIds.sort((a, b) => a - b));

    // Create standings and conferences structure
    let standingsCreated = 0;
    let standingPlayersCreated = 0;
    const standingErrors: string[] = [];

    // if (registeredUserIds.length >= 192) {
      try {
        // Create 16 standings: 8 for Conference 1, 8 for Conference 2
        const standingIds: number[] = [];

        console.log(`🏆 Creating 16 standings for tournament ${tournamentId}...`);

        for (let conference = 1; conference <= 2; conference++) {
          for (let standing = 1; standing <= 8; standing++) {
            const standingNumber = (conference - 1) * 8 + standing;

            try {
              const createdStanding = await this.databaseService.standings.create({
                data: {
                  tournaments_id: tournamentId,
                  standing_name: `Standing ${standingNumber}`,
                  secondary_name: `Conference ${conference}`
                }
              });

              standingIds.push(createdStanding.id);
              standingsCreated++;
              console.log(`✅ Created Standing ${standingNumber} (Conference ${conference}) with ID: ${createdStanding.id}`);
            } catch (error) {
              standingErrors.push(`Failed to create Standing ${standingNumber}: ${error.message}`);
              console.log(`❌ Failed to create Standing ${standingNumber}: ${error.message}`);
            }
          }
        }

        console.log(`🏆 Created ${standingsCreated} standings with IDs:`, standingIds);

        // Assign 12 users to each standing
        const shuffledUsers = [...registeredUserIds].sort(() => Math.random() - 0.5);

        console.log(`👥 Assigning ${shuffledUsers.length} users to ${standingIds.length} standings (12 users per standing)...`);
        console.log('Shuffled User Order:', shuffledUsers);

        for (let i = 0; i < standingIds.length && i < 16; i++) {
          const standingId = standingIds[i];
          const startIndex = i * 12;
          const endIndex = Math.min(startIndex + 12, shuffledUsers.length);
          const usersForStanding = shuffledUsers.slice(startIndex, endIndex);

          console.log(`📋 Assigning ${usersForStanding.length} users to Standing ID ${standingId}:`, usersForStanding);

          for (const userId of usersForStanding) {
            try {
              await this.databaseService.standing_players.create({
                data: {
                  standing_id: standingId,
                  user_id: BigInt(userId)
                }
              });
              standingPlayersCreated++;
            } catch (error) {
              standingErrors.push(`Failed to assign user ${userId} to standing ${standingId}: ${error.message}`);
              console.log(`❌ Failed to assign user ${userId} to standing ${standingId}: ${error.message}`);
            }
          }
        }

        console.log(`✅ Successfully assigned ${standingPlayersCreated} players to standings`);
      } catch (error) {
        standingErrors.push(`Failed to create standings structure: ${error.message}`);
      }
    // }

    console.log(`🎉 BULK REGISTRATION SUMMARY for Tournament ${tournamentId}:`);
    console.log(`   📊 Users: ${successCount}/${usersToRegister} registered successfully`);
    console.log(`   🏆 Standings: ${standingsCreated}/16 created successfully`);
    console.log(`   👥 Player Assignments: ${standingPlayersCreated}/192 assigned successfully`);
    console.log(`   ❌ Total Errors: ${errorCount + standingErrors.length}`);

    return {
      totalAttempted: usersToRegister,
      successCount,
      errorCount,
      standingsCreated,
      standingPlayersCreated,
      errors: [...errors, ...standingErrors].slice(0, 15) // Return first 15 errors to avoid huge response
    };
  }

  async generateRandomSchedule(tournamentId: number, user: any): Promise<any> {
    // Check if user has permission to generate schedule
    const userRole = user.role || 3; // Default to PLAYER if no role
    const isSuperAdmin = userRole === 1; // SUPERADMIN
    const isAdmin = userRole === 2; // ADMIN

    // Check if user is tournament admin
    let isTournamentAdmin = false;
    if (!isSuperAdmin && !isAdmin) {
      const tournamentAdmins = await this.databaseService.tournament_admins.findMany({
        where: {
          tournamentId: tournamentId,
          userId: BigInt(user.id)
        }
      });
      isTournamentAdmin = tournamentAdmins.length > 0;
    }

    if (!isSuperAdmin && !isAdmin && !isTournamentAdmin) {
      throw new Error('Insufficient permissions to generate schedule');
    }

    // Check if tournament exists
    const tournament = await this.databaseService.tournaments.findUnique({
      where: { id: tournamentId }
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Get all registered players for the tournament
    const registeredPlayers = await this.databaseService.tournament_registration.findMany({
      where: {
        tournamentId: tournamentId,
      },
      select: {
        userId: true
      }
    });

    if (registeredPlayers.length < 2) {
      throw new Error('Not enough registered players to generate schedule (minimum 2 required)');
    }

    // Generate 10 random unique pairs
    const playerIds = registeredPlayers.map(p => p.userId);
    const pairs: Array<{ usa_player_id: bigint; ussr_player_id: bigint }> = [];
    const usedPlayers = new Set<string>();

    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loop

    while (pairs.length < 10 && attempts < maxAttempts) {
      attempts++;

      // Pick two random players
      const shuffledPlayers = [...playerIds].sort(() => Math.random() - 0.5);
      let usaPlayer: bigint | null = null;
      let ussrPlayer: bigint | null = null;

      // Find first available player for USA
      for (const playerId of shuffledPlayers) {
        const playerKey = playerId.toString();
        if (!usedPlayers.has(playerKey)) {
          usaPlayer = playerId;
          break;
        }
      }

      // Find second available player for USSR (different from USA player)
      for (const playerId of shuffledPlayers) {
        const playerKey = playerId.toString();
        if (!usedPlayers.has(playerKey) && playerId !== usaPlayer) {
          ussrPlayer = playerId;
          break;
        }
      }

      // If we found both players, add the pair
      if (usaPlayer && ussrPlayer) {
        pairs.push({
          usa_player_id: usaPlayer,
          ussr_player_id: ussrPlayer
        });
        usedPlayers.add(usaPlayer.toString());
        usedPlayers.add(ussrPlayer.toString());
      }

      // If we don't have enough unique players, allow reuse
      if (usedPlayers.size >= playerIds.length && pairs.length < 10) {
        usedPlayers.clear();
      }
    }

    // Generate random due dates (between 1-30 days from now)
    const now = new Date();
    const schedules = pairs.map((pair, index) => {
      const daysFromNow = Math.floor(Math.random() * 30) + 1; // 1-30 days
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + daysFromNow);

      return {
        tournaments_id: tournamentId,
        game_code: `GAME_${tournamentId}_${index + 1}_${Date.now()}`,
        usa_player_id: pair.usa_player_id,
        ussr_player_id: pair.ussr_player_id,
        due_date: dueDate,
        created_at: new Date(),
        updated_at: new Date()
      };
    });

    // Save schedules to database
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const schedule of schedules) {
      try {
        await this.databaseService.schedule.create({
          data: schedule
        });
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Failed to create schedule for game ${schedule.game_code}: ${error.message}`);
      }
    }

    return {
      totalSchedules: schedules.length,
      successCount,
      errorCount,
      errors: errors.slice(0, 5), // Return first 5 errors
      generatedPairs: pairs.length
    };
  }

  async getOngoingTournamentsWithoutSchedule() {
    // Get ongoing tournaments (status_id = 4) that have no scheduled games
    const tournaments = await this.databaseService.tournaments.findMany({
      where: {
        status_id: 4, // Ongoing status
        schedule: {
          none: {} // No scheduled games
        }
      },
      select: {
        id: true,
        tournament_name: true,
        status_id: true,
        created_at: true,
        updated_at: true,
        tournament_admins: {
          select: {
            users: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Transform the data to match the expected Tournament interface
    return tournaments.map(tournament => ({
      id: tournament.id.toString(),
      tournament_name: tournament.tournament_name,
      status_id: tournament.status_id,
      created_at: tournament.created_at,
      updated_at: tournament.updated_at,
      admins: tournament.tournament_admins.map(admin => ({
        id: admin.users.id.toString(),
        name: admin.users.first_name + ' ' + admin.users.last_name,
        email: admin.users.email
      }))
    }));
  }

  async migrateRegistrationUserIds(): Promise<{
    totalRows: number;
    updatedRows: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let updatedRows = 0;

    // Get all tournament_registration rows with player_email using raw SQL
    const registrations = await this.databaseService.$queryRaw<
      Array<{ id: number; player_email: string; userId: bigint | null }>
    >`SELECT id, player_email, userId FROM tournament_registration WHERE player_email IS NOT NULL`;

    const totalRows = registrations.length;
    console.log(`Found ${totalRows} registrations with player_email to migrate`);

    for (const registration of registrations) {
      try {
        const email = registration.player_email;

        if (!email) {
          errors.push(`Registration ${registration.id}: No player_email found`);
          continue;
        }

        // Find the user by email
        const user = await this.databaseService.users.findFirst({
          where: {
            email: email
          },
          select: {
            id: true
          }
        });

        if (!user) {
          errors.push(`Registration ${registration.id}: No user found for email ${email}`);
          continue;
        }

        // Update the userId in tournament_registration
        await this.databaseService.$executeRaw`
          UPDATE tournament_registration
          SET userId = ${user.id}, updated_at = NOW()
          WHERE id = ${registration.id}
        `;

        updatedRows++;
        console.log(`Updated registration ${registration.id}: set userId to ${user.id} (email: ${email})`);
      } catch (error) {
        errors.push(`Registration ${registration.id}: ${error.message}`);
      }
    }

    console.log(`Migration complete: ${updatedRows}/${totalRows} rows updated`);
    return {
      totalRows,
      updatedRows,
      errors: errors.slice(0, 50) // Return first 50 errors
    };
  }

}
