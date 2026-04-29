import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(2, { message: 'Name must be 2–80 characters' })
  @MaxLength(80, { message: 'Name must be 2–80 characters' })
  name!: string;

  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'URL must start with http:// or https://' },
  )
  @MaxLength(2048)
  url!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(254)
  targetUsername!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  targetPassword!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must be ≤ 500 characters' })
  description?: string;
}
