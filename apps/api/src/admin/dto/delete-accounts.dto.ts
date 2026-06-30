import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class DeleteAccountsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  accountIds: string[];
}
