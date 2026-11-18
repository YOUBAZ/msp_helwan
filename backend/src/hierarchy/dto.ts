import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateSeasonDto {
  @IsInt({ message: 'Season number must be a whole number.' })
  @Min(1)
  @Max(1000)
  number!: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  name?: string;

  /** Copy the position structure (titles only, no people) from this season. */
  @IsOptional()
  @IsUUID()
  copyFromSeasonId?: string;
}

export class RenameSeasonDto {
  @Transform(trim)
  @IsString()
  @Length(2, 60, { message: 'Season name must be 2–60 characters.' })
  name!: string;
}

export class CreatePositionDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Position title must be 2–80 characters.' })
  title!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class RenamePositionDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Position title must be 2–80 characters.' })
  title!: string;
}

export class MoveDto {
  @IsIn(['up', 'down'])
  direction!: 'up' | 'down';
}

export class AddMemberDto {
  @IsUUID('all', { message: 'Choose a person from the list.' })
  userId!: string;
}
