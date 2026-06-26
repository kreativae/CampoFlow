export type Role = 'OWNER' | 'MANAGER' | 'VETERINARIAN' | 'EMPLOYEE' | 'CONSULTANT';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export type Commodity =
  | 'BOI_GORDO'
  | 'VACA_GORDA'
  | 'NOVILHA'
  | 'BEZERRO'
  | 'REPOSICAO'
  | 'COURO'
  | 'SEBO'
  | 'LEITE'
  | 'MILHO'
  | 'SOJA'
  | 'SORGO'
  | 'FARELO_SOJA';

export interface Quotation {
  id: string;
  commodity: Commodity;
  price: number;
  unit: string;
  source: string | null;
  recordedAt: string;
}

export interface LatestQuotation {
  commodity: Commodity;
  price: number;
  unit: string;
  source: string | null;
  recordedAt: string;
  changePercent: number;
}

export interface Farm {
  id: string;
  name: string;
  type: string;
  totalAreaHectares: number | null;
  usableAreaHectares: number | null;
  registryNumber: string | null;
  technicalManager: string | null;
}

export interface Member {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

export type AnimalSex = 'MALE' | 'FEMALE';

export type AnimalCategory =
  | 'BEZERRO'
  | 'BEZERRA'
  | 'NOVILHO'
  | 'NOVILHA'
  | 'GARROTE'
  | 'BOI'
  | 'VACA'
  | 'TOURO'
  | 'MATRIZ';

export interface Animal {
  id: string;
  farmId: string;
  pastureId: string | null;
  earTag: string;
  rfid: string | null;
  name: string | null;
  sex: AnimalSex;
  breed: string | null;
  category: AnimalCategory;
  birthDate: string | null;
  currentWeightKg: number | null;
  active: boolean;
}

export interface AnimalEvent {
  id: string;
  type: string;
  occurredAt: string;
  description: string | null;
}

export interface WeighingRecord {
  id: string;
  weightKg: number;
  weighedAt: string;
  notes: string | null;
}

export interface GainSummary {
  averageDailyGainKg: number;
  averageMonthlyGainKg: number;
  weighingsCount: number;
}

export interface VaccinationRecord {
  id: string;
  vaccineName: string;
  scheduledDate: string;
  administeredAt: string | null;
  batchNumber: string | null;
}

export interface PastureOccupation {
  id: string;
  headCount: number;
  enteredAt: string;
  exitedAt: string | null;
  notes: string | null;
}

export interface Pasture {
  id: string;
  farmId: string;
  name: string;
  areaHectares: number;
  grassType: string | null;
  animalCapacity: number;
  occupations?: PastureOccupation[];
}

export type ReproductiveEventType =
  | 'IATF'
  | 'MONTA_NATURAL'
  | 'INSEMINACAO'
  | 'DIAGNOSTICO_PRENHEZ'
  | 'PARTO'
  | 'ABORTO';

export type PregnancyDiagnosisResult = 'PRENHE' | 'VAZIA';

export interface ReproductiveEvent {
  id: string;
  type: ReproductiveEventType;
  eventDate: string;
  result: PregnancyDiagnosisResult | null;
  notes: string | null;
}

export interface ReproductionStats {
  breedingEvents: number;
  pregnancyDiagnoses: number;
  confirmedPregnant: number;
  conceptionRate: number;
  pregnancyRate: number;
  births: number;
  abortions: number;
}

export type TransactionType = 'RECEITA' | 'DESPESA';

export type TransactionCategory =
  | 'NUTRICAO'
  | 'MEDICAMENTOS'
  | 'FUNCIONARIOS'
  | 'COMBUSTIVEL'
  | 'MAQUINARIO'
  | 'ENERGIA'
  | 'VENDA_ANIMAL'
  | 'OUTROS';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  description: string | null;
  amount: number;
  dueDate: string;
  paidAt: string | null;
}

export interface CashFlowBucket {
  period: string;
  receita: number;
  despesa: number;
  saldo: number;
}

export interface DashboardOverview {
  totalAnimals: number;
  averageWeightKg: number;
  averageDailyGainKg: number;
  stockingRate: {
    totalCapacity: number;
    occupiedHeadCount: number;
    occupancyRate: number;
  };
  currentMonthFinance: {
    receita: number;
    despesa: number;
    saldo: number;
  };
  pendingAlerts: {
    id: string;
    animalEarTag: string;
    vaccineName: string;
    scheduledDate: string;
    overdue: boolean;
  }[];
}

export type WeatherAlertType = 'GEADA' | 'TEMPESTADE' | 'GRANIZO' | 'SECA' | 'VENTO_FORTE';

export interface WeatherRecord {
  id: string;
  temperatureC: number | null;
  humidityPercent: number | null;
  windSpeedKmh: number | null;
  pressureHpa: number | null;
  rainfallMm: number | null;
  alertType: WeatherAlertType | null;
  notes: string | null;
  recordedAt: string;
}

export type SupplyCategory =
  | 'SAL_MINERAL'
  | 'RACAO'
  | 'FERTILIZANTE'
  | 'HERBICIDA'
  | 'DEFENSIVO'
  | 'OUTROS';

export type SupplyMovementType = 'ENTRADA' | 'SAIDA';

export interface SupplyMovement {
  id: string;
  type: SupplyMovementType;
  quantity: number;
  notes: string | null;
  occurredAt: string;
}

export interface Supply {
  id: string;
  name: string;
  category: SupplyCategory;
  unit: string;
  currentQuantity: number;
  minimumQuantity: number;
  expirationDate: string | null;
  notes: string | null;
  movements?: SupplyMovement[];
}

export interface SupplyAlert {
  id: string;
  name: string;
  unit: string;
  currentQuantity: number;
  minimumQuantity: number;
  lowStock: boolean;
  expirationDate: string | null;
  expiringSoon: boolean;
  expired: boolean;
}
