export const ENDPOINTS = {
  WALLET: {
    ME: '/api/wallet/me',
    TOPUP: '/api/wallet/topup',
    TOPUP_DETAIL: (orderId: string) => `/api/wallet/topup/${encodeURIComponent(orderId)}`,
    TRANSACTIONS: '/api/wallet/transactions',
    PAYOUT: '/api/wallet/payout',
    PAYOUTS: '/api/wallet/payouts',
  },
  ADMIN: {
    PAYOUTS: '/api/admin/payouts',
    PAYOUT_REJECT: (id: string) => `/api/admin/payouts/${encodeURIComponent(id)}/reject`,
    PAYOUT_PAID: (id: string) => `/api/admin/payouts/${encodeURIComponent(id)}/paid`,
  },
  SETTINGS: {
    PUBLIC: '/api/settings/public',
    ADMIN: '/api/admin/settings',
    AUDIT: '/api/admin/settings/audit',
  },
} as const;
