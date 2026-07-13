import { IsNumber, IsOptional, Min } from 'class-validator';

// Calculadora de plantio: dado o tamanho do talhão e as taxas por hectare,
// devolve quantidades totais e custo estimado. Cálculo puro (não persiste).
export class PlantingCalculatorDto {
  @IsNumber()
  @Min(0)
  areaHectares: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  seedRateKgPerHa?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  seedPricePerKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fertilizerKgPerHa?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fertilizerPricePerKg?: number;
}
