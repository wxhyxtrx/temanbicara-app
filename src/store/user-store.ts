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
  isAuthenticated: boolean;
  login: (email: string, name?: string) => UserProfile;
  loginWithRole: (role: UserRole) => UserProfile;
  switchRole: (role: UserRole) => void;
  register: (fullName: string, email: string, role?: UserRole) => UserProfile;
  updateProfile: (data: Partial<UserProfile>) => void;
  updateCoins: (newTotalOrDelta: number, isDelta?: boolean) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: mockUsers.patient,
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

        set({
          isAuthenticated: true,
          user: customUser,
        });
        return customUser;
      },

      loginWithRole: (role: UserRole) => {
        const targetUser = mockUsers[role] || mockUsers.patient;
        set({
          isAuthenticated: true,
          user: targetUser,
        });
        return targetUser;
      },

      switchRole: (role: UserRole) => {
        const targetUser = mockUsers[role] || mockUsers.patient;
        set({
          isAuthenticated: true,
          user: targetUser,
        });
      },

      register: (fullName, email, role = "patient") => {
        const initials = generateInitials(fullName);
        const base = mockUsers[role] || mockUsers.patient;
        const newUser: UserProfile = {
          ...base,
          id: `usr-${Date.now()}`,
          role,
          fullName,
          alias: fullName.split(" ")[0] || "Teman",
          email,
          avatarInitials: initials,
          patientId: `TB-${Math.floor(10000 + Math.random() * 90000)}`,
          coins: role === "patient" ? 50 : base.coins,
        };

        set({
          isAuthenticated: true,
          user: newUser,
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
        set({ user: updated });
      },

      updateCoins: (val, isDelta = false) => {
        const currentUser = get().user;
        const nextCoins = isDelta ? Math.max(0, currentUser.coins + val) : Math.max(0, val);
        set({ user: { ...currentUser, coins: nextCoins } });
      },

      logout: () => {
        set({ isAuthenticated: false });
      },
    }),
    {
      name: "tb_user_store_v3",
      version: 3,
      migrate: (persistedState: unknown) => {
        const state = persistedState as { user?: Partial<UserProfile> } | undefined;
        if (state && state.user) {
          if (!state.user.role) {
            state.user.role = "patient";
          }
        }
        return state as UserState;
      },
    }
  )
);
