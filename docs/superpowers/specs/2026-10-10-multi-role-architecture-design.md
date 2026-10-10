# Multi-Role Architecture Design Spec - TemanBicara

**Date:** 2026-10-10  
**Status:** Approved  
**Project:** TemanBicara (Mental Health & Counseling Platform)

---

## 1. Background & Objectives
TemanBicara is a mental health sanctuary and counseling platform. Previously, the application only accommodated a single hardcoded user view—specifically the Patient/Client view—stored in client-side state with hardcoded labels and badges.

The objective of this architecture is to transform TemanBicara into a robust, structured **Multi-Role Application** supporting 4 distinct ecosystem actors:
1. **Patient (`patient`)**: Client seeking emotional support, booking certified counselors, instant AI chat, mood tracking, and coin management.
2. **Counselor (`counselor`)**: Licensed Clinical Psychologist / Counselor (SIPPK/STR) managing session schedules, confirming appointments, reviewing patient progress, and earning coins.
3. **Peer Listener (`peer_listener`)**: Trained volunteer listener providing free, anonymous Psychological First Aid (PFA) and listening queues.
4. **Administrator (`admin`)**: Platform supervisor managing counselor license verification, transaction audits, user permissions, and crisis escalation.

This spec prepares modular data structures that mirror future REST/API responses and establishes role-prefixed routing with route protection.

---

## 2. User Roles & Data Models

### 2.1 Role Definition
```typescript
export type UserRole = "patient" | "counselor" | "peer_listener" | "admin";
```

### 2.2 Profile Schema (`src/constant/mock-users.ts` & `src/store/user-store.ts`)
```typescript
export interface BaseUserProfile {
  id: string;
  role: UserRole;
  fullName: string;
  alias: string;
  email: string;
  phone: string;
  avatarInitials: string;
  isVerified: boolean;
  avatarUrl?: string;
}

export interface PatientData {
  patientId: string;
  coins: number;
  emergencyContact: string;
  mentalNotes: string;
  isAnonymousDefault: boolean;
}

export interface CounselorData {
  licenseNumber: string; // SIPPK / STR HIMPSI
  specialty: string;
  title: string;
  experienceYears: number;
  hourlyRateCoins: number;
  rating: number;
  totalConsultations: number;
  consultationMethods: ("chat" | "voice")[];
  earningsCoins: number;
}

export interface ListenerData {
  listenerBadge: string;
  topicsHandled: string[];
  sessionsCompleted: number;
  rating: number;
  status: "online" | "offline" | "busy";
}

export interface AdminData {
  department: string;
  permissions: string[];
}

export interface UserProfile extends BaseUserProfile {
  patientData?: PatientData;
  counselorData?: CounselorData;
  listenerData?: ListenerData;
  adminData?: AdminData;
}
```

### 2.3 Pre-configured Mock Accounts (Ready for Quick Demo & API Replacement)
1. **Patient:** `wahyu@temanbicara.id` (Wahyu Tricahyo) — 50 Coins, verified patient.
2. **Counselor:** `anita@temanbicara.id` (Dr. Anita Wijaya, M.Psi., Psikolog) — SIPPK-2021-0481, Adult Clinical Psychologist.
3. **Peer Listener:** `rian@temanbicara.id` (Rian Permana, S.Sos.) — Certified Peer Listener, Empati Relawan.
4. **Admin:** `admin@temanbicara.id` (Siti Nurhaliza - Platform Operations) — Super Admin.

---

## 3. URL Routing & Navigation Architecture

### 3.1 URL Route Layout
Every role operates within dedicated URL namespaces:

| Role | Route Prefix | Main Pages |
| :--- | :--- | :--- |
| **Patient** | `/patient` | `/patient/beranda`, `/patient/room`, `/patient/schedule`, `/patient/top-up`, `/patient/top-up/history`, `/patient/settings` |
| **Counselor** | `/counselor` | `/counselor/beranda`, `/counselor/schedule`, `/counselor/clients`, `/counselor/earnings`, `/counselor/settings` |
| **Peer Listener** | `/listener` | `/listener/beranda`, `/listener/queue`, `/listener/guidelines`, `/listener/settings` |
| **Admin** | `/admin` | `/admin/beranda`, `/admin/verifications`, `/admin/transactions`, `/admin/users` |

### 3.2 Backward Compatibility & Redirection
Existing routes (`/beranda`, `/room`, `/schedule`, `/settings`, `/top-up`) will redirect to their corresponding `/patient/...` routes to maintain bookmark and navigation integrity.

### 3.3 Dynamic Sidebar & Navigation Menu
`src/constant/menu-sidebar.tsx` will provide distinct menu configurations keyed by `UserRole`:
- `getMenuItemsByRole(role: UserRole)` returns main navigation items and utility items specific to that role.
- Sidebar organization ([sidebarApp.tsx](file:///c:/Backup%20Omen/Portofolio/temanbicara/src/components/shared/organisms/sidebarApp.tsx)) and [PrivateLayouts](file:///c:/Backup%20Omen/Portofolio/temanbicara/src/app/(private)/layout.tsx) will render role badges, titles, and menus dynamically based on active `user.role`.

---

## 4. Authentication & Role Guard System

### 4.1 Login Experience
The login screen ([login-page](file:///c:/Backup%20Omen/Portofolio/temanbicara/src/components/views/login-page)) will feature:
- Standard credential inputs (Email & Password).
- **Interactive Quick Demo Switcher**: 4 pill buttons allowing portfolio reviewers to instantly populate credentials for Patient, Counselor, Listener, or Admin with 1 click.
- Automatic routing to the respective portal upon authentication:
  - Patient → `/patient/beranda`
  - Counselor → `/counselor/beranda`
  - Peer Listener → `/listener/beranda`
  - Admin → `/admin/beranda`

### 4.2 Role Guarding
A client-side guard component (`RoleGuard`) wraps private portal routes:
- Inspects `user.role` from `useUserStore`.
- If an unauthenticated user attempts access, redirects to `/login`.
- If a user with role `patient` attempts access to `/admin` or `/counselor`, redirects to `/patient/beranda` with an access-denied notification.

---

## 5. Implementation Roadmap (Phased Plan)

- **Phase 1: Foundation Data & Auth Store**
  - Create `src/constant/mock-users.ts` with typed profiles and credentials.
  - Update `src/store/user-store.ts` to support multi-role state, role switching, and dynamic defaults.
  - Enhance Login & Register pages with Quick Demo role presets and role selection.

- **Phase 2: Dynamic Navigation & Sidebar Menus**
  - Update `src/constant/menu-sidebar.tsx` to export role-specific navigation menus.
  - Update `sidebarApp.tsx` and layout headers to display role-tailored badges, links, and profile details.

- **Phase 3: Route Restructuring & Portals Scaffolding**
  - Migrate patient pages into `src/app/patient/...`.
  - Create `src/app/counselor/...` portal (Dashboard, Session Management, Earnings, Settings).
  - Create `src/app/listener/...` portal (Dashboard, Listening Queue, Guidelines).
  - Create `src/app/admin/...` portal (Dashboard, Verifications, User List).
  - Set up root redirects from legacy routes (`/beranda` → `/patient/beranda`, etc.).

- **Phase 4: Role Guard & Access Protection**
  - Implement client-side role guard wrapper for secure route isolation.
  - Verify smooth transitions, responsive behavior, and zero TypeScript/lint regressions.

---

## 6. Testing & Acceptance Criteria
1. Switching between the 4 mock accounts at `/login` correctly logs in as the respective role and redirects to the correct portal URL prefix.
2. Menus on the Sidebar change appropriately for each role.
3. Patient features (booking, room chat, emotion tracker, coin top-up) function seamlessly on `/patient/...`.
4. Unauthorized URL access across roles (e.g. Patient opening `/admin/verifications`) triggers an access redirect back to the user's home portal.
5. All builds (`npm run build`) pass cleanly with no TypeScript or lint errors.
