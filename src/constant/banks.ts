export const POPULAR_BANKS = [
  "Bank Central Asia (BCA)",
  "Bank Mandiri",
  "Bank Negara Indonesia (BNI)",
  "Bank Rakyat Indonesia (BRI)",
  "Bank Syariah Indonesia (BSI)",
  "Bank CIMB Niaga",
  "Bank Permata",
  "SeaBank Indonesia",
  "Bank Jago",
] as const;

export type PopularBank = (typeof POPULAR_BANKS)[number];
