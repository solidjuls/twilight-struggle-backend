import { Module } from '@nestjs/common';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [TournamentsController],
  providers: [TournamentsService],
  exports: [TournamentsService],
  imports: [UsersModule],
})
export class TournamentsModule {}
