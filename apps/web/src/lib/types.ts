export type Role = 'OWNER' | 'MANAGER' | 'VETERINARIAN' | 'EMPLOYEE' | 'CONSULTANT';

export interface User {
  id: string;
  email: string;
  name: string;
  mfaEnabled: boolean;
  isAccountAdmin?: boolean;
  isPlatformAdmin?: boolean;
}

export type PlanTier = 'TRIAL' | 'BASICO' | 'PROFISSIONAL' | 'ENTERPRISE';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'SUSPENDED';

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  TRIALING: 'Em teste',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Pagamento atrasado',
  CANCELED: 'Cancelada',
  SUSPENDED: 'Suspensa',
};

// Mercado Pago's own payment status field comes back in English from their API —
// translate the common values for display; fall back to the raw value for any
// status MP introduces later that we haven't mapped yet.
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  approved: 'Aprovado',
  authorized: 'Autorizado',
  pending: 'Pendente',
  in_process: 'Em processamento',
  rejected: 'Rejeitado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  charged_back: 'Contestado',
};

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

export interface AccountSummary {
  id: string;
  name: string;
  billingEmail: string;
  owner: { email: string; name: string } | null;
  farmsUsed: number;
  planTier: PlanTier | null;
  status: SubscriptionStatus | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
}

// Resposta de GET /conta/assinatura — assinatura da conta do próprio usuário.
export interface AccountSubscription {
  planTier: PlanTier;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  plan: { tier: PlanTier; label: string; maxFarms: number | null; priceBRL: number | null };
  farmsUsed: number;
  farmsLimit: number | null;
}

export interface PaymentHistoryEntry {
  id: number;
  status: string;
  transactionAmount: number;
  currencyId: string;
  dateApproved: string | null;
  dateCreated: string;
}

export interface AccountDetail {
  id: string;
  name: string;
  billingEmail: string;
  document: string | null;
  farms: { id: string; name: string; createdAt: string }[];
  users: { id: string; email: string; name: string; isAccountAdmin: boolean }[];
  subscription: {
    planTier: PlanTier;
    status: SubscriptionStatus;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
  plan: { label: string; maxFarms: number | null; priceBRL: number | null } | null;
  paymentHistory: PaymentHistoryEntry[];
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

export type MercadoPagoConfigSource = 'banco' | 'variavel_de_ambiente' | 'nenhum';

export interface MercadoPagoConfigStatus {
  configured: boolean;
  source: MercadoPagoConfigSource;
  accessTokenMasked: string | null;
  publicKey: string | null;
  webhookSecretSet: boolean;
}

export interface AccountListResponse {
  items: AccountSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOverview {
  totalAccounts: number;
  totalFarms: number;
  newAccounts7d: number;
  newAccounts30d: number;
  openTickets: number;
  withoutSubscription: number;
  statusCounts: Record<string, number>;
  planCounts: Record<string, number>;
  mrr: number;
}

export interface NotificationScheduleConfig {
  frequency: string;
  enabled: boolean;
  updatedAt: string;
  options: { key: string; label: string; cron: string }[];
}

export type MercadoPagoLogEvent =
  | 'CREATE_SUBSCRIPTION'
  | 'CANCEL_SUBSCRIPTION'
  | 'WEBHOOK'
  | 'PAYMENT_HISTORY_FETCH'
  | 'CONFIG_UPDATED';

export interface MercadoPagoLog {
  id: string;
  event: MercadoPagoLogEvent;
  preapprovalId: string | null;
  success: boolean;
  message: string;
  createdAt: string;
}

export type TicketStatus = 'ABERTO' | 'EM_ANDAMENTO' | 'RESOLVIDO' | 'FECHADO';
export type TicketPriority = 'BAIXA' | 'MEDIA' | 'ALTA';

export interface TicketMessage {
  id: string;
  message: string;
  fromStaff: boolean;
  createdAt: string;
  author: { id: string; name: string; email: string };
}

export interface Ticket {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string; email: string };
  account: { id: string; name: string; billingEmail: string };
  messages: TicketMessage[];
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
  | 'FARELO_SOJA'
  | 'MERCADO_FUTURO'
  | 'BOI_MUNDO'
  | 'ATACADO'
  | 'EQUIVALENTES';

export type BrazilianState =
  | 'AC'
  | 'AL'
  | 'AP'
  | 'AM'
  | 'BA'
  | 'CE'
  | 'DF'
  | 'ES'
  | 'GO'
  | 'MA'
  | 'MT'
  | 'MS'
  | 'MG'
  | 'PA'
  | 'PB'
  | 'PR'
  | 'PE'
  | 'PI'
  | 'RJ'
  | 'RN'
  | 'RS'
  | 'RO'
  | 'RR'
  | 'SC'
  | 'SP'
  | 'SE'
  | 'TO';

export interface Quotation {
  id: string;
  commodity: Commodity;
  state: BrazilianState | null;
  price: number;
  unit: string;
  source: string | null;
  recordedAt: string;
}

export interface LatestQuotation {
  commodity: Commodity;
  state: BrazilianState | null;
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
  moduleAccess: ModuleKey[];
}

// Módulos ("páginas") que o gestor pode liberar por membro. Vazio = acesso total.
export type ModuleKey =
  | 'rebanho'
  | 'pastagens'
  | 'reproducao'
  | 'insumos'
  | 'maquinas'
  | 'equipe'
  | 'agenda'
  | 'mapa'
  | 'safras'
  | 'documentos'
  | 'contatos'
  | 'financeiro'
  | 'relatorios'
  | 'inteligencia'
  | 'notificacoes'
  | 'membros';

export const MODULE_OPTIONS: { key: ModuleKey; label: string }[] = [
  { key: 'rebanho', label: 'Rebanho' },
  { key: 'pastagens', label: 'Pastagens' },
  { key: 'reproducao', label: 'Reprodução' },
  { key: 'insumos', label: 'Insumos' },
  { key: 'maquinas', label: 'Máquinas' },
  { key: 'equipe', label: 'Equipe' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'mapa', label: 'Mapa e Solo' },
  { key: 'safras', label: 'Safras' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'contatos', label: 'Contatos' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'relatorios', label: 'Relatórios' },
  { key: 'inteligencia', label: 'Inteligência' },
  { key: 'notificacoes', label: 'Notificações' },
  { key: 'membros', label: 'Membros' },
];

export interface FarmInvite {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
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

// AnimalEvent.type comes from the API as the raw Prisma enum value (English) —
// translate for display in the animal's "Histórico" timeline.
export const ANIMAL_EVENT_TYPE_LABEL: Record<string, string> = {
  TRANSFER: 'Transferência',
  WEIGHING: 'Pesagem',
  VACCINATION: 'Vacinação',
  TREATMENT: 'Tratamento',
  REPRODUCTIVE: 'Reprodução',
  SALE: 'Venda',
  DEATH: 'Óbito',
};

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
  // Nº de animais do rebanho atualmente atribuídos a este pasto (Animal.pastureId).
  animalHeadCount?: number;
  // Animais do rebanho neste pasto (retornado no detalhe).
  animals?: Animal[];
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

export interface DashboardFullOverview {
  herd: DashboardOverview;
  members: { total: number };
  reproduction: {
    breedingEvents: number;
    pregnancyDiagnoses: number;
    confirmedPregnant: number;
    conceptionRate: number;
    pregnancyRate: number;
    births: number;
    abortions: number;
  };
  supplies: {
    total: number;
    alertsCount: number;
    alerts: { name: string }[];
  };
  machines: {
    total: number;
    costsSummary: unknown[];
  };
  tasks: {
    total: number;
    openCount: number;
  };
  employees: EmployeeSummary;
  agenda: {
    upcomingCount: number;
    upcoming: { title: string; scheduledDate: string; overdue: boolean }[];
  };
  map: {
    featuresCount: number;
    soilAnalysesCount: number;
  };
  crops: {
    total: number;
    activeCount: number;
  };
  documents: { total: number };
  notifications: { unreadCount: number };
  quotations: { commodity: string; price: number; unit: string }[];
}

export interface WeatherRecord {
  id: string;
  temperatureC: number | null;
  humidityPercent: number | null;
  windSpeedKmh: number | null;
  pressureHpa: number | null;
  rainfallMm: number | null;
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
  customCategory: string | null;
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

export type EmployeeType = 'EFETIVO' | 'CHAPA' | 'TEMPORARIO' | 'OUTRO';

export interface TimeEntry {
  id: string;
  employeeId: string;
  workDate: string;
  hours: number;
  description: string;
  paid: boolean;
  notes: string | null;
  createdAt: string;
}

export interface Employee {
  id: string;
  farmId: string;
  name: string;
  type: EmployeeType;
  role: string | null;
  document: string | null;
  phone: string | null;
  hourlyRate: number;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Aggregated on read by the API (findAll/findOne):
  totalHours: number;
  balanceHours: number;
  grossCost: number;
  paidCost: number;
  totalCost: number;
  timeEntries?: TimeEntry[];
}

export interface EmployeeSummary {
  employeeCount: number;
  activeCount: number;
  totalHours: number;
  balanceHours: number;
  grossCost: number;
  paidCost: number;
  totalCost: number;
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
  };
  forecastSales: {
    recentMonths: { period: string; receita: number; despesa: number; saldo: number }[];
    projectedNextMonthReceita: number;
  };
  managementSuggestions: string[];
  additionalData: {
    cotacaoBoiGordo: { price: number; unit: string; recordedAt: string } | null;
    valorEstimadoRebanho: number | null;
    custosMaquinas: number;
    maquinasCount: number;
    analisesSoloCount: number;
    areasComCalagemPendente: number;
    documentosCount: number;
  };
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

export type CropCycleStatus = 'PLANEJADA' | 'PLANTADA' | 'COLHIDA';

export interface CropCycle {
  id: string;
  farmId: string;
  mapFeatureId: string | null;
  cropName: string;
  variety: string | null;
  areaHectares: number | null;
  plantedAt: string;
  expectedHarvestAt: string | null;
  harvestedAt: string | null;
  yieldKg: number | null;
  salePricePerUnit: number | null;
  saleUnit: CropSaleUnit | null;
  notes: string | null;
  status: CropCycleStatus;
  createdAt: string;
}

export type CropSaleUnit = 'SACA60' | 'KG' | 'ARROBA';

export type CropCostCategory =
  | 'SEMENTE'
  | 'FERTILIZANTE'
  | 'DEFENSIVO'
  | 'CALCARIO'
  | 'OPERACAO'
  | 'MAO_DE_OBRA'
  | 'ARRENDAMENTO'
  | 'OUTRO';

export interface CropCostEntry {
  id: string;
  cropCycleId: string;
  category: CropCostCategory;
  description: string;
  amount: number;
  incurredAt: string;
  createdAt: string;
}

export interface CropClosing {
  cropName: string;
  variety: string | null;
  areaHectares: number | null;
  status: CropCycleStatus;
  unitLabel: string;
  production: {
    yieldKg: number | null;
    productionInUnit: number | null;
    productivityPerHa: number | null;
  };
  costs: {
    fieldBook: number;
    manual: number;
    finance: number;
    total: number;
    perHectare: number | null;
    perUnit: number | null;
    byCategory: Record<string, number>;
  };
  revenue: {
    salePricePerUnit: number | null;
    total: number | null;
  };
  result: {
    profit: number | null;
    marginPercent: number | null;
    breakEvenPricePerUnit: number | null;
  };
}

export interface CropHistoryRow {
  id: string;
  cropName: string;
  variety: string | null;
  areaHectares: number | null;
  plantedAt: string;
  harvestedAt: string | null;
  status: CropCycleStatus;
  unitLabel: string;
  productivityPerHa: number | null;
  totalCost: number;
  revenue: number | null;
  profit: number | null;
  marginPercent: number | null;
}

export type CropApplicationType =
  | 'PLANTIO'
  | 'ADUBACAO'
  | 'CALAGEM'
  | 'HERBICIDA'
  | 'FUNGICIDA'
  | 'INSETICIDA'
  | 'DEFENSIVO'
  | 'IRRIGACAO'
  | 'OUTRO';

export interface CropApplication {
  id: string;
  cropCycleId: string;
  type: CropApplicationType;
  product: string;
  dosePerHa: number | null;
  doseUnit: string | null;
  totalQuantity: number | null;
  appliedAt: string;
  preHarvestIntervalDays: number | null;
  responsible: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CropReferenceOption {
  key: string;
  label: string;
  plantingMonths: number[];
  seedRateKgPerHa: number | null;
  cycleDays: number | null;
  rotationGroup: string;
}

export interface PlantingWindow {
  cropName: string;
  recognized: boolean;
  recommendedMonths: number[];
  recommendedLabel: string | null;
  plantedMonth: number;
  withinWindow: boolean | null;
  note: string;
}

export interface CropFertilizerRecommendation {
  cropName: string;
  areaHectares: number | null;
  soilAnalysisId: string | null;
  soilCollectedAt: string | null;
  liming: {
    limingNeeded: boolean;
    limestoneTonPerHa: number | null;
    targetBaseSaturationPercent: number;
    notes: string[];
  } | null;
  fertilizer: {
    nitrogenKgPerHa: number;
    phosphorusKgPerHa: number;
    potassiumKgPerHa: number;
    nitrogenTotalKg: number | null;
    phosphorusTotalKg: number | null;
    potassiumTotalKg: number | null;
  } | null;
  notes: string[];
}

export interface PlantingCalcResult {
  areaHectares: number;
  seedTotalKg: number | null;
  seedCost: number | null;
  fertilizerTotalKg: number | null;
  fertilizerCost: number | null;
  totalCost: number | null;
  costPerHa: number | null;
}

export interface CropRotationGroup {
  mapFeatureId: string;
  label: string;
  history: {
    id: string;
    cropName: string;
    variety: string | null;
    plantedAt: string;
    harvestedAt: string | null;
  }[];
  advice: string;
}

export type ContactType = 'PESSOA_FISICA' | 'PESSOA_JURIDICA';

export type ContactCategory =
  | 'FORNECEDOR'
  | 'CLIENTE'
  | 'VETERINARIO'
  | 'TRANSPORTADOR'
  | 'COMPRADOR'
  | 'PRESTADOR_SERVICO'
  | 'OUTRO';

export interface Contact {
  id: string;
  farmId: string;
  type: ContactType;
  category: ContactCategory;
  name: string;
  tradeName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
