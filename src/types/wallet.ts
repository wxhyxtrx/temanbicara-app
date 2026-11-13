import type { UserRole } from './database';

export type PaymentStatus = 'pending' | 'settlement' | 'deny' | 'expire' | 'cancel' | 'refund' | 'chargeback';
export type PayoutStatus = 'requested' | 'paid' | 'rejected';
export type LedgerAccount =
  | 'patient_coins'
  | 'mitra_pending'
  | 'mitra_available'
  | 'platform_revenue'
  | 'payout_disbursement';
export type LedgerUnit = 'coin' | 'rupiah';

export interface WalletEntity {
  user_id: string;
  coin_balance: number;
  pending_rupiah: number;
  available_rupiah: number;
  updated_at: string;
}

export interface WalletInfoResponse {
  role: UserRole;
  coin_balance: number;
  pending_rupiah: number;
  available_rupiah: number;
  updated_at: string;
}

export interface LedgerEntryEntity {
  id: string;
  user_id: string | null;
  account: LedgerAccount;
  amount: number;
  unit: LedgerUnit;
  reason: string;
  ref_type: string;
  ref_id: string;
  created_at: string;
}

export interface TopupOrderEntity {
  id: string;
  order_id: string;
  patient_id: string;
  coins: number;
  amount_rupiah: number;
  status: PaymentStatus;
  provider_reference: string | null;
  settled_at: string | null;
  created_at: string;
  expires_at?: string | null;
  snap_redirect_url?: string | null;
  reconciled_at?: string | null;
}

export interface PayoutRequestEntity {
  id: string;
  mitra_id: string;
  amount_rupiah: number;
  fee_rupiah: number;
  bank_name: string;
  account_number: string;
  bank_account_name: string;
  status: PayoutStatus;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

export interface AdminPayoutItem extends PayoutRequestEntity {
  mitra_name?: string;
  mitra_role?: UserRole;
  has_dispute_hold?: boolean;
  dispute_hold_amount?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type DisputedHoldStatus = 'active' | 'cleared' | 'deducted';

export interface DisputedPayoutHoldEntity {
  id: string;
  topup_order_id: string;
  mitra_id: string;
  source_type: 'session' | 'extension' | 'tip';
  source_id: string;
  disputed_amount_rupiah: number;
  status: DisputedHoldStatus;
  reason: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

