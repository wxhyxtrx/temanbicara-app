// Data konsultan terverifikasi (Psikolog Klinis & Konselor Berlisensi)
export interface Consultant {
  id: number;
  name: string;
  title: string;
  specialty: string;
  licenseNumber: string; // SIPPK
  experienceYears: number;
  rating: number;
  reviews: number;
  initials: string;
  available: boolean;
  nextSlot: string;
  almamater?: string;
  bio?: string;
  approaches?: string[];
  handledTopics?: string[];
  hourlyRateCoins?: number;
  consultationMethods?: "Chat Eksklusif"[];
}

