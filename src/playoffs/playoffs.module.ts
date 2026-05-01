import { Module } from '@nestjs/common';
import { PlayoffsController } from './playoffs.controller';
import { PlayoffsService } from './playoffs.service';
import { DatabaseModule } from '../database/database.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { TournamentsModule } from 'src/tournaments/tournaments.module';

@Module({
  imports: [DatabaseModule, ScheduleModule, EmailModule, UsersModule, TournamentsModule],
  controllers: [PlayoffsController],
  providers: [PlayoffsService],
  exports: [PlayoffsService],
})
export class PlayoffsModule {}

