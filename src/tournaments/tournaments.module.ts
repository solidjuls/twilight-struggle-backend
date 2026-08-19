import { Module } from '@nestjs/common';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { UsersModule } from 'src/users/users.module';
import { ShrkbotModule } from 'src/shrkbot/shrkbot.module';

@Module({
  controllers: [TournamentsController],
  providers: [TournamentsService],
  exports: [TournamentsService],
  imports: [UsersModule, ShrkbotModule],
})
export class TournamentsModule {}
