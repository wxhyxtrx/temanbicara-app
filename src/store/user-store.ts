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
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: mockUsers.patient,
      roleProfiles: { ...mockUsers },
      isAuthenticated: true,

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
        return customUser;
      },

      loginWithRole: (role: UserRole) => {
        const profiles = get().roleProfiles || { ...mockUsers };
        const targetUser = profiles[role] || mockUsers[role] || mockUsers.patient;
        set({
          isAuthenticated: true,
          user: targetUser,
        });
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

      logout: () => {
        set({ isAuthenticated: false });
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
