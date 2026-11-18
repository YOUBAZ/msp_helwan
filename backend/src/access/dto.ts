import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const PASSWORD_MSG = 'Password must be 8–128 characters.';

export class LoginDto {
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

export class UpdateMeDto {
  @Transform(trim)
  @IsString()
  @Length(2, 100, { message: 'Name must be 2–100 characters.' })
  name!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @Length(8, 128, { message: PASSWORD_MSG })
  newPassword!: string;
}

export class RedeemTokenDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 100, { message: 'Name must be 2–100 characters.' })
  name?: string;

  @IsString()
  @Length(8, 128, { message: PASSWORD_MSG })
  password!: string;
}

export class CreateInviteDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 100, { message: 'Name must be 2–100 characters.' })
  name!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  roleIds!: string[];
}

export class SetRolesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  roleIds!: string[];
}

export class SetStatusDto {
  @IsIn(['active', 'disabled'])
  status!: 'active' | 'disabled';
}

export class CreateRoleDto {
  @Transform(trim)
  @IsString()
  @Length(2, 50, { message: 'Role name must be 2–50 characters.' })
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  permissions!: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 50, { message: 'Role name must be 2–50 characters.' })
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  permissions?: string[];
}

export class SetMembersDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('all', { each: true })
  userIds!: string[];
}
