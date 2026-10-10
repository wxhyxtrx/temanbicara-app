import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useNotificationStore } from "@/store/notification-store";

export type CrisisSeverity = "critical" | "high" | "medium";
export type CrisisStatus = "open" | "in_progress" | "resolved";

export interface CrisisReport {
  id: string;
  patientId: string;
  patientName: string;
  patientAlias: string;
  patientEmail: string;
  patientPhone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  source: "curhat_sebaya" | "chat_psikolog" | "self_report" | "ai_flag";
  severity: CrisisSeverity;
  triggerExcerpt: string;
  reportedAt: string;
  timestamp: number;
  status: CrisisStatus;
  assignedTo?: string;
  resolutionNotes?: string;
  escalatedTo119?: boolean;
}

const initialCrisisReports: CrisisReport[] = [
  {
    id: "crs-101",
    patientId: "TB-88219",
    patientName: "Wahyu Tricahyo",
    patientAlias: "Bunga Biru",
    patientEmail: "wahyu@temanbicara.id",
    patientPhone: "+62 812-3456-7890",
    emergencyContactName: "Ibu Ratna (Ibu Kandung)",
    emergencyContactPhone: "0811-9876-5432",
    source: "curhat_sebaya",
    severity: "critical",
    triggerExcerpt: "Rasanya sudah tidak sanggup lagi menjalani hari-hari ini, saya terpikir untuk mengakhiri semuanya malam ini...",
    reportedAt: "5 menit lalu",
    timestamp: Date.now() - 5 * 60 * 1000,
    status: "open",
    escalatedTo119: false,
  },
  {
    id: "crs-102",
    patientId: "TB-44109",
    patientName: "Rian Pratama",
    patientAlias: "Langit Gelap",
    patientEmail: "rian.pratama@temanbicara.id",
    patientPhone: "+62 856-7788-9900",
    emergencyContactName: "Budi Santoso (Sahabat)",
    emergencyContactPhone: "0812-8877-6655",
    source: "chat_psikolog",
    severity: "high",
    triggerExcerpt: "Serangan panik hebat berulang dan ada impuls menyakiti diri dengan benda tajam saat sendirian di kamar.",
    reportedAt: "42 menit lalu",
    timestamp: Date.now() - 42 * 60 * 1000,
    status: "in_progress",
    assignedTo: "Dr. Sarah Alatas, M.Psi",
    resolutionNotes: "Sudah dihubungi via WhatsApp darurat & sedang dialihkan ke sesi telekonseling krisis terjadwal.",
    escalatedTo119: false,
  },
  {
    id: "crs-103",
    patientId: "TB-12903",
    patientName: "Dinda Maharani",
    patientAlias: "Bintang Teduh",
    patientEmail: "dinda.m@temanbicara.id",
    patientPhone: "+62 819-2233-4455",
    emergencyContactName: "Agus Prasetya (Suami)",
    emergencyContactPhone: "0813-1122-3344",
    source: "ai_flag",
    severity: "medium",
    triggerExcerpt: "Perasaan hampa mendalam tanpa nafsu makan selama 2 minggu berturut-turut setelah kehilangan pekerjaan.",
    reportedAt: "Kemarin, 19:30 WIB",
    timestamp: Date.now() - 20 * 60 * 60 * 1000,
    status: "resolved",
    assignedTo: "Dr. Anita Wijaya, M.Psi",
    resolutionNotes: "Telah dirujuk ke paket konsultasi rutin. Kondisi stabil dan kontak darurat telah terkonfirmasi.",
    escalatedTo119: true,
  },
];

export interface CrisisState {
  reports: CrisisReport[];
  addReport: (data: Omit<CrisisReport, "id" | "reportedAt" | "timestamp" | "status">) => CrisisReport;
  assignToPsychologist: (reportId: string, psychologistName: string) => void;
  escalateToHotline119: (reportId: string) => void;
  resolveReport: (reportId: string, notes: string) => void;
}

export const useCrisisStore = create<CrisisState>()(
  persist(
    (set, get) => ({
      reports: initialCrisisReports,

      addReport: (data) => {
        const newReport: CrisisReport = {
          ...data,
          id: `crs-${Date.now()}`,
          reportedAt: "Baru saja",
          timestamp: Date.now(),
          status: "open",
        };

        set({
          reports: [newReport, ...get().reports],
        });

        // Notifikasi darurat
        useNotificationStore.getState().addNotification({
          title: "🚨 PERINGATAN KRISIS BARU DITERIMA",
          message: `Kasus ${data.severity.toUpperCase()} dari ${data.patientAlias}: "${data.triggerExcerpt.slice(0, 70)}..."`,
          type: "sistem",
          actionUrl: "/admin/crisis-feed",
        });

        return newReport;
      },

      assignToPsychologist: (reportId, psychologistName) => {
        const updated = get().reports.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: "in_progress" as CrisisStatus,
                assignedTo: psychologistName,
                resolutionNotes: `Ditugaskan kepada ${psychologistName} untuk penanganan segera.`,
              }
            : r
        );

        set({ reports: updated });

        useNotificationStore.getState().addNotification({
          title: "Psikolog Siaga Ditugaskan",
          message: `Kasus krisis #${reportId} telah diteruskan kepada ${psychologistName}.`,
          type: "sistem",
          actionUrl: "/admin/crisis-feed",
        });
      },

      escalateToHotline119: (reportId) => {
        const updated = get().reports.map((r) =>
          r.id === reportId
            ? {
                ...r,
                escalatedTo119: true,
                resolutionNotes: (r.resolutionNotes ? r.resolutionNotes + " | " : "") + "Rujukan darurat dikirimkan ke Hotline Krisis Kemenkes RI 119 (ext. 8 - SEJIWA).",
              }
            : r
        );

        set({ reports: updated });

        useNotificationStore.getState().addNotification({
          title: "Eskalasi Darurat SEJIWA 119",
          message: `Tiket #${reportId} telah dieskalasi ke Hotline Krisis Nasional Kemenkes RI.`,
          type: "sistem",
          actionUrl: "/admin/crisis-feed",
        });
      },

      resolveReport: (reportId, notes) => {
        const updated = get().reports.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: "resolved" as CrisisStatus,
                resolutionNotes: notes,
              }
            : r
        );

        set({ reports: updated });

        useNotificationStore.getState().addNotification({
          title: "Kasus Krisis Telah Ditangani",
          message: `Tiket krisis #${reportId} telah ditandai selesai dengan catatan penanganan tersimpan.`,
          type: "sistem",
          actionUrl: "/admin/crisis-feed",
        });
      },
    }),
    {
      name: "tb_crisis_store_v1",
      version: 1,
    }
  )
);
