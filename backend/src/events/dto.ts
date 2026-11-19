import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsObject,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateEventDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'Event title must be 2–120 characters.' })
  title!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 40, { message: 'Category must be 2–40 characters.' })
  category!: string;

  @IsISO8601({}, { message: 'Please enter a valid start date and time.' })
  startsAt!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 200, { message: 'Venue must be 2–200 characters.' })
  venue?: string;
}

/** Every field optional; null clears an optional value. */
export class UpdateEventDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'Event title must be 2–120 characters.' })
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 40, { message: 'Category must be 2–40 characters.' })
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 200, { message: 'Venue must be 2–200 characters.' })
  venue?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Please enter a valid start date and time.' })
  startsAt?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Please enter a valid end date and time.' })
  endsAt?: string | null;

  @IsOptional()
  @IsInt({ message: 'Capacity must be a whole number.' })
  @Min(1, { message: 'Capacity must be at least 1.' })
  capacity?: number | null;

  @IsOptional()
  @IsBoolean()
  registrationOpen?: boolean;

  @IsOptional()
  @IsISO8601({}, { message: 'Please enter a valid registration deadline.' })
  registrationDeadline?: string | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsUUID()
  mediaAlbumId?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  highlight?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  partners?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  manualAttendance?: number | null;

  /** Email registered people about a date/time/venue change. */
  @IsOptional()
  @IsBoolean()
  notifyChanges?: boolean;
}

export class RegisterDto {
  @Transform(trim)
  @IsString()
  @Length(2, 100, { message: 'Please enter your full name.' })
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  /** Answers to the event's form, checked against it by the service. */
  @IsObject({ message: 'Please fill in the form.' })
  answers!: Record<string, unknown>;

  /** Hidden field: real people leave it empty. */
  @IsOptional()
  @IsString()
  @MaxLength(0, { message: 'Something went wrong. Please try again.' })
  website?: string;
}

export class SaveFormDto {
  /** The full question list; checked by parseForm in the service. */
  @IsDefined({ message: 'The form must be a list of questions.' })
  questions!: unknown;
}

export class CheckInDto {
  /** The ticket code, or the full ticket link read from the QR code. */
  @IsString()
  @Length(1, 500)
  code!: string;
}
