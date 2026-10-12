import type { MeProfile } from "@/types/user-profile";

export type UserRole = "patient" | "counselor" | "peer_listener" | "admin";

export interface PatientData {
  patientId: string;
  coins: number;
  emergencyContact: string;
  mentalNotes: string;
  isAnonymousDefault: boolean;
}

export interface CounselorData {
  licenseNumber: string; // SIPPK / STR HIMPSI
  sippkNumber?: string;
  specialty: string;
  specializations?: string[];
  title: string;
  experienceYears: number;
  hourlyRateCoins: number;
  rating: number;
  totalConsultations: number;
  consultationCount?: number;
  consultationMethods: ("chat" | "voice")[];
  earningsCoins: number;
  isAvailable?: boolean;
}

export interface ListenerData {
  listenerBadge: string;
  badgeLevel?: string;
  topicsHandled: string[];
  supportTopics?: string[];
  sessionsCompleted: number;
  rating: number;
  empathyScore?: number;
  status: "online" | "offline" | "busy";
  isOnline?: boolean;
}

export interface AdminData {
  department: string;
  permissions: string[];
}

export interface UserProfile {
  id: string;
  role: UserRole;
  fullName: string;
  alias: string;
  email: string;
  phone: string;
  avatarInitials: string;
  isVerified: boolean;
  avatarUrl?: string;
  // Backward compatibility convenience fields
  coins: number;
  patientId: string;
  emergencyContact: string;
  mentalNotes: string;
  isAnonymousDefault: boolean;
  // Role-specific payloads
  patientData?: PatientData;
  counselorData?: CounselorData;
  listenerData?: ListenerData;
  adminData?: AdminData;
  rawProfile?: MeProfile | null;
}

export const mockUsers: Record<UserRole, UserProfile> = {
  patient: {
    id: "usr-patient-01",
    role: "patient",
    fullName: "Wahyu Tricahyo",
    alias: "Wahyu",
    email: "wahyu@temanbicara.id",
    phone: "+62 812-3456-7890",
    avatarInitials: "WT",
    isVerified: true,
    coins: 50,
    patientId: "TB-88219",
    emergencyContact: "0811-9876-5432",
    mentalNotes: "Fokus konsultasi: manajemen kecemasan terkait deadline kerja dan pemulihan pola tidur.",
    isAnonymousDefault: false,
    patientData: {
      patientId: "TB-88219",
      coins: 50,
      emergencyContact: "0811-9876-5432",
      mentalNotes: "Fokus konsultasi: manajemen kecemasan terkait deadline kerja dan pemulihan pola tidur.",
      isAnonymousDefault: false,
    },
  },
  counselor: {
    id: "usr-counselor-01",
    role: "counselor",
    fullName: "Dr. Anita Wijaya, M.Psi., Psikolog",
    alias: "Dr. Anita",
    email: "anita@temanbicara.id",
    phone: "+62 813-8899-7711",
    avatarInitials: "AW",
    isVerified: true,
    coins: 480, // Total koin honor konsultasi yang diperoleh
    patientId: "CS-0481",
    emergencyContact: "0812-1122-3344",
    mentalNotes: "Psikolog Klinis Dewasa spesialisasi CBT, kecemasan, dan trauma recovery.",
    isAnonymousDefault: false,
    counselorData: {
      licenseNumber: "SIPPK-2021-0481",
      specialty: "Kecemasan, Burnout & Regulasi Emosi Dewasa",
      title: "Psikolog Klinis Dewasa (SIPPK Aktif)",
      experienceYears: 9,
      hourlyRateCoins: 15,
      rating: 4.9,
      totalConsultations: 248,
      consultationMethods: ["chat", "voice"],
      earningsCoins: 480,
    },
  },
  peer_listener: {
    id: "usr-listener-01",
    role: "peer_listener",
    fullName: "Rian Permana, S.Sos.",
    alias: "Rian",
    email: "rian@temanbicara.id",
    phone: "+62 856-7788-9900",
    avatarInitials: "RP",
    isVerified: true,
    coins: 25,
    patientId: "PL-1029",
    emergencyContact: "0857-4455-6677",
    mentalNotes: "Relawan pendengar empatik terverifikasi Psychological First Aid (PFA).",
    isAnonymousDefault: true,
    listenerData: {
      listenerBadge: "Pendengar Empatik Terlatih",
      topicsHandled: ["Curhat Stres Kuliah", "Quarter Life Crisis", "Overthinking"],
      sessionsCompleted: 64,
      rating: 4.8,
      status: "online",
    },
  },
  admin: {
    id: "usr-admin-01",
    role: "admin",
    fullName: "Siti Nurhaliza",
    alias: "Siti Admin",
    email: "admin@temanbicara.id",
    phone: "+62 811-0011-2233",
    avatarInitials: "SN",
    isVerified: true,
    coins: 9999,
    patientId: "ADM-001",
    emergencyContact: "0811-9988-7766",
    mentalNotes: "Administrator Operasional & Pengawasan Kode Etik Medis TemanBicara.",
    isAnonymousDefault: false,
    adminData: {
      department: "Operasional & Kepatuhan Medis Platform",
      permissions: ["verify_counselors", "manage_transactions", "emergency_escalation", "all"],
    },
  },
};
