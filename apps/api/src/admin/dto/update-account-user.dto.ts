import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateAccountUserDto {
  @IsOptional()
  @IsBoolean()
  isAccountAdmin?: boolean;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Support reset: lets staff set a new password for a customer who's locked out,
  // without needing the customer's old password (unlike the self-service flow).
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
