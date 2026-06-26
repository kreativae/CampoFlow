import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { GeometryType, MapFeatureType } from '@prisma/client';

export class CreateMapFeatureDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(MapFeatureType)
  type: MapFeatureType;

  @IsEnum(GeometryType)
  geometryType: GeometryType;

  // Always an array of [lat, lng] pairs: exactly one pair for PONTO, three or more for POLIGONO.
  @IsArray()
  @ArrayMinSize(1)
  coordinates: [number, number][];

  @IsOptional()
  @IsString()
  notes?: string;
}
