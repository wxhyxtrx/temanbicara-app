import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mockUsers, UserProfile, UserRole } from "@/constant/mock-users";
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
  return (name.slice(0, 2) || "TB").toUpperCase();
}

export interface UserState {
  user: UserProfile;
  roleProfiles: Record<UserRole, UserProfile>;
  isAuthenticated: boolean;
  isProfileLoaded: boolean;
  login: (email: string, name?: string) => UserProfile;
  register: (
    fullName: string,
    email: string,
    role?: UserRole,
    extraData?: Partial<UserProfile>
  ) => UserProfile;
  updateProfile: (data: Partial<UserProfile>) => void;
  updateCoins: (newTotalOrDelta: number, isDelta?: boolean) => void;
  creditCounselorCoins: (coins: number) => void;
  creditListenerCoins: (coins: number) => void;
  sendTip: (recipientRole: "counselor" | "peer_listener", amount: number) => boolean;
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
    token?: string,
    profile?: MeProfile | null
  ) => void;
  syncSession: () => Promise<void>;
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

const createInitialUserState = () => ({
  user: { ...mockUsers.patient },
  roleProfiles: { ...mockUsers },
  isAuthenticated: false,
  isProfileLoaded: false,
});

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      ...createInitialUserState(),

      login: (email, name) => {
        // Cek apakah email cocok dengan akun preset mock
        const cleanEmail = email.trim().toLowerCase();
        const matchedMock = (Object.values(mockUsers) as UserProfile[]).find(
          (u) => u.email.toLowerCase() === cleanEmail
        );

        if (matchedMock) {
          set({
            isAuthenticated: true,
            isProfileLoaded: true,
            user: matchedMock,
          });
          if (typeof window !== "undefined") {
            document.cookie = `tb_access_token=mock-token-${matchedMock.role}; path=/; max-age=604800; SameSite=Lax`;
            document.cookie = `tb_user_role=${matchedMock.role}; path=/; max-age=604800; SameSite=Lax`;
            document.cookie = `tb_user_status=active; path=/; max-age=604800; SameSite=Lax`;
          }
          return matchedMock;
        }

        // Akun custom
        const currentUser = get().user;
        const newName = name || (cleanEmail.split("@")[0].replace(/[._]/g, " ") || "Pengguna TemanBicara");
        const formattedName = newName.charAt(0).toUpperCase() + newName.slice(1);
        const customUser: UserProfile = {
          ...currentUser,
          email: cleanEmail,
          fullName: name ? formattedName : currentUser.fullName,
          avatarInitials: generateInitials(name ? formattedName : currentUser.fullName),
          role: currentUser.role || "patient",
        };

        const profiles = get().roleProfiles || { ...mockUsers };
        set({
          isAuthenticated: true,
          isProfileLoaded: true,
          user: customUser,
          roleProfiles: {
            ...profiles,
            [customUser.role]: customUser,
          },
        });
        if (typeof window !== "undefined") {
          document.cookie = `tb_access_token=custom-token; path=/; max-age=604800; SameSite=Lax`;
          document.cookie = `tb_user_role=${customUser.role}; path=/; max-age=604800; SameSite=Lax`;
          document.cookie = `tb_user_status=active; path=/; max-age=604800; SameSite=Lax`;
        }
        return customUser;
      },

      register: (fullName, email, role = "patient", extraData?: Partial<UserProfile>) => {
        const initials = generateInitials(fullName);
        const base = mockUsers[role] || mockUsers.patient;
        const newUser: UserProfile = {
          ...base,
          id: `usr-${Date.now()}`,
          role,
          fullName,
          alias: extraData?.alias || fullName.split(" ")[0] || "Teman",
          email,
          avatarInitials: initials,
          patientId: `TB-${Math.floor(10000 + Math.random() * 90000)}`,
          coins: 0,
          ...extraData,
        };

        const profiles = get().roleProfiles || { ...mockUsers };
        set({
          isAuthenticated: true,
          isProfileLoaded: true,
          user: newUser,
          roleProfiles: {
            ...profiles,
            [role]: newUser,
          },
        });
        return newUser;
      },

      updateProfile: (data) => {
        const currentUser = get().user;
        const updated = { ...currentUser, ...data };
        if (data.fullName) {
          updated.avatarInitials = generateInitials(data.fullName);
          if (
            !data.alias ||
            ["Matt", "Matthew", "Matthew Johnson", "Pasien"].includes(data.alias) ||
            data.alias === currentUser.fullName.split(" ")[0]
          ) {
            updated.alias = data.fullName.trim().split(" ")[0] || "Wahyu";
          }
        }
        const profiles = get().roleProfiles || { ...mockUsers };
        set({
          user: updated,
          roleProfiles: {
            ...profiles,
            [currentUser.role]: updated,
          },
        });
      },

      updateCoins: (val, isDelta = false) => {
        const currentUser = get().user;
        const nextCoins = isDelta ? Math.max(0, currentUser.coins + val) : Math.max(0, val);
        const updatedUser = { ...currentUser, coins: nextCoins };
        const profiles = get().roleProfiles || { ...mockUsers };
        set({
          user: updatedUser,
          roleProfiles: {
            ...profiles,
            [currentUser.role]: updatedUser,
          },
        });
      },

      creditCounselorCoins: (coins: number) => {
        const profiles = get().roleProfiles || { ...mockUsers };
        const currentCounselor = profiles.counselor || mockUsers.counselor;
        const nextCoins = Math.max(0, currentCounselor.coins + coins);
        const updatedCounselor = {
          ...currentCounselor,
          coins: nextCoins,
        };
        const currentUser = get().user;
        set({
          roleProfiles: {
            ...profiles,
            counselor: updatedCounselor,
          },
          user: currentUser.role === "counselor" ? updatedCounselor : currentUser,
        });
      },

      creditListenerCoins: (coins: number) => {
        const profiles = get().roleProfiles || { ...mockUsers };
        const currentListener = profiles.peer_listener || mockUsers.peer_listener;
        const nextCoins = Math.max(0, currentListener.coins + coins);
        const updatedListener = {
          ...currentListener,
          coins: nextCoins,
        };
        const currentUser = get().user;
        set({
          roleProfiles: {
            ...profiles,
            peer_listener: updatedListener,
          },
          user: currentUser.role === "peer_listener" ? updatedListener : currentUser,
        });
      },

      sendTip: (recipientRole: "counselor" | "peer_listener", amount: number) => {
        const currentUser = get().user;
        if (currentUser.coins < amount) return false;

        // Potong koin pengirim (pasien)
        const updatedSender = {
          ...currentUser,
          coins: currentUser.coins - amount,
        };

        const profiles = get().roleProfiles || { ...mockUsers };
        const targetProfile = profiles[recipientRole] || mockUsers[recipientRole];
        const updatedTarget = {
          ...targetProfile,
          coins: targetProfile.coins + amount,
        };

        set({
          user: updatedSender,
          roleProfiles: {
            ...profiles,
            [currentUser.role]: updatedSender,
            [recipientRole]: updatedTarget,
          },
        });
        return true;
      },

      setAuthSession: (sessionUser, token, profile) => {
        const roleMap: Record<string, UserRole> = {
          pasien: "patient",
          relawan: "peer_listener",
          psikolog: "counselor",
          admin: "admin",
          patient: "patient",
          peer_listener: "peer_listener",
          counselor: "counselor",
        };
        const mappedRole: UserRole = roleMap[sessionUser.role] || "patient";
        const profiles = get().roleProfiles || { ...mockUsers };
        const baseProfile = profiles[mappedRole] || mockUsers[mappedRole] || mockUsers.patient;

        const displayName = sessionUser.fullName || sessionUser.email.split("@")[0];

        let patientData = baseProfile.patientData;
        let counselorData = baseProfile.counselorData;
        let listenerData = baseProfile.listenerData;
        let adminData = baseProfile.adminData;

        let alias = sessionUser.fullName ? sessionUser.fullName.split(" ")[0] : displayName;
        let phone = sessionUser.no_wa || baseProfile.phone || "";
        let emergencyContact = baseProfile.emergencyContact || "";
        let isAnonymousDefault = baseProfile.isAnonymousDefault || false;

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
          isProfileLoaded: Boolean(profile),
          user: updatedUser,
          roleProfiles: {
            ...profiles,
            [mappedRole]: updatedUser,
          },
        });

        if (typeof window !== "undefined") {
          if (token) {
            localStorage.setItem("tb_access_token", token);
          }
          document.cookie = `tb_access_token=${token || "session-token"}; path=/; max-age=604800; SameSite=Lax`;
          document.cookie = `tb_user_status=${sessionUser.status || "active"}; path=/; max-age=604800; SameSite=Lax`;
        }
      },

      syncSession: async () => {
        if (typeof window === "undefined") return;
        const matchToken = document.cookie.match(/tb_access_token=([^;]+)/);
        const matchRole = document.cookie.match(/tb_user_role=([^;]+)/);
        const token = matchToken ? matchToken[1] : null;
        const cookieRoleRaw = matchRole ? matchRole[1].split('.')[0] : null;

        if (!token) {
          if (get().isAuthenticated) {
            set({ isAuthenticated: false });
          }
          return;
        }

        const roleMap: Record<string, UserRole> = {
          pasien: "patient",
          relawan: "peer_listener",
          psikolog: "counselor",
          admin: "admin",
          patient: "patient",
          peer_listener: "peer_listener",
          counselor: "counselor",
        };

        // 1. Fetch sesi real-time dari backend (/api/users/me)
        try {
          const res = await fetch("/api/users/me");
          if (res.status === 401) {
            // Sesi token tidak valid atau kedaluwarsa di backend
            get().logout();
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
              get().setAuthSession(json.data.user, token, json.data.profile || null);
              set({ isProfileLoaded: true });
              return;
            }
          }
        } catch {
          // Abaikan kesalahan jaringan sementara, gunakan fallback cookie
        }

        // 2. Fallback instan dari cookie jika fetch tertunda
        if (cookieRoleRaw) {
          const mapped = roleMap[cookieRoleRaw] || "patient";
          if (get().user.role !== mapped || !get().isAuthenticated) {
            const profiles = get().roleProfiles || { ...mockUsers };
            const targetUser = profiles[mapped] || mockUsers[mapped] || mockUsers.patient;
            set({
              isAuthenticated: true,
              isProfileLoaded: true,
              user: targetUser,
            });
          }
        }
      },

      logout: () => {
        if (typeof window !== "undefined") {
          PERSISTENT_STORES_TO_CLEAR.forEach((key) => {
            localStorage.removeItem(key);
          });
          document.cookie = "tb_access_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
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
      partialize: (state) => ({
        user: state.user,
        roleProfiles: state.roleProfiles,
        isAuthenticated: state.isAuthenticated,
      }),
      migrate: (persistedState: unknown) => {
        const state = persistedState as {
          user?: Partial<UserProfile>;
          roleProfiles?: Record<UserRole, UserProfile>;
        } | undefined;
        if (state && state.user) {
          if (!state.user.role) {
            state.user.role = "patient";
          }
        }
        if (state && !state.roleProfiles) {
          state.roleProfiles = { ...mockUsers };
        }
        return state as UserState;
      },
    }
  )
);
