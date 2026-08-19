import { Module } from '@nestjs/common';
import { ShrkbotService } from './shrkbot.service';

@Module({
  providers: [ShrkbotService],
  exports: [ShrkbotService],
})
export class ShrkbotModule {}
