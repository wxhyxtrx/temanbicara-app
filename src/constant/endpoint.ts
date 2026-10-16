export const ENDPOINTS = {
  WALLET: {
    ME: '/api/wallet/me',
    TOPUP: '/api/wallet/topup',
    TOPUPS: '/api/wallet/topups',
    TOPUP_DETAIL: (orderId: string) => `/api/wallet/topup/${encodeURIComponent(orderId)}`,
    TOPUP_CHECK: (orderId: string) => `/api/wallet/topup/${encodeURIComponent(orderId)}/check`,
    TRANSACTIONS: '/api/wallet/transactions',
    PAYOUT: '/api/wallet/payout',
    PAYOUTS: '/api/wallet/payouts',
  },
  ADMIN: {
    STATS: '/api/admin/stats',
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
