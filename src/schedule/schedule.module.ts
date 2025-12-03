import { Module } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { DatabaseModule } from '../database/database.module';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [DatabaseModule, TournamentsModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
