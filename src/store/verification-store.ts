import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface VerificationItem {
  id: string;
  applicantName: string;
  applicantEmail: string;
  roleType: "Psikolog Klinis" | "Pendengar Sebaya";
  credentialNumber: string;
  institution: string;
  submissionDate: string;
  documentName: string;
  status: "pending" | "approved" | "rejected";
  specialty?: string;
  notes?: string;
}

const initialVerifications: VerificationItem[] = [
  {
    id: "ver-1",
    applicantName: "Dr. Dimas Prasetyo, M.Psi",
    applicantEmail: "dimas@temanbicara.id",
    roleType: "Psikolog Klinis",
    credentialNumber: "SIPPK: 202104-1082-03",
    institution: "Magister Profesi Psikologi - Universitas Indonesia",
    submissionDate: "9 Okt 2026",
    documentName: "SIPPK_DimasPrasetyo_2026.pdf",
    status: "pending",
    specialty: "CBT & Manajemen Kecemasan",
  },
  {
    id: "ver-2",
    applicantName: "Fitri Handayani, S.Psi, M.Psi",
    applicantEmail: "fitri@temanbicara.id",
    roleType: "Psikolog Klinis",
    credentialNumber: "SIPPK: 201908-0914-02",
    institution: "Universitas Gadjah Mada • Anggota HIMPSI",
    submissionDate: "8 Okt 2026",
    documentName: "STR_Kemenkes_FitriH.pdf",
    status: "pending",
    specialty: "Trauma Recovery & Konseling Dewasa",
  },
  {
    id: "ver-3",
    applicantName: "Rendra Kurniawan, M.Psi",
    applicantEmail: "rendra@temanbicara.id",
    roleType: "Psikolog Klinis",
    credentialNumber: "SIPPK: 202301-1402-05",
    institution: "Universitas Padjadjaran",
    submissionDate: "7 Okt 2026",
    documentName: "SIPPK_RendraK_UNPAD.pdf",
    status: "pending",
    specialty: "Dinamika Keluarga & Hubungan",
  },
  {
    id: "ver-4",
    applicantName: "Dr. Anita Wijaya, M.Psi., Psikolog",
    applicantEmail: "anita@temanbicara.id",
    roleType: "Psikolog Klinis",
    credentialNumber: "SIPPK: 2021-0481",
    institution: "Universitas Indonesia • HIMPSI Pusat",
    submissionDate: "1 Okt 2026",
    documentName: "SIPPK_AnitaWijaya_Resmi.pdf",
    status: "approved",
    specialty: "Kecemasan, Burnout & Trauma Recovery",
  },
  {
    id: "ver-5",
    applicantName: "Dewi Lestari",
    applicantEmail: "dewi@temanbicara.id",
    roleType: "Pendengar Sebaya",
    credentialNumber: "Sertifikat PFA: WHO-ID-2024-819",
    institution: "Pelatihan Psychological First Aid WHO & Kemkes",
    submissionDate: "30 Sep 2026",
    documentName: "Sertifikat_PFA_Dewi.pdf",
    status: "approved",
    specialty: "Curhat Mahasiswa & Overthinking",
  },
];

export interface VerificationState {
  verifications: VerificationItem[];
  addVerification: (item: Omit<VerificationItem, "id" | "status" | "submissionDate">) => VerificationItem;
  updateStatus: (id: string, status: "approved" | "rejected") => void;
  getVerificationByEmail: (email: string) => VerificationItem | undefined;
}

export const useVerificationStore = create<VerificationState>()(
  persist(
    (set, get) => ({
      verifications: initialVerifications,

      addVerification: (data) => {
        const newItem: VerificationItem = {
          ...data,
          id: `ver-${Date.now()}`,
          status: "pending",
          submissionDate: new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        };

        set((state) => ({
          verifications: [newItem, ...state.verifications],
        }));

        return newItem;
      },

      updateStatus: (id, status) => {
        set((state) => ({
          verifications: state.verifications.map((item) =>
            item.id === id ? { ...item, status } : item
          ),
        }));
      },

      getVerificationByEmail: (email) => {
        const clean = email.trim().toLowerCase();
        return get().verifications.find(
          (v) => v.applicantEmail.toLowerCase() === clean
        );
      },
    }),
    {
      name: "temanbicara-verifications-storage",
    }
  )
);
