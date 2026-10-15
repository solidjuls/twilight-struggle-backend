import { Module } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { ScheduleModule } from '../schedule/schedule.module';
import { PlayoffsModule } from '../playoffs/playoffs.module';
import { DatabaseModule } from '../database/database.module';
import { RatingModule } from '../rating/rating.module';
import { UsersModule } from 'src/users/users.module';
import { EmailModule } from 'src/email/email.module';
import { ShrkbotModule } from 'src/shrkbot/shrkbot.module';
import { TournamentsModule } from 'src/tournaments/tournaments.module';

@Module({
  imports: [DatabaseModule, RatingModule, ScheduleModule, PlayoffsModule, EmailModule, UsersModule, ShrkbotModule, TournamentsModule],
  controllers: [GamesController],
  providers: [GamesService],
  exports: [GamesService],
})
export class GamesModule {}
