import { IsArray, IsEmail, IsEnum, IsIn, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';
import { MODULE_KEYS } from '../../auth/modules';

export class AddMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(Role)
  role: Role;

  // Módulos que o membro pode acessar. Vazio/ausente = acesso total.
  @IsOptional()
  @IsArray()
  @IsIn(MODULE_KEYS, { each: true })
  moduleAccess?: string[];
}
