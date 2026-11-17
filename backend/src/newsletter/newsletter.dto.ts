import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

export class SubscribeDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(254)
  email!: string;
}
