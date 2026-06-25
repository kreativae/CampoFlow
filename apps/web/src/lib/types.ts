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

export interface Farm {
  id: string;
  name: string;
  type: string;
  totalAreaHectares: number | null;
  usableAreaHectares: number | null;
  registryNumber: string | null;
  technicalManager: string | null;
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

export interface Pasture {
  id: string;
  name: string;
  areaHectares: number;
  animalCapacity: number;
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
