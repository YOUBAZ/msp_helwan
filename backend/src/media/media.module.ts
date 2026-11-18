import { Module } from '@nestjs/common';
import {
  AdminMediaController,
  PublicMediaController,
} from './media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [PublicMediaController, AdminMediaController],
  providers: [MediaService],
})
export class MediaModule {}
