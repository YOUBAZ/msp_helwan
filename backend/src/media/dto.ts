import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateAlbumDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Album name must be 2–80 characters.' })
  title!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 40, { message: 'Category must be 2–40 characters.' })
  category!: string;

  @IsOptional()
  @Matches(DATE, { message: 'Please enter a valid date.' })
  eventDate?: string;
}

export class UpdateAlbumDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Album name must be 2–80 characters.' })
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 40, { message: 'Category must be 2–40 characters.' })
  category?: string;

  /** A date, or null to clear it. */
  @IsOptional()
  @Matches(DATE, { message: 'Please enter a valid date.' })
  eventDate?: string | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class AddVideoDto {
  @IsString()
  @MaxLength(500)
  url!: string;
}
