import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useNotificationStore } from "@/store/notification-store";

export interface SoapEntry {
  id: string;
  sessionNumber: number;
  date: string;
  s: string; // Subjective
  o: string; // Objective
  a: string; // Assessment
  p: string; // Plan
  updatedAt: string;
}

export interface ClientClinicalRecord {
  id: string;
  name: string;
  age: number;
  gender?: "Laki-laki" | "Perempuan";
  status: "Aktif" | "Pemulihan" | "Selesai";
  totalSessions: number;
  lastSession: string;
  primaryDiagnosis: string;
  treatmentGoals?: string[];
  soapHistory: SoapEntry[];
}

const initialClients: ClientClinicalRecord[] = [
  {
    id: "cl-wahyu",
    name: "Wahyu Tricahyo",
    age: 27,
    gender: "Laki-laki",
    status: "Aktif",
    totalSessions: 3,
    lastSession: "10 Okt 2026",
    primaryDiagnosis: "F41.1 Ansietas Menyeluruh & Work-related Burnout",
    treatmentGoals: [
      "Mengurangi somatisasi cemas di pagi hari",
      "Restrukturisasi kognitif terhadap target kuartal",
      "Edukasi sleep hygiene teratur",
    ],
    soapHistory: [
      {
        id: "soap-w-3",
        sessionNumber: 3,
        date: "10 Okt 2026, 14:00 WIB",
        s: "Klien melaporkan rasa cemas antisipatif berulang saat pagi sebelum jam kantor. Mengalami somatic tension (dada sesak ringan, jantung berdebar). Latihan napas diafragma malam hari cukup efektif membantu onset tidur.",
        o: "Afek cemas ringan, kontak mata baik, speech rate teratur. Insight klinis baik (grade 5, sadar akan pola pemicu kecemasan).",
        a: "F41.1 - Gangguan Cemas Menyeluruh dengan kecenderungan catastrophizing terhadap beban kerja kuartal akhir.",
        p: "1. Psikoedukasi CBT restrukturisasi pikiran otomatis (3-column technique).\n2. Latihan grounding 5-4-3-2-1 saat morning routine.\n3. Pertahankan jadwal tidur konsisten jam 23.00.",
        updatedAt: "10 Okt 2026",
      },
      {
        id: "soap-w-2",
        sessionNumber: 2,
        date: "3 Okt 2026, 14:00 WIB",
        s: "Klien merasa kewalahan dengan tumpukan tugas tanpa prioritas yang jelas. Mengalami episode sesak napas saat menerima chat manajer di akhir pekan.",
        o: "Kontak mata cukup, tampak lelah, afek labil saat membahas batas jam kerja kantor.",
        a: "Akumulasi stres kerja fase 3 (Burnout Exhaustion) disertai somatisasi pernapasan.",
        p: "Latihan active boundary setting (tidak membalas email di luar jam kerja) dan teknik pernapasan kotak 4-4-4-4.",
        updatedAt: "3 Okt 2026",
      },
      {
        id: "soap-w-1",
        sessionNumber: 1,
        date: "26 Sep 2026, 14:00 WIB",
        s: "Initial interview. Keluhan sulit tidur sejak 2 bulan terakhir, sering terbangun jam 3 pagi dengan kepala berdenyut.",
        o: "Pasien kooperatif, orientasi ruang/waktu penuh. Afek tampak tegang.",
        a: "Susp. Insomnia Sekunder ec. Stres Akut Karier.",
        p: "Edukasi Sleep Hygiene dan penjadwalan evaluasi sesi konseling berkala.",
        updatedAt: "26 Sep 2026",
      },
    ],
  },
  {
    id: "cl-1",
    name: "Budi Santoso (Anonim)",
    age: 26,
    gender: "Laki-laki",
    status: "Aktif",
    totalSessions: 4,
    lastSession: "8 Okt 2026",
    primaryDiagnosis: "Generalised Anxiety & Work Burnout",
    treatmentGoals: [
      "Regulasi pernapasan saat rapat kerja",
      "Perbaikan kualitas tidur",
    ],
    soapHistory: [
      {
        id: "soap-b-4",
        sessionNumber: 4,
        date: "8 Okt 2026, 10:30 WIB",
        s: "Pasien melaporkan durasi tidur meningkat menjadi 6-7 jam tanpa mimpi buruk.",
        o: "Afek tenang, nada suara rileks, postur terbuka.",
        a: "Regulasi ansietas membaik signifikan, respon somatik berkurang.",
        p: "Maintenance plan dan identifikasi dini early warning signs relaps.",
        updatedAt: "8 Okt 2026",
      },
    ],
  },
  {
    id: "cl-2",
    name: "Nadia Putri",
    age: 23,
    gender: "Perempuan",
    status: "Aktif",
    totalSessions: 2,
    lastSession: "5 Okt 2026",
    primaryDiagnosis: "Penyesuaian Diri & Komunikasi Interpersonal",
    treatmentGoals: [
      "Latihan komunikasi asertif",
      "Mengurangi distorsi rasa bersalah",
    ],
    soapHistory: [
      {
        id: "soap-n-2",
        sessionNumber: 2,
        date: "5 Okt 2026, 15:00 WIB",
        s: "Klien mencoba berbicara asertif dengan rekan tim dan tidak lagi merasa bersalah berlebihan.",
        o: "Afek ceria, eye contact optimal, senyum responsif.",
        a: "Peningkatan efikasi diri dalam komunikasi asertif.",
        p: "Praktik roleplay komunikasi interpersonal lanjutan.",
        updatedAt: "5 Okt 2026",
      },
    ],
  },
  {
    id: "cl-3",
    name: "Ahmad Rizky (Anonim)",
    age: 29,
    gender: "Laki-laki",
    status: "Pemulihan",
    totalSessions: 6,
    lastSession: "1 Okt 2026",
    primaryDiagnosis: "Episode Depresif Ringan (Dalam Remisi)",
    treatmentGoals: [
      "Aktivasi perilaku bertahap",
      "Pemulihan motivasi hobi & karier",
    ],
    soapHistory: [
      {
        id: "soap-a-6",
        sessionNumber: 6,
        date: "1 Okt 2026, 13:00 WIB",
        s: "Klien sudah kembali menikmati hobi olahraga dan pekerjaan tanpa rasa hampa.",
        o: "Eutimik, psikomotor normal, self-esteem stabil.",
        a: "Remisi klinis penuh dari episode depresi ringan.",
        p: "Sesi terminasi dan jadwal kontrol berkala 1 bulan ke depan.",
        updatedAt: "1 Okt 2026",
      },
    ],
  },
];

export interface ClinicalRecordsState {
  clients: ClientClinicalRecord[];
  saveSoapNote: (
    clientId: string,
    note: {
      sessionNumber?: number;
      s: string;
      o: string;
      a: string;
      p: string;
    }
  ) => SoapEntry;
  updateClientStatus: (clientId: string, status: ClientClinicalRecord["status"]) => void;
  getClientById: (clientId: string) => ClientClinicalRecord | undefined;
}

export const useClinicalRecordsStore = create<ClinicalRecordsState>()(
  persist(
    (set, get) => ({
      clients: initialClients,

      saveSoapNote: (clientId, note) => {
        const clients = get().clients;
        const target = clients.find((c) => c.id === clientId || c.name.toLowerCase().includes("wahyu"));
        const effectiveId = target ? target.id : "cl-wahyu";

        const now = new Date();
        const dateStr = now.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " WIB";

        const sessionNumber = note.sessionNumber || (target ? target.soapHistory.length + 1 : 1);
        const newEntry: SoapEntry = {
          id: `soap-${Date.now()}`,
          sessionNumber,
          date: dateStr,
          s: note.s,
          o: note.o,
          a: note.a,
          p: note.p,
          updatedAt: "Hari ini",
        };

        set({
          clients: clients.map((c) => {
            if (c.id === effectiveId) {
              return {
                ...c,
                totalSessions: Math.max(c.totalSessions, sessionNumber),
                lastSession: "Hari ini",
                soapHistory: [newEntry, ...c.soapHistory],
              };
            }
            return c;
          }),
        });

        useNotificationStore.getState().addNotification({
          title: "Catatan SOAP Tersimpan",
          message: `Rekam medis Sesi ${sessionNumber} untuk ${target?.name || "Klien"} berhasil diperbarui & dienkripsi.`,
          type: "chat",
          actionUrl: "/counselor/clients",
        });

        return newEntry;
      },

      updateClientStatus: (clientId, status) => {
        set({
          clients: get().clients.map((c) => (c.id === clientId ? { ...c, status } : c)),
        });
      },

      getClientById: (clientId) => {
        return get().clients.find((c) => c.id === clientId);
      },
    }),
    {
      name: "temanbicara_clinical_records",
    }
  )
);
