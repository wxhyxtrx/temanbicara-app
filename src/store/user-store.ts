import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserProfile {
  id: string;
  patientId: string;
  fullName: string;
  alias: string;
  email: string;
  phone: string;
  avatarInitials: string;
  coins: number;
  isVerified: boolean;
  emergencyContact: string;
  mentalNotes: string;
  isAnonymousDefault: boolean;
}

const defaultUser: UserProfile = {
  id: "usr-01",
  patientId: "TB-88219",
  fullName: "Wahyu Tricahyo",
  alias: "Wahyu",
  email: "wahyu@temanbicara.id",
  phone: "+62 812-3456-7890",
  avatarInitials: "WT",
  coins: 50,
  isVerified: true,
  emergencyContact: "0811-9876-5432",
  mentalNotes: "Fokus konsultasi: manajemen kecemasan terkait deadline kerja dan pemulihan pola tidur.",
  isAnonymousDefault: false,
};

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
  login: (email: string, name?: string) => void;
  register: (fullName: string, email: string) => void;
  updateProfile: (data: Partial<UserProfile>) => void;
  updateCoins: (newTotalOrDelta: number, isDelta?: boolean) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: defaultUser,
      isAuthenticated: true,

      login: (email, name) => {
        const currentUser = get().user;
        const newName = name || (email.split("@")[0].replace(/[._]/g, " ") || "Pasien TemanBicara");
        const formattedName =
          newName.charAt(0).toUpperCase() + newName.slice(1);
        set({
          isAuthenticated: true,
          user: {
            ...currentUser,
            email,
            fullName: name ? formattedName : currentUser.fullName,
            avatarInitials: generateInitials(name ? formattedName : currentUser.fullName),
          },
        });
      },

      register: (fullName, email) => {
        const currentUser = get().user;
        const initials = generateInitials(fullName);
        set({
          isAuthenticated: true,
          user: {
            ...currentUser,
            fullName,
            alias: fullName.split(" ")[0] || "Pasien",
            email,
            avatarInitials: initials,
            patientId: `TB-${Math.floor(10000 + Math.random() * 90000)}`,
            coins: 50, // Welcome gift 1 session
          },
        });
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
      name: "tb_user_store",
      version: 2,
      migrate: (persistedState: unknown) => {
        const state = persistedState as { user?: UserProfile } | undefined;
        if (state && state.user) {
          if (["Matt", "Matthew", "Matthew Johnson"].includes(state.user.fullName)) {
            state.user.fullName = "Wahyu Tricahyo";
            state.user.avatarInitials = "WT";
          }
          if (!state.user.alias || ["Matt", "Matthew", "Pasien"].includes(state.user.alias)) {
            state.user.alias = state.user.fullName.trim().split(" ")[0] || "Wahyu";
          }
        }
        return state as UserState;
      },
    }
  )
);
