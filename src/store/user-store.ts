import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mockUsers, UserProfile, UserRole } from "@/constant/mock-users";

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
  login: (email: string, name?: string) => UserProfile;
  loginWithRole: (role: UserRole) => UserProfile;
  switchRole: (role: UserRole) => void;
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
    },
    token?: string
  ) => void;
  syncSession: () => Promise<void>;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: mockUsers.patient,
      roleProfiles: { ...mockUsers },
      isAuthenticated: false,

      login: (email, name) => {
        // Cek apakah email cocok dengan akun preset mock
        const cleanEmail = email.trim().toLowerCase();
        const matchedMock = (Object.values(mockUsers) as UserProfile[]).find(
          (u) => u.email.toLowerCase() === cleanEmail
        );

        if (matchedMock) {
          set({
            isAuthenticated: true,
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

      loginWithRole: (role: UserRole) => {
        const profiles = get().roleProfiles || { ...mockUsers };
        const targetUser = profiles[role] || mockUsers[role] || mockUsers.patient;
        set({
          isAuthenticated: true,
          user: targetUser,
        });
        if (typeof window !== "undefined") {
          localStorage.setItem("tb_access_token", `demo-token-${role}`);
          document.cookie = `tb_access_token=demo-token-${role}; path=/; max-age=604800; SameSite=Lax`;
          document.cookie = `tb_user_role=${role}; path=/; max-age=604800; SameSite=Lax`;
          document.cookie = `tb_user_status=active; path=/; max-age=604800; SameSite=Lax`;
        }
        return targetUser;
      },

      switchRole: (role: UserRole) => {
        const currentUser = get().user;
        const profiles = get().roleProfiles || { ...mockUsers };
        const updatedProfiles = {
          ...profiles,
          [currentUser.role]: currentUser,
        };
        const targetUser = updatedProfiles[role] || mockUsers[role] || mockUsers.patient;
        set({
          isAuthenticated: true,
          roleProfiles: updatedProfiles,
          user: targetUser,
        });
        if (typeof window !== "undefined") {
          document.cookie = `tb_user_role=${role}; path=/; max-age=604800; SameSite=Lax`;
        }
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
          coins: role === "patient" ? 50 : base.coins,
          ...extraData,
        };

        const profiles = get().roleProfiles || { ...mockUsers };
        set({
          isAuthenticated: true,
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

      setAuthSession: (sessionUser, token) => {
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
        const updatedUser: UserProfile = {
          ...baseProfile,
          id: sessionUser.id,
          email: sessionUser.email,
          fullName: sessionUser.fullName || baseProfile.fullName,
          role: mappedRole,
          avatarInitials: generateInitials(displayName),
          avatarUrl: sessionUser.avatar_url || baseProfile.avatarUrl,
        };

        set({
          isAuthenticated: true,
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
          document.cookie = `tb_user_role=${mappedRole}; path=/; max-age=604800; SameSite=Lax`;
          document.cookie = `tb_user_status=${sessionUser.status || "active"}; path=/; max-age=604800; SameSite=Lax`;
        }
      },

      syncSession: async () => {
        if (typeof window === "undefined") return;
        const matchToken = document.cookie.match(/tb_access_token=([^;]+)/);
        const matchRole = document.cookie.match(/tb_user_role=([^;]+)/);
        const token = matchToken ? matchToken[1] : null;
        const cookieRoleRaw = matchRole ? matchRole[1] : null;

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

        // 1. Coba fetch sesi real-time dari backend
        try {
          const res = await fetch("/api/auth/me");
          if (res.ok) {
            const json = await res.json();
            if (json?.data?.user) {
              get().setAuthSession(json.data.user, token);
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
              user: targetUser,
            });
          }
        }
      },

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("tb_access_token");
          localStorage.removeItem("tb_user_store_v4");
          document.cookie = "tb_access_token=; path=/; max-age=0";
          document.cookie = "tb_user_role=; path=/; max-age=0";
          document.cookie = "tb_user_status=; path=/; max-age=0";
        }
        set({
          isAuthenticated: false,
          user: mockUsers.patient,
        });
      },
    }),
    {
      name: "tb_user_store_v4",
      version: 4,
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
