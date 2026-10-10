# Counselor Financial Operations, Reviews, and Clinical Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full financial operations for counselors (custom bank/e-wallet payout requests and session honorarium breakdown), patient post-consultation evaluation & rating system, synchronized clinical SOAP notes between counseling room and client records, and a live consultation session timer with a 5-minute wrap-up notice.

**Architecture:** 
- State management backed by Zustand with local storage persistence (`useReviewStore`, `useClinicalRecordsStore`, `usePayoutStore`, and `useScheduleStore`).
- Patient post-session review loop connected to psychologist profiles and counselor dashboard satisfaction metrics.
- Comprehensive SOAP note (Subjective, Objective, Assessment, Plan) records linked from `/counselor/room` to `/counselor/clients` client history, with secure patient-facing action plan visibility in `/patient/schedule`.
- Floating live session timer bar in teleconsultation rooms (`/patient/room` and `/counselor/room`) with color-coded warnings and wrap-up prompt at 5 minutes remaining.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide React, Zustand with `persist` middleware.

**Spec:** Multi-role architecture spec from `multi_role_architecture_report.md` covering Priorities 3 & 4 (Financial Operations, Post-Consultation Reviews, Clinical Records/SOAP Notes, and Real-time Session Guard).

---

## Global Constraints

- Preserve all existing styling tokens, dark mode compatibility, and zero-error TypeScript strict compilation.
- Do not perform `.filter()` or create unstable object/array references inside inline Zustand selectors (`useStore((state) => state.items.filter(...))`); always select stable state slices and use `React.useMemo()` in components.
- Do not expose clinical diagnosis/assessment jargon (SOAP Assessment) to the patient; patients only view their approved Action Plan / Therapy Homework (SOAP Plan).
- All financial coin transactions must have transparent 90/10 split records (90% counselor honor, 10% platform maintenance) and precise rupiah conversion (1 Coin = Rp 10.000).

---

## Review Focus

1. **Payout Input Validation:** Counselor submitting withdrawal when balance is zero, entering invalid bank account digits, or choosing unsupported payout channels must be guarded with clear UI feedback.
2. **Review Duplication Guard:** Patient cannot submit multiple reviews for the same completed consultation session (`scheduleId` uniqueness).
3. **SOAP Sync Integrity:** Updating SOAP notes in `/counselor/room` must immediately update the client's record in `/counselor/clients` without page refresh.
4. **Session Timer Edge Cases:** Countdown timer must not run into negative numbers and must offer graceful session completion when 00:00 is reached.
5. **Mobile Responsiveness:** All newly introduced dialogs (Review Modal, Payout Form, Clinical Record Viewer, Timer Bar) must fit cleanly on mobile screens without horizontal overflow.

---

### Task 1: Post-Consultation Review Store (`src/store/review-store.ts`)

**Files:**
- Create: `src/store/review-store.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface SessionReview {
    id: string;
    scheduleId: string;
    consultantId: number;
    consultantName: string;
    patientId: string;
    patientName: string;
    isAnonymous: boolean;
    rating: number; // 1 to 5
    aspectTags: string[];
    comment: string;
    createdAt: string;
  }
  ```
- Actions: `addReview(payload: Omit<SessionReview, "id" | "createdAt">) => SessionReview`, `getReviewsByConsultant(consultantId: number) => SessionReview[]`, `hasReviewed(scheduleId: string) => boolean`.

- [ ] **Step 1: Write review-store definition and initial seed data**
  - Create `src/store/review-store.ts` with seed reviews for Dr. Anita Wijaya and Budi Santoso.
  - Implement `addReview` that appends review, updates notification for counselor, and triggers rating recalculation.
  - Implement helper selectors: `hasReviewed(scheduleId)` to check whether a session has already received an evaluation.
- [ ] **Step 2: Verify TypeScript compilation**
  Run: `npx tsc --noEmit`
  Expected: PASS with code 0.
- [ ] **Step 3: Commit review store**
  `git add src/store/review-store.ts`
  `git commit -m "feat: add post-consultation review store for patient evaluations"`

---

### Task 2: Patient Post-Consultation Review Modal & Schedule Integration (`src/components/views/schedule/session-review-modal.tsx` & `src/app/(private)/patient/schedule/page.tsx`)

**Files:**
- Create: `src/components/views/schedule/session-review-modal.tsx`
- Modify: `src/components/views/schedule/session-detail-modal.tsx`
- Modify: `src/app/(private)/patient/schedule/page.tsx`

**Interfaces:**
- Consumes: `useReviewStore`, `useScheduleStore`, `useUserStore`.
- Produces: Interactive rating modal with 1-5 star picker, positive aspect badges (e.g. "Hangat & Empatis", "Solutif", "Ruang Aman", "Tepat Waktu"), feedback comment box, and anonymous toggle.

- [ ] **Step 1: Build `SessionReviewModal` component**
  - Create interactive star selector (1 to 5 stars) with dynamic labels:
    - 1: "Kurang Membantu"
    - 2: "Cukup Membantu"
    - 3: "Baik & Informatif"
    - 4: "Sangat Membantu & Nyaman"
    - 5: "Luar Biasa & Sangat Terarah"
  - Quick aspect tags multiselect.
  - Testimonial textarea.
  - "Tampilkan nama samaran di profil publik psikolog" switch.
- [ ] **Step 2: Update `SessionDetailModal` & `patient/schedule/page.tsx`**
  - In `patient/schedule/page.tsx`: for rows with `status === "selesai"`, render a "Beri Ulasan" button (or "Sudah Diulas ⭐X" badge) if `hasReviewed(session.id)`.
  - In `SessionDetailModal`: for completed sessions, add a "Beri Ulasan & Rating" button and a "Panduan & Tugas Mandiri Pasca Sesi" card showing the agreed therapy plan/homework from the counselor.
- [ ] **Step 3: Verify TypeScript compilation**
  Run: `npx tsc --noEmit`
  Expected: PASS with code 0.
- [ ] **Step 4: Commit review modal integration**
  `git add src/components/views/schedule/session-review-modal.tsx src/components/views/schedule/session-detail-modal.tsx src/app/(private)/patient/schedule/page.tsx`
  `git commit -m "feat: integrate post-consultation review modal and action plan display in patient schedule"`

---

### Task 3: Counselor Satisfaction & Review Dashboard (`src/app/(private)/counselor/beranda/page.tsx`)

**Files:**
- Modify: `src/app/(private)/counselor/beranda/page.tsx`

**Interfaces:**
- Consumes: `useReviewStore`, `useUserStore`, `useScheduleStore`.
- Produces: Satisfaction KPI metrics (Average Rating, Total Reviews, 5-Star Ratio) and a real-time "Ulasan Klien Terbaru" feed on counselor dashboard.

- [ ] **Step 1: Connect `counselor/beranda` to `useReviewStore`**
  - Read reviews for the current counselor (Dr. Anita Wijaya / logged-in counselor).
  - Compute average rating and distribution.
- [ ] **Step 2: Add "Ulasan & Testimoni Klien Terbaru" component section**
  - Display client review cards with star ratings, aspect tags, review text, and anonymous/real client attribution.
- [ ] **Step 3: Verify TypeScript compilation**
  Run: `npx tsc --noEmit`
  Expected: PASS with code 0.
- [ ] **Step 4: Commit counselor review section**
  `git add src/app/(private)/counselor/beranda/page.tsx`
  `git commit -m "feat: display patient reviews and satisfaction metrics on counselor dashboard"`

---

### Task 4: Advanced Counselor Payout & Multi-Channel Withdrawal (`src/app/(private)/counselor/earnings/page.tsx`)

**Files:**
- Modify: `src/app/(private)/counselor/earnings/page.tsx`
- Modify: `src/store/payout-store.ts`

**Interfaces:**
- Consumes: `usePayoutStore`, `useUserStore`, `useTransactionStore`.
- Produces: Multi-channel withdrawal selection (BCA, Mandiri, BNI, BRI, SeaBank, Bank Jago, GoPay, OVO, DANA), quick preset amounts (50, 100, 250, All), fee breakdown, and consultation session honorarium ledger.

- [ ] **Step 1: Enhance `payout-store.ts` if needed**
  - Support payout channel types (`bank` or `ewallet`) and account number persistence.
- [ ] **Step 2: Upgrade `counselor/earnings/page.tsx`**
  - Add channel selector with icons/labels (BCA, Mandiri, BNI, BRI, SeaBank, GoPay, OVO, DANA).
  - Add account number & account holder name inputs (auto-filled from user profile).
  - Add quick amount chip buttons: 50 Koin (Rp 500.000), 100 Koin (Rp 1.000.000), 200 Koin (Rp 2.000.000), and "Tarik Semua".
  - Add detailed table: "Rincian Honor Sesi Konsultasi" displaying past counseling sessions, gross coins, 10% platform fee, net coins received, and patient pseudonym.
- [ ] **Step 3: Verify TypeScript compilation**
  Run: `npx tsc --noEmit`
  Expected: PASS with code 0.
- [ ] **Step 4: Commit counselor earnings enhancements**
  `git add src/app/(private)/counselor/earnings/page.tsx src/store/payout-store.ts`
  `git commit -m "feat: enhance counselor payout with multi-channel options and session honor ledger"`

---

### Task 5: Clinical Records & SOAP Notes Synchronization (`src/store/clinical-records-store.ts`, `src/app/(private)/counselor/clients/page.tsx`, `src/app/(private)/counselor/room/page.tsx`)

**Files:**
- Create: `src/store/clinical-records-store.ts`
- Modify: `src/app/(private)/counselor/clients/page.tsx`
- Modify: `src/app/(private)/counselor/room/page.tsx`

**Interfaces:**
- Consumes: `useChatStore`, `useScheduleStore`.
- Produces:
  ```typescript
  export interface SoapNote {
    id: string;
    clientId: string;
    clientName: string;
    sessionNumber: number;
    date: string;
    s: string; // Subjective
    o: string; // Objective
    a: string; // Assessment
    p: string; // Plan
    confidentialityLevel: "Tinggi (SIPPK)" | "Standard";
    updatedAt: string;
  }
  ```
- Actions: `saveSoapNote(note: Omit<SoapNote, "id" | "updatedAt">)`, `getNotesByClient(clientId: string)`, `getAllClientSummaries()`.

- [ ] **Step 1: Create `src/store/clinical-records-store.ts`**
  - Implement full store with mock clients (Budi Santoso, Wahyu Tricahyo, Nadia Putri, Ahmad Rizky).
  - Store multiple SOAP records per client across sessions.
- [ ] **Step 2: Connect `/counselor/room` to save SOAP notes into the store**
  - When counselor clicks "Simpan Catatan SOAP", update both `useChatStore` and `useClinicalRecordsStore`.
  - Automatically update the plan so patient can view their homework in schedule.
- [ ] **Step 3: Upgrade `/counselor/clients` to show dynamic client records & history modal**
  - Replace static `mockClients` with reactive data from `useClinicalRecordsStore`.
  - Add "Lihat Rekam Medis Lengkap" modal showing session timeline, DASS progress, and full SOAP history.
- [ ] **Step 4: Verify TypeScript compilation**
  Run: `npx tsc --noEmit`
  Expected: PASS with code 0.
- [ ] **Step 5: Commit clinical records synchronization**
  `git add src/store/clinical-records-store.ts src/app/(private)/counselor/clients/page.tsx src/app/(private)/counselor/room/page.tsx`
  `git commit -m "feat: synchronize clinical SOAP records between counseling room and client archive"`

---

### Task 6: Real-time Session Timer Bar & 5-Minute Notice (`src/components/views/chat-page/session-timer-bar.tsx`)

**Files:**
- Create: `src/components/views/chat-page/session-timer-bar.tsx`
- Modify: `src/components/views/chat-page/chat-area.tsx`
- Modify: `src/app/(private)/counselor/room/page.tsx`

**Interfaces:**
- Produces: Floating/header session countdown timer component (e.g., 50:00 → 00:00):
  - State: running, paused, ended.
  - Visuals: Normal Teal (> 10 mins), Warning Amber (10 mins - 5 mins), Critical Pulse Rose (< 5 mins).
  - Wrap-up banner alert when 5 minutes remain: "Sisa 5 Menit: Mulai rumuskan rangkuman refleksi dan sepakati rencana tugas mandiri (Plan) bersama klien."
  - "Selesaikan Sesi" button triggering post-session review/audit.

- [ ] **Step 1: Create `SessionTimerBar` component**
  - Configurable duration (default 50 minutes / 60 minutes for active consultations).
  - Countdown logic with play/pause and finish hooks.
  - Color transitions and alert modal / banner on 5 minutes remaining.
- [ ] **Step 2: Embed `SessionTimerBar` in `patient/room` (inside `chat-area.tsx` when talking to counselor) and `counselor/room`**
- [ ] **Step 3: Verify TypeScript compilation**
  Run: `npx tsc --noEmit`
  Expected: PASS with code 0.
- [ ] **Step 4: Commit session timer feature**
  `git add src/components/views/chat-page/session-timer-bar.tsx src/components/views/chat-page/chat-area.tsx src/app/(private)/counselor/room/page.tsx`
  `git commit -m "feat: add live counseling session timer and 5-minute wrap-up notice"`

---

### Task 7: Full System Verification & End-to-End Walkthrough

**Files:**
- Verification only

- [ ] **Step 1: Run TypeScript full check**
  Run: `npx tsc --noEmit`
  Expected: 0 errors.
- [ ] **Step 2: Test complete user journeys**
  - Journey 1: Patient completes session -> gives 5-star review with aspect tags -> review appears on counselor dashboard.
  - Journey 2: Counselor finishes session in `/counselor/room` -> saves SOAP notes -> notes immediately visible in `/counselor/clients` and patient homework plan in `/patient/schedule`.
  - Journey 3: Counselor requests payout with SeaBank / GoPay in `/counselor/earnings` -> pending payout appears in `/admin/transactions` -> admin approves it.
- [ ] **Step 3: Final Git status and commit verification**
