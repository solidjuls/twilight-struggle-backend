import { Module } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { ScheduleModule } from '../schedule/schedule.module';
import { DatabaseModule } from '../database/database.module';
import { RatingModule } from '../rating/rating.module';

@Module({
  imports: [DatabaseModule, RatingModule, ScheduleModule],
  controllers: [GamesController],
  providers: [GamesService],
  exports: [GamesService],
})
export class GamesModule {}
