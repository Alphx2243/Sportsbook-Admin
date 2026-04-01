export type ActionResponse<T = any> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  rollNumber: string;
  qrCodePath?: string | null;
  sportsExperience: string[];
  resetToken?: string | null;
  resetTokenExpiry?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  role: string;
}


export interface Sport {
  id: string;
  name: string;
  numberOfCourts: number;
  totalEquipments: string[];
  equipmentsInUse: string[];
  courtsInUse: number;
  courtData?: any;
  maxCapacity?: number | null;
  numPlayers?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  userId: string;
  sportName: string;
  issuedEquipments: string[];
  numberOfPlayers: number;
  startTime: string;
  endTime: string;
  date: string;
  qrDetail?: string | null;
  status: string;
  endDate?: string | null;
  courtNo?: string | null;
  scanned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Match {
  id: string;
  sportName: string;
  team1: string;
  team2: string;
  score1: string;
  score2: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuideApplication {
  id: string;
  email: string;
  option: string;
  sportName: string;
  level?: string | null;
  resolved: boolean;
  time?: string | null;
  description?: string | null;
  avDays?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invite {
  id: string;
  sport: string;
  venue: string;
  date: string;
  time: string;
  email: string;
  name: string;
  mobileNumber: string;
  show: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GymLog {
  id: string;
  userId: string;
  entryTime: Date;
  exitTime?: Date | null;
  duration?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipmentCounts {
  [key: string]: number;
}