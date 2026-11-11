import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile, UserRole } from "@/constant/mock-users";
import type {
  MeProfile,
  PasienProfile,
  PsikologProfile,
  RelawanProfile,
  AdminProfile,
} from "@/types/user-profile";

export type { UserProfile, UserRole } from "@/constant/mock-users";

function generateInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name.slice(0, 2) || "").toUpperCase();
}

export interface UserState {
  user: UserProfile;
  profileError: string | null;
  isAuthenticated: boolean;
  isProfileLoaded: boolean;
  updateProfile: (data: Partial<UserProfile>) => void;
  updateCoins: (newTotalOrDelta: number, isDelta?: boolean) => void;
  setAuthSession: (
    sessionUser: {
      id: string;
      email: string;
      role: string;
      status: string;
      avatar_url: string | null;
      fullName?: string;
      no_wa?: string | null;
    },
    profile?: MeProfile | null,
    legacyProfile?: MeProfile | null
  ) => void;
  syncSession: (options?: { silent?: boolean }) => Promise<void>;
  logout: () => void;
}

export const PERSISTENT_STORES_TO_CLEAR = [
  "tb_access_token",
  "tb_user_store_v4",
  "tb_peer_vent_store_v1",
  "tb_chat_store_v3",
  "tb_schedule_store",
  "tb_notification_store",
  "tb_transaction_store",
  "temanbicara_clinical_records",
  "temanbicara_session_reviews",
  "tb_crisis_store_v1",
] as const;

const EMPTY_PROFILE: UserProfile = {
  id: "", role: "" as UserRole, fullName: "", alias: "", email: "",
  phone: "", avatarInitials: "", coins: 0, isVerified: false,
  patientId: "", emergencyContact: "", mentalNotes: "", isAnonymousDefault: false,
};

const createInitialUserState = () => ({
  user: EMPTY_PROFILE,
  isAuthenticated: false,
  isProfileLoaded: false,
  profileError: null as string | null,
});

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      ...createInitialUserState(),

      updateProfile: (data) => {
        if (!get().isProfileLoaded) return;
        const currentUser = get().user;
        const updated = { ...currentUser, ...data };
        if (data.fullName) {
          updated.avatarInitials = generateInitials(data.fullName);
          if (
            !data.alias ||
            ["Matt", "Matthew", "Matthew Johnson", "Pasien"].includes(data.alias) ||
            data.alias === currentUser.fullName.split(" ")[0]
          ) {
            updated.alias = data.fullName.trim().split(" ")[0] || "";
          }
        }
        set({ user: updated });
      },

      updateCoins: (val, isDelta = false) => {
        if (!get().isProfileLoaded) return;
        const currentUser = get().user;
        const nextCoins = isDelta ? Math.max(0, currentUser.coins + val) : Math.max(0, val);
        const updatedUser = { ...currentUser, coins: nextCoins };
        set({ user: updatedUser });
      },

      setAuthSession: (sessionUser, profileOrLegacy, legacyProfile) => {
        const profile: MeProfile | null =
          legacyProfile !== undefined
            ? legacyProfile
            : typeof profileOrLegacy === "object"
            ? profileOrLegacy
            : null;
        const roleMap: Record<string, UserRole> = {
          pasien: "patient",
          relawan: "peer_listener",
          psikolog: "counselor",
          admin: "admin",
          patient: "patient",
          peer_listener: "peer_listener",
          counselor: "counselor",
        };
        const mappedRole = roleMap[sessionUser.role];
        if (!mappedRole || !sessionUser.id || !sessionUser.email) {
          set({ user: EMPTY_PROFILE, isProfileLoaded: false, profileError: "Data akun gagal dimuat" });
          return;
        }
        const baseProfile = EMPTY_PROFILE;
        const displayName = sessionUser.fullName || "";
        let patientData: UserProfile["patientData"];
        let counselorData: UserProfile["counselorData"];
        let listenerData: UserProfile["listenerData"];
        let adminData: UserProfile["adminData"];
        let alias = displayName.split(" ")[0];
        const phone = sessionUser.no_wa || "";
        let emergencyContact = "";
        let isAnonymousDefault = false;

        if (profile) {
          if (mappedRole === "patient") {
            const p = profile as PasienProfile;
            alias = p.nama_lengkap ? p.nama_lengkap.split(" ")[0] : alias;
            emergencyContact = p.kontak_darurat_nama
              ? `${p.kontak_darurat_nama}${p.kontak_darurat_wa ? `: ${p.kontak_darurat_wa}` : ""}`
              : "";
            isAnonymousDefault = Boolean(p.is_anonim_default);
            patientData = {
              patientId: p.user_id,
              coins: baseProfile.coins || 0,
              emergencyContact,
              mentalNotes: baseProfile.mentalNotes || "",
              isAnonymousDefault,
            };
          } else if (mappedRole === "counselor") {
            const c = profile as PsikologProfile;
            alias = c.nama_lengkap_gelar || displayName;
            counselorData = {
              licenseNumber: c.nomor_sipp_str || "",
              sippkNumber: c.nomor_sipp_str || "",
              specialty:
                Array.isArray(c.spesialisasi) && c.spesialisasi.length > 0
                  ? c.spesialisasi.join(", ")
                  : "Psikologi Klinis",
              specializations: c.spesialisasi || [],
              title: c.nama_lengkap_gelar || displayName,
              experienceYears: c.tahun_pengalaman || 0,
              hourlyRateCoins: Number(c.tarif_sesi) || 0,
              rating: 5.0,
              totalConsultations: 0,
              consultationMethods: ["chat", "voice"],
              earningsCoins: Number(c.saldo) || 0,
              isAvailable: true,
            };
          } else if (mappedRole === "peer_listener") {
            const l = profile as RelawanProfile;
            alias =
              l.alias_name || (l.nama_lengkap ? l.nama_lengkap.split(" ")[0] : "Teman Pendengar");
            listenerData = {
              listenerBadge: "Pendengar Terlatih",
              badgeLevel: "Relawan",
              topicsHandled: l.topik_keahlian || [],
              supportTopics: l.topik_keahlian || [],
              sessionsCompleted: l.total_sesi || 0,
              rating: l.rating_rata_rata != null ? Number(l.rating_rata_rata) : 5.0,
              empathyScore: 95,
              status: l.is_available ? "online" : "offline",
              isOnline: Boolean(l.is_available),
            };
          } else if (mappedRole === "admin") {
            const a = profile as AdminProfile;
            adminData = {
              department: a.level || "Operator",
              permissions: ["all"],
            };
          }
        }

        const updatedUser: UserProfile = {
          ...baseProfile,
          id: sessionUser.id,
          email: sessionUser.email,
          fullName: sessionUser.fullName || displayName,
          alias,
          phone,
          role: mappedRole,
          avatarInitials: generateInitials(displayName),
          avatarUrl: sessionUser.avatar_url || baseProfile.avatarUrl,
          rawProfile: profile || null,
          patientData,
          counselorData,
          listenerData,
          adminData,
          emergencyContact,
          isAnonymousDefault,
        };

        set({
          isAuthenticated: true,
          isProfileLoaded: true,
          user: updatedUser,
          profileError: null,
        });

        if (typeof window !== "undefined") {
          localStorage.removeItem("tb_access_token");
          document.cookie = `tb_user_status=${sessionUser.status || "active"}; path=/; max-age=604800; SameSite=Lax`;
        }
      },

      syncSession: async ({ silent = false } = {}) => {
        if (typeof window === "undefined") return;
        set({ profileError: null });

        const maxAttempts = silent ? 2 : 1;

        // 1. Fetch sesi real-time dari backend (/api/users/me)
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const fetchInit: RequestInit & { _skipUnauthorizedRedirect?: boolean } = {
              credentials: "include",
              ...(silent ? { _skipUnauthorizedRedirect: true } : {}),
            };
            const res = await fetch("/api/users/me", fetchInit as RequestInit);
            if (res.status === 401) {
              // Sesi token tidak valid atau kedaluwarsa di backend
              get().logout();
              if (silent) return;
              if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
                const currentPath = window.location.pathname + window.location.search;
                const loginUrl = new URL("/login", window.location.origin);
                loginUrl.searchParams.set("expired", "true");
                if (currentPath && currentPath !== "/") {
                  loginUrl.searchParams.set("callbackUrl", currentPath);
                }
                window.location.href = loginUrl.toString();
              }
              return;
            }
            if (res.ok) {
              const json = await res.json();
              if (json?.data?.user) {
                get().setAuthSession(json.data.user, json.data.profile || null);
                if (!get().profileError) return;
                if (silent) set({ profileError: null });
              }
            }
          } catch {
            // Lanjut ke mekanisme retry (bila silent) atau set state akhir di bawah
          }

          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        }

        set(
          silent
            ? createInitialUserState()
            : { user: EMPTY_PROFILE, isProfileLoaded: false, profileError: "Data akun gagal dimuat" }
        );
      },

      logout: () => {
        if (typeof window !== "undefined") {
          PERSISTENT_STORES_TO_CLEAR.forEach((key) => {
            localStorage.removeItem(key);
          });
          document.cookie = "tb_user_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "tb_user_status=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
        set({
          ...createInitialUserState(),
        });
      },
    }),
    {
      name: "tb_user_store_v4",
      version: 4,
      // Never hydrate identity or role from a previous browser session.
      partialize: () => ({}),
      merge: (_persistedState, currentState) => currentState,
    }
  )
);
