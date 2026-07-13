// Tabelas de referência agronômica SIMPLIFICADAS para apoiar o planejamento de
// plantio. NÃO substituem o ZARC oficial do MAPA nem a recomendação de um
// agrônomo — são valores gerais (Centro-Sul) para servir de ponto de partida,
// que o produtor ajusta conforme região, cultivar e histórico do talhão.

export type RotationGroup =
  | 'GRAMINEA'
  | 'LEGUMINOSA'
  | 'OLEAGINOSA'
  | 'FIBRA'
  | 'OUTRO';

export interface CropReference {
  key: string;
  label: string;
  // Meses recomendados de plantio (1 = janeiro ... 12 = dezembro).
  plantingMonths: number[];
  // Saturação por bases (V%) alvo para calagem.
  targetBaseSaturationPercent: number;
  // Recomendação de adubação simplificada (kg/ha) para produtividade de referência.
  nitrogenKgPerHa: number; // N
  phosphorusKgPerHa: number; // P2O5
  potassiumKgPerHa: number; // K2O
  // Taxa de semeadura de referência (kg/ha), quando aplicável.
  seedRateKgPerHa: number | null;
  // Ciclo médio da emergência à colheita (dias).
  cycleDays: number | null;
  // Grupo para orientação de rotação de culturas.
  rotationGroup: RotationGroup;
}

export const CROP_REFERENCES: CropReference[] = [
  {
    key: 'soja',
    label: 'Soja',
    plantingMonths: [10, 11, 12],
    targetBaseSaturationPercent: 60,
    nitrogenKgPerHa: 0, // fixação biológica de nitrogênio
    phosphorusKgPerHa: 80,
    potassiumKgPerHa: 80,
    seedRateKgPerHa: 60,
    cycleDays: 120,
    rotationGroup: 'LEGUMINOSA',
  },
  {
    key: 'milho',
    label: 'Milho',
    plantingMonths: [9, 10, 11],
    targetBaseSaturationPercent: 60,
    nitrogenKgPerHa: 120,
    phosphorusKgPerHa: 90,
    potassiumKgPerHa: 80,
    seedRateKgPerHa: 20,
    cycleDays: 135,
    rotationGroup: 'GRAMINEA',
  },
  {
    key: 'milho-safrinha',
    label: 'Milho safrinha',
    plantingMonths: [1, 2, 3],
    targetBaseSaturationPercent: 60,
    nitrogenKgPerHa: 100,
    phosphorusKgPerHa: 70,
    potassiumKgPerHa: 70,
    seedRateKgPerHa: 18,
    cycleDays: 130,
    rotationGroup: 'GRAMINEA',
  },
  {
    key: 'feijao',
    label: 'Feijão',
    plantingMonths: [10, 11, 2, 3],
    targetBaseSaturationPercent: 50,
    nitrogenKgPerHa: 20,
    phosphorusKgPerHa: 60,
    potassiumKgPerHa: 40,
    seedRateKgPerHa: 60,
    cycleDays: 90,
    rotationGroup: 'LEGUMINOSA',
  },
  {
    key: 'trigo',
    label: 'Trigo',
    plantingMonths: [4, 5, 6],
    targetBaseSaturationPercent: 60,
    nitrogenKgPerHa: 80,
    phosphorusKgPerHa: 70,
    potassiumKgPerHa: 50,
    seedRateKgPerHa: 120,
    cycleDays: 120,
    rotationGroup: 'GRAMINEA',
  },
  {
    key: 'algodao',
    label: 'Algodão',
    plantingMonths: [11, 12, 1],
    targetBaseSaturationPercent: 60,
    nitrogenKgPerHa: 120,
    phosphorusKgPerHa: 90,
    potassiumKgPerHa: 100,
    seedRateKgPerHa: 15,
    cycleDays: 180,
    rotationGroup: 'FIBRA',
  },
  {
    key: 'sorgo',
    label: 'Sorgo',
    plantingMonths: [1, 2, 3],
    targetBaseSaturationPercent: 50,
    nitrogenKgPerHa: 80,
    phosphorusKgPerHa: 60,
    potassiumKgPerHa: 50,
    seedRateKgPerHa: 10,
    cycleDays: 120,
    rotationGroup: 'GRAMINEA',
  },
  {
    key: 'arroz',
    label: 'Arroz',
    plantingMonths: [9, 10, 11],
    targetBaseSaturationPercent: 50,
    nitrogenKgPerHa: 90,
    phosphorusKgPerHa: 70,
    potassiumKgPerHa: 60,
    seedRateKgPerHa: 90,
    cycleDays: 120,
    rotationGroup: 'GRAMINEA',
  },
];

const MONTH_NAMES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

export function monthName(month: number): string {
  return MONTH_NAMES[(month - 1 + 12) % 12] ?? String(month);
}

// Normaliza o nome digitado da cultura (sem acento, minúsculo) e casa com a
// referência mais próxima pelo início do nome.
export function findCropReference(cropName: string): CropReference | null {
  const normalized = cropName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (!normalized) return null;

  // Casa "milho safrinha" antes de "milho".
  const byLength = [...CROP_REFERENCES].sort(
    (a, b) => b.key.length - a.key.length,
  );
  for (const ref of byLength) {
    const refKey = ref.key.replace('-', ' ');
    if (normalized.includes(refKey)) return ref;
  }
  return null;
}
