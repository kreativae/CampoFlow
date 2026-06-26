export type Role = 'OWNER' | 'MANAGER' | 'VETERINARIAN' | 'EMPLOYEE' | 'CONSULTANT';

export interface User {
  id: string;
  email: string;
  name: string;
  mfaEnabled: boolean;
}

export interface AuthResponse {
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  mfaRequired?: boolean;
}

export interface MfaSetupResponse {
  secret: string;
  qrCodeDataUrl: string;
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
  latitude: number | null;
  longitude: number | null;
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
  source: string | null;
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

export type MachineType = 'TRATOR' | 'CAMINHAO' | 'IMPLEMENTO' | 'OUTRO';

export interface MachineMaintenance {
  id: string;
  description: string;
  cost: number | null;
  hourMeterAt: number | null;
  performedAt: string;
  notes: string | null;
}

export interface MachineFuelRecord {
  id: string;
  liters: number;
  cost: number | null;
  hourMeterAt: number | null;
  recordedAt: string;
  notes: string | null;
}

export interface Machine {
  id: string;
  name: string;
  type: MachineType;
  brand: string | null;
  model: string | null;
  year: number | null;
  currentHourMeter: number;
  notes: string | null;
  maintenances?: MachineMaintenance[];
  fuelRecords?: MachineFuelRecord[];
}

export interface MachineCostSummary {
  machineId: string;
  name: string;
  currentHourMeter: number;
  maintenanceCost: number;
  fuelCost: number;
  totalCost: number;
  totalLiters: number;
}

export type TaskStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assignedToId: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
}

export interface WorkLog {
  id: string;
  description: string;
  hoursWorked: number;
  taskId: string | null;
  workDate: string;
  notes: string | null;
  user: { id: string; name: string; email: string };
}

export interface Shift {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  user: { id: string; name: string; email: string };
}

export type AgendaEventType = 'VACINACAO' | 'PESAGEM' | 'MANEJO' | 'COMPRA' | 'VENDA' | 'OUTRO';

export interface AgendaEvent {
  id: string;
  title: string;
  type: AgendaEventType;
  scheduledDate: string;
  completedAt: string | null;
  notes: string | null;
}

export interface AgendaAlert extends AgendaEvent {
  overdue: boolean;
}

export type MapFeatureType = 'CERCA' | 'PASTAGEM' | 'NASCENTE' | 'RESERVA' | 'OUTRO';
export type GeometryType = 'PONTO' | 'POLIGONO';

export interface MapFeature {
  id: string;
  name: string;
  type: MapFeatureType;
  geometryType: GeometryType;
  coordinates: [number, number][];
  notes: string | null;
}

export type DocumentCategory = 'GTA' | 'NFE' | 'CONTRATO' | 'EXAME' | 'CERTIFICADO' | 'OUTRO';

export interface FarmDocument {
  id: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  fileSize: number;
  notes: string | null;
  createdAt: string;
}

export interface BiOverview {
  kpis: {
    totalReceita: number;
    totalDespesa: number;
    lucro: number;
    arrobasProduzidas: number;
    custoPorArroba: number;
    lucroPorAnimal: number;
    roi: number;
    rentabilidade: number;
  };
  forecastWeightGain: {
    windowDays: number;
    averageDailyGainKg: number;
    herdSize: number;
    projectedArrobas: number;
    weatherRiskActive: boolean;
    weatherAdjustedProjectedArrobas: number;
  };
  forecastSales: {
    recentMonths: { period: string; receita: number; despesa: number; saldo: number }[];
    projectedNextMonthReceita: number;
  };
  managementSuggestions: string[];
}

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH';
export type NotificationStatus = 'PENDING' | 'SENT' | 'SIMULATED' | 'FAILED';
export type NotificationSource = 'SANIDADE' | 'AGENDA' | 'INSUMOS' | 'CLIMA' | 'OUTRO';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  source: NotificationSource;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface SoilAnalysis {
  id: string;
  mapFeatureId: string | null;
  areaLabel: string | null;
  collectedAt: string;
  ph: number | null;
  phosphorusMgDm3: number | null;
  potassiumCmolcDm3: number | null;
  calciumCmolcDm3: number | null;
  magnesiumCmolcDm3: number | null;
  aluminumCmolcDm3: number | null;
  organicMatterPercent: number | null;
  baseSaturationPercent: number | null;
  ctcCmolcDm3: number | null;
  documentPath: string | null;
  documentFileName: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SoilAnalysisRecommendation {
  limingNeeded: boolean;
  limestoneTonPerHa: number | null;
  targetBaseSaturationPercent: number;
  notes: string[];
}
