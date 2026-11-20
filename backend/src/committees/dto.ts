import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { COMMITTEE_ICONS, TRACKS } from './icons';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimList = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? (value as unknown[]).map((v) => (typeof v === 'string' ? v.trim() : v))
    : value;

export class CommitteeDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Committee name must be 2–80 characters.' })
  name!: string;

  @IsIn(TRACKS, { message: 'Choose Technical or Non-technical.' })
  track!: (typeof TRACKS)[number];

  @IsIn(COMMITTEE_ICONS, { message: 'Choose an icon from the list.' })
  icon!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(300, { message: 'Description is limited to 300 characters.' })
  description!: string;

  @Transform(trimList)
  @IsArray()
  @ArrayMaxSize(12, { message: 'A committee can list up to 12 tasks.' })
  @IsString({ each: true })
  @Length(1, 80, { each: true, message: 'Each task must be 1–80 characters.' })
  tasks!: string[];
}

/** Same rules as CommitteeDto, every field optional. */
export class UpdateCommitteeDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Committee name must be 2–80 characters.' })
  name?: string;

  @IsOptional()
  @IsIn(TRACKS, { message: 'Choose Technical or Non-technical.' })
  track?: (typeof TRACKS)[number];

  @IsOptional()
  @IsIn(COMMITTEE_ICONS, { message: 'Choose an icon from the list.' })
  icon?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300, { message: 'Description is limited to 300 characters.' })
  description?: string;

  @IsOptional()
  @Transform(trimList)
  @IsArray()
  @ArrayMaxSize(12, { message: 'A committee can list up to 12 tasks.' })
  @IsString({ each: true })
  @Length(1, 80, { each: true, message: 'Each task must be 1–80 characters.' })
  tasks?: string[];
}

export class MoveDto {
  @IsIn(['up', 'down'])
  direction!: 'up' | 'down';
}

export class CopyCommitteeDto {
  @IsUUID()
  committeeId!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Committee name must be 2–80 characters.' })
  name?: string;
}
