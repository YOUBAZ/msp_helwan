import {
  Put,
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
import { Auth, AuthAny, Me } from '../access/auth.guard';
import { type CurrentUser, hasAll } from '../access/current-user';
import { Throttle } from '@nestjs/throttler';
import {
  CheckInDto,
  CreateEventDto,
  RegisterDto,
  SaveFormDto,
  UpdateEventDto,
} from './dto';
import { EventsService } from './events.service';
import { RegistrationsService } from './registrations.service';

/** Public: Events page, event pages and cover photos. */
@Controller('events')
export class PublicEventsController {
  constructor(
    private readonly events: EventsService,
    private readonly registrations: RegistrationsService,
  ) {}

  @Post(':id/register')
  // Generous: a whole lecture hall can share one campus or mobile IP. Bots
  // are kept out by the honeypot and the one-registration-per-email rule.
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  register(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RegisterDto) {
    return this.registrations.register(id, dto);
  }

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

/** Public: a person's ticket (the code in the link is the secret). */
@Controller('tickets')
export class TicketsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get(':code')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  ticket(@Param('code') code: string) {
    return this.registrations.ticket(code);
  }

  @Post(':code/cancel')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  cancel(@Param('code') code: string) {
    return this.registrations.cancelByTicket(code);
  }
}

/** Managing events. Requires "events.manage". */
@Controller('admin/events')
@Auth('events.manage')
export class AdminEventsController {
  constructor(
    private readonly events: EventsService,
    private readonly registrations: RegistrationsService,
  ) {}

  @Post(':id/duplicate')
  duplicate(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.duplicate(id);
  }

  @Put(':id/form')
  async saveForm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveFormDto,
  ) {
    return { form: await this.registrations.saveForm(id, dto.questions) };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    await this.registrations.cancelEvent(id);
    return this.events.adminEvent(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrations.deleteEvent(id);
  }

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
    await this.registrations.updateEvent(id, dto);
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

/** Registrations and door check-in: "events.manage" or "events.checkin". */
@Controller('admin')
export class BoardRegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get('events/:id/registrations')
  @AuthAny('events.manage', 'events.checkin')
  list(@Me() me: CurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.registrations.boardList(id, hasAll(me, ['events.manage']));
  }

  @Post('events/:id/checkin')
  @HttpCode(200)
  @AuthAny('events.manage', 'events.checkin')
  checkin(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CheckInDto) {
    return this.registrations.checkinByCode(id, dto.code);
  }

  @Post('registrations/:id/checkin')
  @HttpCode(200)
  @AuthAny('events.manage', 'events.checkin')
  checkinById(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrations.checkinById(id);
  }

  @Get('events/:id/registrations.csv')
  @Auth('events.manage')
  async csv(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { filename, body } = await this.registrations.csv(id);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return body;
  }

  @Post('registrations/:id/promote')
  @HttpCode(204)
  @Auth('events.manage')
  promote(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrations.promote(id);
  }

  @Post('registrations/:id/cancel')
  @HttpCode(204)
  @Auth('events.manage')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrations.cancelByBoard(id);
  }
}
