import { IsArray, IsEnum, IsIn, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';
import { MODULE_KEYS } from '../../auth/modules';

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  // Módulos que o membro pode acessar. Lista vazia = acesso total.
  @IsOptional()
  @IsArray()
  @IsIn(MODULE_KEYS, { each: true })
  moduleAccess?: string[];
}
