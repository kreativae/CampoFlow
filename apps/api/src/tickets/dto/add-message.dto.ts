import { IsNotEmpty, IsString } from 'class-validator';

export class AddMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}
