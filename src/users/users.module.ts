import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DatabaseModule } from '../database/database.module';
import { ShrkbotModule } from '../shrkbot/shrkbot.module';

@Module({
  imports: [DatabaseModule, ShrkbotModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
