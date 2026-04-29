import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be 2–80 characters' })
  @MaxLength(80, { message: 'Name must be 2–80 characters' })
  name?: string;

  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'URL must start with http:// or https://' },
  )
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  targetUsername?: string;

  // Empty / absent → leave unchanged. If present, re-encrypt.
  @IsOptional()
  @IsString()
  @MaxLength(256)
  targetPassword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must be ≤ 500 characters' })
  description?: string;
}
