import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Auth } from '../access/auth.guard';
import { MoveDto } from '../hierarchy/dto';
import { AddVideoDto, CreateAlbumDto, UpdateAlbumDto } from './dto';
import { MediaService } from './media.service';

/** Public: the Media page. Only published, non-empty albums. */
@Controller('media')
export class PublicMediaController {
  constructor(private readonly media: MediaService) {}

  @Get('albums')
  albums() {
    return this.media.publicAlbums();
  }

  @Get('photos/:id/:variant')
  @SkipThrottle()
  async photo(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variant') variant: string,
    @Query('t') token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const p = await this.media.photo(id, variant, token);
    res.set({
      'Content-Type': p.mime,
      'X-Content-Type-Options': 'nosniff',
      // Public photos may stay cached for up to an hour after removal.
      'Cache-Control':
        p.cache === 'public'
          ? 'public, max-age=3600, s-maxage=3600'
          : 'private, no-store',
    });
    return new StreamableFile(p.data);
  }
}

/** Managing the Media page. Requires the "media.manage" permission. */
@Controller('admin/media')
@Auth('media.manage')
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}

  @Get('albums')
  albums() {
    return this.media.adminAlbums();
  }

  @Get('usage')
  usage() {
    return this.media.usage();
  }

  @Get('categories')
  categories() {
    return this.media.categories();
  }

  @Post('albums')
  create(@Body() dto: CreateAlbumDto) {
    return this.media.createAlbum(dto);
  }

  @Patch('albums/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAlbumDto) {
    return this.media.updateAlbum(id, dto);
  }

  @Post('albums/:id/move')
  @HttpCode(204)
  moveAlbum(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveDto) {
    return this.media.moveAlbum(id, dto.direction);
  }

  @Delete('albums/:id')
  @HttpCode(204)
  deleteAlbum(@Param('id', ParseUUIDPipe) id: string) {
    return this.media.deleteAlbum(id);
  }

  @Post('albums/:id/photos')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'full', maxCount: 1 },
        { name: 'small', maxCount: 1 },
      ],
      { limits: { fileSize: 2 * 1024 * 1024, files: 2 } },
    ),
  )
  addPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles()
    files: { full?: Express.Multer.File[]; small?: Express.Multer.File[] } = {},
  ) {
    return this.media.addPhoto(id, files.full?.[0], files.small?.[0]);
  }

  @Post('albums/:id/videos')
  addVideo(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddVideoDto) {
    return this.media.addVideo(id, dto.url);
  }

  @Post('items/:id/move')
  @HttpCode(204)
  moveItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveDto) {
    return this.media.moveItem(id, dto.direction);
  }

  @Delete('items/:id')
  @HttpCode(204)
  deleteItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.media.deleteItem(id);
  }
}
