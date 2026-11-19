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
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Auth } from '../access/auth.guard';
import { CreateEventDto, UpdateEventDto } from './dto';
import { EventsService } from './events.service';

/** Public: Events page, event pages and cover photos. */
@Controller('events')
export class PublicEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list() {
    return this.events.publicLists();
  }

  @Get(':id')
  event(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.publicEvent(id);
  }

  @Get(':id/cover')
  @SkipThrottle()
  async cover(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const c = await this.events.cover(id);
    res.set({
      'Content-Type': c.mime,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    });
    return new StreamableFile(c.data);
  }
}

/** Managing events. Requires "events.manage". */
@Controller('admin/events')
@Auth('events.manage')
export class AdminEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list() {
    return this.events.adminList();
  }

  @Get('categories')
  categories() {
    return this.events.categories();
  }

  @Get(':id')
  event(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.adminEvent(id);
  }

  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.events.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    await this.events.applyUpdate(id, dto);
    return this.events.adminEvent(id);
  }

  @Post(':id/cover')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    }),
  )
  setCover(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.events.setCover(id, file);
  }

  @Delete(':id/cover')
  @HttpCode(204)
  removeCover(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.removeCover(id);
  }
}
