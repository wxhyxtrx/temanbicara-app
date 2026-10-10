import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useNotificationStore } from "@/store/notification-store";

export type SeverityLevel = "Normal" | "Ringan" | "Sedang" | "Parah" | "Sangat Parah";

export interface DASS21Result {
  id: string;
  date: string;
  timestamp: number;
  depressionScore: number; // 0 - 42
  depressionSeverity: SeverityLevel;
  anxietyScore: number; // 0 - 42
  anxietySeverity: SeverityLevel;
  stressScore: number; // 0 - 42
  stressSeverity: SeverityLevel;
  answers: Record<number, number>;
  recommendation: string;
}

export interface MoodLog {
  id: string;
  date: string;
  dayLabel: string;
  timestamp: number;
  mood: "senang" | "tenang" | "cemas" | "lelah" | "sedih" | "kewalahan";
  score: number; // 1 to 5 for charting
  intensity: number; // 1 - 5
  triggers: string[];
  note?: string;
}

// 21 Pertanyaan Resmi DASS-21 (Terjemahan Standar Psikologis Indonesia)
export interface DASSQuestion {
  id: number;
  category: "depression" | "anxiety" | "stress";
  text: string;
}

export const dass21Questions: DASSQuestion[] = [
  { id: 1, category: "stress", text: "Saya merasa sulit untuk menenangkan diri setelah merasa terganggu." },
  { id: 2, category: "anxiety", text: "Saya menyadari mulut saya terasa kering." },
  { id: 3, category: "depression", text: "Saya merasa tidak dapat merasakan perasaan positif sama sekali." },
  { id: 4, category: "anxiety", text: "Saya mengalami kesulitan bernapas (misal: napas cepat tanpa aktivitas fisik berat)." },
  { id: 5, category: "depression", text: "Saya merasa sulit untuk berinisiatif memulai melakukan sesuatu." },
  { id: 6, category: "stress", text: "Saya cenderung bereaksi berlebihan terhadap suatu situasi." },
  { id: 7, category: "anxiety", text: "Saya mengalami gemetar pada tangan atau bagian tubuh lainnya." },
  { id: 8, category: "stress", text: "Saya merasa menggunakan banyak energi saraf / merasa tegang terus-menerus." },
  { id: 9, category: "anxiety", text: "Saya khawatir terhadap situasi di mana saya bisa panik dan mempermalukan diri." },
  { id: 10, category: "depression", text: "Saya merasa tidak ada hal yang dapat diharapkan untuk masa depan saya." },
  { id: 11, category: "stress", text: "Saya merasa mudah gelisah atau terganggu saat tertekan." },
  { id: 12, category: "stress", text: "Saya merasa sulit untuk rileks atau melepaskan ketegangan otot." },
  { id: 13, category: "depression", text: "Saya merasa sedih, murung, dan tertekan." },
  { id: 14, category: "stress", text: "Saya tidak sabar terhadap hal-hal yang menghambat pekerjaan atau aktivitas saya." },
  { id: 15, category: "anxiety", text: "Saya merasa seperti hampir pingsan atau merasa panik." },
  { id: 16, category: "depression", text: "Saya merasa kehilangan antusiasme atau minat terhadap apapun." },
  { id: 17, category: "depression", text: "Saya merasa diri saya tidak berharga sebagai seorang manusia." },
  { id: 18, category: "stress", text: "Saya merasa mudah tersinggung atau sensitif terhadap perkataan orang." },
  { id: 19, category: "anxiety", text: "Saya menyadari detak jantung saya berdegup kencang tanpa alasan aktivitas fisik." },
  { id: 20, category: "anxiety", text: "Saya merasa takut tanpa alasan yang jelas atau masuk akal." },
  { id: 21, category: "depression", text: "Saya merasa bahwa hidup ini terasa hampa dan tidak berarti." },
];

export function calculateSeverity(category: "depression" | "anxiety" | "stress", rawScore: number): {
  multipliedScore: number;
  severity: SeverityLevel;
  colorClass: string;
} {
  const multipliedScore = rawScore * 2; // Formula standar DASS-21 ke DASS-42
  let severity: SeverityLevel = "Normal";
  let colorClass = "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200";

  if (category === "depression") {
    if (multipliedScore <= 9) {
      severity = "Normal";
      colorClass = "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200";
    } else if (multipliedScore <= 13) {
      severity = "Ringan";
      colorClass = "text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 border-teal-200";
    } else if (multipliedScore <= 20) {
      severity = "Sedang";
      colorClass = "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200";
    } else if (multipliedScore <= 27) {
      severity = "Parah";
      colorClass = "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200";
    } else {
      severity = "Sangat Parah";
      colorClass = "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/60 border-red-200";
    }
  } else if (category === "anxiety") {
    if (multipliedScore <= 7) {
      severity = "Normal";
      colorClass = "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200";
    } else if (multipliedScore <= 9) {
      severity = "Ringan";
      colorClass = "text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 border-teal-200";
    } else if (multipliedScore <= 14) {
      severity = "Sedang";
      colorClass = "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200";
    } else if (multipliedScore <= 19) {
      severity = "Parah";
      colorClass = "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200";
    } else {
      severity = "Sangat Parah";
      colorClass = "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/60 border-red-200";
    }
  } else {
    // Stress
    if (multipliedScore <= 14) {
      severity = "Normal";
      colorClass = "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200";
    } else if (multipliedScore <= 18) {
      severity = "Ringan";
      colorClass = "text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 border-teal-200";
    } else if (multipliedScore <= 25) {
      severity = "Sedang";
      colorClass = "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200";
    } else if (multipliedScore <= 33) {
      severity = "Parah";
      colorClass = "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200";
    } else {
      severity = "Sangat Parah";
      colorClass = "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/60 border-red-200";
    }
  }

  return { multipliedScore, severity, colorClass };
}

// Data historis awal agar grafik mood dan rekam asesmen langsung visual
const initialDassHistory: DASS21Result[] = [
  {
    id: "dass-hist-1",
    date: "08 Okt 2026, 14:30 WIB",
    timestamp: 1791454200000,
    depressionScore: 6,
    depressionSeverity: "Normal",
    anxietyScore: 16,
    anxietySeverity: "Parah",
    stressScore: 18,
    stressSeverity: "Sedang",
    answers: {},
    recommendation:
      "Tingkat kecemasan tinggi terdeteksi dengan somatisasi. Disarankan sesi konseling CBT regulasi kecemasan bersama Dr. Anita Wijaya.",
  },
];

const initialMoodLogs: MoodLog[] = [
  { id: "m-1", date: "4 Okt", dayLabel: "Min", timestamp: 1, mood: "lelah", score: 2, intensity: 3, triggers: ["Pekerjaan"] },
  { id: "m-2", date: "5 Okt", dayLabel: "Sen", timestamp: 2, mood: "cemas", score: 2, intensity: 4, triggers: ["Deadline", "Meeting"] },
  { id: "m-3", date: "6 Okt", dayLabel: "Sel", timestamp: 3, mood: "kewalahan", score: 1, intensity: 5, triggers: ["Kurang Tidur"] },
  { id: "m-4", date: "7 Okt", dayLabel: "Rab", timestamp: 4, mood: "tenang", score: 4, intensity: 2, triggers: ["Latihan Napas"] },
  { id: "m-5", date: "8 Okt", dayLabel: "Kam", timestamp: 5, mood: "cemas", score: 2, intensity: 3, triggers: ["Presentasi"] },
  { id: "m-6", date: "9 Okt", dayLabel: "Jum", timestamp: 6, mood: "tenang", score: 4, intensity: 2, triggers: ["Konseling"] },
  { id: "m-7", date: "10 Okt", dayLabel: "Sab", timestamp: 7, mood: "senang", score: 5, intensity: 1, triggers: ["Istirahat", "Keluarga"] },
];

export interface AssessmentState {
  dassResults: DASS21Result[];
  latestResult: DASS21Result | null;
  moodLogs: MoodLog[];
  todayMood: MoodLog | null;

  saveDASSResult: (answers: Record<number, number>) => DASS21Result;
  saveMoodLog: (mood: MoodLog["mood"], intensity: number, triggers: string[], note?: string) => MoodLog;
}

export const useAssessmentStore = create<AssessmentState>()(
  persist(
    (set, get) => ({
      dassResults: initialDassHistory,
      latestResult: initialDassHistory[0],
      moodLogs: initialMoodLogs,
      todayMood: initialMoodLogs[initialMoodLogs.length - 1],

      saveDASSResult: (answers) => {
        let rawDep = 0;
        let rawAnx = 0;
        let rawStr = 0;

        dass21Questions.forEach((q) => {
          const val = answers[q.id] ?? 0;
          if (q.category === "depression") rawDep += val;
          else if (q.category === "anxiety") rawAnx += val;
          else if (q.category === "stress") rawStr += val;
        });

        const dep = calculateSeverity("depression", rawDep);
        const anx = calculateSeverity("anxiety", rawAnx);
        const str = calculateSeverity("stress", rawStr);

        let recommendation = "Kondisi emosi Anda berada dalam rentang wajar. Pertahankan keseimbangan batin dengan latihan mindfulness harian.";
        if (anx.severity === "Parah" || anx.severity === "Sangat Parah" || dep.severity === "Parah" || dep.severity === "Sangat Parah") {
          recommendation = "Skor Anda menunjukkan indikasi kecemasan/depresi yang membutuhkan pendampingan profesional. Sangat disarankan berkonsultasi dengan Psikolog Klinis terverifikasi.";
        } else if (str.severity === "Sedang" || anx.severity === "Sedang" || dep.severity === "Sedang") {
          recommendation = "Anda mengalami stres dan ketegangan tingkat sedang. Luapkan uneg-uneg dengan Pendengar Sebaya terlatih atau jadwalkan sesi konseling terarah.";
        }

        const newResult: DASS21Result = {
          id: `dass-${Date.now()}`,
          date: new Date().toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }) + " WIB",
          timestamp: Date.now(),
          depressionScore: dep.multipliedScore,
          depressionSeverity: dep.severity,
          anxietyScore: anx.multipliedScore,
          anxietySeverity: anx.severity,
          stressScore: str.multipliedScore,
          stressSeverity: str.severity,
          answers,
          recommendation,
        };

        set({
          dassResults: [newResult, ...get().dassResults],
          latestResult: newResult,
        });

        useNotificationStore.getState().addNotification({
          title: "Hasil Asesmen DASS-21 Selesai",
          message: `Skor terbaru: Depresi ${dep.severity}, Ansietas ${anx.severity}, Stres ${str.severity}.`,
          type: "sistem",
          actionUrl: "/patient/assessment",
        });

        return newResult;
      },

      saveMoodLog: (mood, intensity, triggers, note) => {
        const scoreMap: Record<MoodLog["mood"], number> = {
          senang: 5,
          tenang: 4,
          lelah: 3,
          cemas: 2,
          sedih: 2,
          kewalahan: 1,
        };

        const todayDate = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short" });
        const todayDayLabel = new Date().toLocaleDateString("id-ID", { weekday: "short" });

        const newLog: MoodLog = {
          id: `mood-${Date.now()}`,
          date: todayDate,
          dayLabel: todayDayLabel,
          timestamp: Date.now(),
          mood,
          score: scoreMap[mood],
          intensity,
          triggers,
          note,
        };

        // Filter out today if already checked in, then append
        const filtered = get().moodLogs.filter((m) => m.date !== todayDate);
        const updated = [...filtered, newLog];

        set({
          moodLogs: updated,
          todayMood: newLog,
        });

        return newLog;
      },
    }),
    {
      name: "tb_assessment_store_v1",
    }
  )
);
