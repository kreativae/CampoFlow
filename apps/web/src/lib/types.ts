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
