import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateContactDto {
  @Transform(trim)
  @IsString()
  @Length(2, 100, { message: 'Please enter your name (2–100 characters).' })
  name!: string;

  @Transform(trim)
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @Transform(trim)
  @IsString()
  @Length(5, 5000, { message: 'Your message should be 5–5000 characters.' })
  message!: string;
}
