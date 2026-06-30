import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import {
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
} from './password-policy';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: PASSWORD_POLICY_MESSAGE })
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  password: string;

  @IsString()
  @MinLength(2)
  name: string;
}
