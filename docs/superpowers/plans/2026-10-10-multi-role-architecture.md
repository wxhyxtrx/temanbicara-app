# Multi-Role Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform TemanBicara into a 4-role multi-user system (Patient, Counselor, Peer Listener, Admin) with role-prefixed routing, dynamic navigation menus, mock auth profiles, and route protection.

**Architecture:** A centralized mock user database (`mock-users.ts`) defines typed roles and metadata. Zustand (`user-store.ts`) manages active role state and switcher utilities. Sidebar navigation dynamically resolves menu items based on `user.role`, and routes are structured under `/patient/...`, `/counselor/...`, `/listener/...`, and `/admin/...` with legacy redirection and role guarding.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Zustand 5, Lucide React, Shadcn UI.

**Spec:** `docs/superpowers/specs/2026-10-10-multi-role-architecture-design.md`

## Global Constraints
- Do not break existing patient interactions (emotion tracker, booking modal, room chat).
- Keep all designs aligned with the established teal/slate calm healthcare aesthetic.
- Preserve localStorage hydration compatibility in Zustand stores.
- All code must pass `npm run build` with zero TypeScript or lint errors.

## Review Focus
1. Unauthenticated direct access to private routes must cleanly redirect to `/login`.
2. Cross-role route access (e.g. Patient accessing `/admin/verifications`) must redirect to `/patient/beranda` with an access notification.
3. Refreshing the browser on any portal must maintain the active role without flickering back to a default.
4. Legacy bookmarks (`/beranda`, `/schedule`, `/room`) must redirect seamlessly to their `/patient/...` equivalents.
5. Demo buttons on `/login` must instantly populate and submit credentials for all 4 roles.

---

### Task 1: Multi-Role Models & Mock User Database

**Files:**
- Create: `src/constant/mock-users.ts`
- Modify: `src/store/user-store.ts`

**Interfaces:**
- Consumes: Nothing
- Produces:
  - `UserRole`: `"patient" | "counselor" | "peer_listener" | "admin"`
  - `UserProfile`: typed user interface with role-specific metadata
  - `mockUsers`: record of 4 preset profiles
  - `useUserStore`: `loginWithRole(role: UserRole)`, `switchRole(role: UserRole)`

- [ ] **Step 1: Create `src/constant/mock-users.ts` with typed role definitions and 4 mock profiles**
  Define `UserRole`, `PatientData`, `CounselorData`, `ListenerData`, `AdminData`, and `UserProfile`.
  Populate with:
  - `wahyu@temanbicara.id` (Patient: Wahyu Tricahyo, 50 coins)
  - `anita@temanbicara.id` (Counselor: Dr. Anita Wijaya, M.Psi., SIPPK-2021-0481)
  - `rian@temanbicara.id` (Peer Listener: Rian Permana, S.Sos.)
  - `admin@temanbicara.id` (Admin: Siti Nurhaliza)

- [ ] **Step 2: Update `src/store/user-store.ts` to support multi-role state**
  Replace single-patient interface with universal `UserProfile`.
  Add `loginWithRole(role: UserRole)` and `switchRole(role: UserRole)`.
  Ensure Zustand `persist` correctly hydrates role and defaults to `patient`.

- [ ] **Step 3: Verify TypeScript compilation**
  Run: `npx tsc --noEmit`
  Expected: Pass without errors.

- [ ] **Step 4: Commit**
  ```bash
  git add src/constant/mock-users.ts src/store/user-store.ts
  git commit -m "feat(auth): add multi-role data models and mock user store"
  ```

---

### Task 2: Interactive Quick Demo Role Selector on Login & Register Pages

**Files:**
- Modify: `src/components/views/login-page/index.tsx`
- Modify: `src/components/views/register-page/index.tsx`

**Interfaces:**
- Consumes: `mockUsers`, `UserRole`, `useUserStore`
- Produces: Interactive role picker and quick login buttons

- [ ] **Step 1: Add Quick Demo Role buttons on Login Page**
  In `src/components/views/login-page/index.tsx`, insert a "Demo Akun Cepat" banner above the login form with 4 interactive pill buttons:
  - 🟢 Pasien (Wahyu)
  - 🟣 Psikolog (Dr. Anita)
  - 🔵 Pendengar (Rian)
  - 🟠 Admin (Siti)
  Clicking a demo button immediately logs in as that role and routes to that role's home portal (`/patient/beranda`, `/counselor/beranda`, `/listener/beranda`, `/admin/beranda`).

- [ ] **Step 2: Update standard login handler to route based on matched role**
  When submitting email & password, detect if email matches a mock user role. If so, log in with that role and redirect to the corresponding portal.

- [ ] **Step 3: Update Register Page to allow selecting role or default to patient**
  In `src/components/views/register-page/index.tsx`, add role selection option during registration.

- [ ] **Step 4: Test login redirection manually in dev server**
  Verify clicking demo role buttons redirects correctly.

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/views/login-page/index.tsx src/components/views/register-page/index.tsx
  git commit -m "feat(auth): add quick demo role selector and role-based login routing"
  ```

---

### Task 3: Dynamic Multi-Role Navigation & Sidebar Menus

**Files:**
- Modify: `src/constant/menu-sidebar.tsx`
- Modify: `src/components/shared/organisms/sidebarApp.tsx`
- Modify: `src/app/(private)/layout.tsx`

**Interfaces:**
- Consumes: `UserRole`, `useUserStore`
- Produces: `getMenuItemsByRole(role: UserRole)`, role-adaptive sidebar & header badges

- [ ] **Step 1: Create `getMenuItemsByRole(role: UserRole)` in `src/constant/menu-sidebar.tsx`**
  Provide role-specific menus:
  - **patient**: Beranda (`/patient/beranda`), Ruang Bicara (`/patient/room`), Jadwal (`/patient/schedule`), Top Up (`/patient/top-up`), Mutasi (`/patient/top-up/history`), Pengaturan (`/patient/settings`).
  - **counselor**: Beranda Praktik (`/counselor/beranda`), Jadwal Konseling (`/counselor/schedule`), Catatan Klien (`/counselor/clients`), Honor & Payout (`/counselor/earnings`), Pengaturan Praktik (`/counselor/settings`).
  - **peer_listener**: Antrean Curhat (`/listener/beranda`), Ruang Dengar (`/listener/queue`), Panduan PFA (`/listener/guidelines`), Pengaturan (`/listener/settings`).
  - **admin**: Ikhtisar Platform (`/admin/beranda`), Verifikasi SIPPK (`/admin/verifications`), Riwayat Transaksi (`/admin/transactions`), Manajemen Pengguna (`/admin/users`).

- [ ] **Step 2: Update `sidebarApp.tsx` to dynamically render active role menus**
  Read `user.role` from `useUserStore`. Render items returned by `getMenuItemsByRole(user.role)`.
  Display appropriate role subtitle (e.g. "Psikolog Klinis", "Pasien Terverifikasi", "Relawan Pendengar", "Administrator").

- [ ] **Step 3: Update `layout.tsx` header to show dynamic role badge**
  Render role badge in header (e.g., green for Patient, violet for Counselor, sky for Listener, amber for Admin).

- [ ] **Step 4: Verify sidebar renders without hydration mismatches**
  Run: `npx tsc --noEmit`
  Expected: Clean pass.

- [ ] **Step 5: Commit**
  ```bash
  git add src/constant/menu-sidebar.tsx src/components/shared/organisms/sidebarApp.tsx src/app/(private)/layout.tsx
  git commit -m "feat(navigation): add dynamic role-based sidebar and header badges"
  ```

---

### Task 4: Patient Routes Restructuring (`/patient/...`) & Legacy Redirection

**Files:**
- Create:
  - `src/app/patient/beranda/page.tsx`
  - `src/app/patient/room/page.tsx`
  - `src/app/patient/schedule/page.tsx`
  - `src/app/patient/top-up/page.tsx`
  - `src/app/patient/top-up/history/page.tsx`
  - `src/app/patient/settings/page.tsx`
- Modify:
  - `src/app/(private)/beranda/page.tsx` (Add client redirect to `/patient/beranda`)
  - `src/app/(private)/room/page.tsx` (Add client redirect to `/patient/room`)
  - `src/app/(private)/schedule/page.tsx` (Add client redirect to `/patient/schedule`)
  - `src/app/(private)/settings/page.tsx` (Add client redirect to `/patient/settings`)
  - `src/app/(private)/top-up/page.tsx` (Add client redirect to `/patient/top-up`)

**Interfaces:**
- Consumes: Existing views in `src/components/views/...`
- Produces: `/patient/...` routes and automatic redirects for legacy links

- [ ] **Step 1: Create pages under `src/app/patient/...` re-using existing robust components**
  Move/reference the rich components under the new `/patient/...` route URLs.
  Update internal navigation links to use `/patient/...`.

- [ ] **Step 2: Implement redirect stubs in legacy `/(private)/...` pages**
  Use `redirect("/patient/...")` or `useRouter().replace("/patient/...")` to preserve backward compatibility.

- [ ] **Step 3: Verify patient pages work at `/patient/beranda`, `/patient/room`, etc.**
  Verify all patient tabs load seamlessly.

- [ ] **Step 4: Commit**
  ```bash
  git add src/app/patient src/app/(private)
  git commit -m "refactor(routes): migrate patient routes to /patient namespace with legacy redirects"
  ```

---

### Task 5: Scaffolding Role Portals (`/counselor/...`, `/listener/...`, `/admin/...`)

**Files:**
- Create:
  - `src/app/counselor/beranda/page.tsx` (Counselor Dashboard with session requests & stats)
  - `src/app/counselor/schedule/page.tsx` (Counselor Schedule management & accept/decline)
  - `src/app/counselor/earnings/page.tsx` (Counselor Honor & Payout summary)
  - `src/app/listener/beranda/page.tsx` (Peer Listener Queue & active support status)
  - `src/app/listener/guidelines/page.tsx` (PFA Psychological First Aid guidelines)
  - `src/app/admin/beranda/page.tsx` (Admin Platform Overview & KPIs)
  - `src/app/admin/verifications/page.tsx` (Admin Counselor SIPPK/STR verification list)

**Interfaces:**
- Consumes: `mockUsers`, `useUserStore`, UI components
- Produces: Polished dashboard views for Counselor, Listener, and Admin

- [ ] **Step 1: Build Counselor Portal pages**
  Implement:
  - `/counselor/beranda`: Statistics cards (Sesi Selesai, Rating 4.9, Koin Terkumpul, Pasien Aktif), antrean janji temu masuk dengan tombol "Terima Sesi" & "Jadwal Ulang", kalender praktik.
  - `/counselor/schedule`: Manajemen slot praktik per jam.
  - `/counselor/earnings`: Ringkasan pendapatan koin dan simulasi penarikan dana ke rekening bank.

- [ ] **Step 2: Build Peer Listener Portal pages**
  Implement:
  - `/listener/beranda`: Toggle status "Siaga / Offline", antrean curhat anonim masuk, tombol "Buka Ruang Dengar".
  - `/listener/guidelines`: Panduan etika pendengar sebaya (Active Listening, Boundary, Emergency Protocol 119).

- [ ] **Step 3: Build Admin Portal pages**
  Implement:
  - `/admin/beranda`: Metrik keseluruhan platform (Total Pengguna, Psikolog Aktif, Sesi Berjalan, Koin Beredar).
  - `/admin/verifications`: Tabel verifikasi nomor SIPPK psikolog dengan tombol "Setujui Lisensi" / "Tolak".

- [ ] **Step 4: Verify layout & responsive presentation**
  Ensure all portals look cohesive, polished, and match the design aesthetic.

- [ ] **Step 5: Commit**
  ```bash
  git add src/app/counselor src/app/listener src/app/admin
  git commit -m "feat(portals): scaffold dedicated portals for counselor, listener, and admin"
  ```

---

### Task 6: Client-Side Role Guard & Route Protection

**Files:**
- Create: `src/components/shared/auth/role-guard.tsx`
- Modify: `src/app/counselor/layout.tsx` (or wrap portal pages)
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/listener/layout.tsx`
- Modify: `src/app/patient/layout.tsx`

**Interfaces:**
- Consumes: `useUserStore`, `useRouter`, `useNotificationStore`
- Produces: `RoleGuard` component ensuring only authorized roles view respective portals

- [ ] **Step 1: Create `src/components/shared/auth/role-guard.tsx`**
  Props: `allowedRoles: UserRole[]`, `children: React.ReactNode`.
  Checks if `user.role` matches `allowedRoles`. If not, displays gentle access notice and redirects to `/login` (if unauthenticated) or the user's appropriate portal.

- [ ] **Step 2: Apply `RoleGuard` to all 4 role portals**
  Ensure `/counselor` only allows `counselor`, `/admin` only allows `admin`, `/listener` only allows `peer_listener`, and `/patient` only allows `patient`.

- [ ] **Step 3: Test role boundary enforcement**
  Verify that accessing `/admin` as Patient redirects safely.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/shared/auth/role-guard.tsx src/app/patient src/app/counselor src/app/listener src/app/admin
  git commit -m "feat(security): implement client-side role guard and route protection"
  ```

---

### Task 7: Full Verification & Build Validation

**Files:**
- Check whole project

- [ ] **Step 1: Run TypeScript validation**
  Run: `npx tsc --noEmit`
  Expected: Clean pass with 0 errors.

- [ ] **Step 2: Run Next.js production build**
  Run: `npm run build`
  Expected: Successful compilation of all static and dynamic routes.

- [ ] **Step 3: Verify end-to-end role switching**
  Test all 4 demo login buttons and verify navigation across all portals.

- [ ] **Step 4: Final commit & summary**
  ```bash
  git commit -m "chore: complete multi-role architecture implementation"
  ```
