import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { ContactCategory, ContactType } from '@prisma/client';

export class CreateContactDto {
  @IsEnum(ContactType)
  type: ContactType;

  @IsOptional()
  @IsEnum(ContactCategory)
  category?: ContactCategory;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @IsString()
  document?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  addressStreet?: string;

  @IsOptional()
  @IsString()
  addressCity?: string;

  @IsOptional()
  @IsString()
  addressState?: string;

  @IsOptional()
  @IsString()
  addressZip?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
