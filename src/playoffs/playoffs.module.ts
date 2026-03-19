import { Module } from '@nestjs/common';
import { PlayoffsController } from './playoffs.controller';
import { PlayoffsService } from './playoffs.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PlayoffsController],
  providers: [PlayoffsService],
  exports: [PlayoffsService],
})
export class PlayoffsModule {}

