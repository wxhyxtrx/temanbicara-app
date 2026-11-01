import { supabasePublic } from "@/lib/supabase/client";

interface RealtimeTokenResponse {
  success: boolean;
  data?: {
    access_token: string;
    expires_at: number;
  };
  error?: string;
  message?: string;
}

let cachedToken: string | null = null;
let cachedExpiresAt: number | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let fetchPromise: Promise<string | null> | null = null;
let reconnectListenerRegistered = false;

/**
 * Menghapus cache token dan timer perpanjangan otomatis.
 */
export function clearRealtimeTokenCache(): void {
  cachedToken = null;
  cachedExpiresAt = null;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Menjadwalkan pembaruan proaktif otomatis 2 menit sebelum token kedaluwarsa.
 */
function scheduleProactiveRefresh(expiresAtSec: number): void {
  if (typeof window === "undefined") return;

  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const diffSec = expiresAtSec - nowSec;
  // Perbarui 2 menit (120 detik) sebelum kedaluwarsa; jika masa berlaku sangat pendek, beri buffer dinamis
  const leadSec = diffSec > 150 ? 120 : Math.max(5, Math.floor(diffSec / 2));
  const delayMs = Math.max(5000, (diffSec - leadSec) * 1000);

  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    syncRealtimeAuth().catch((err) => {
      console.error("[REALTIME TOKEN] Gagal perpanjangan proaktif token:", err);
      // Jika gagal, coba kembali setelah 15 detik jika token belum expired
      const remainingSec = expiresAtSec - Math.floor(Date.now() / 1000);
      if (remainingSec > 20) {
        refreshTimer = setTimeout(() => {
          refreshTimer = null;
          syncRealtimeAuth().catch(() => {});
        }, 15000);
      }
    });
  }, delayMs);
}

/**
 * Memasang pendengar peristiwa reconnect pada WebSocket Supabase Realtime
 * agar pembaruan autentikasi otomatis dipicu saat koneksi tersambung kembali.
 */
export function setupRealtimeReconnectHandler(): void {
  if (typeof window === "undefined" || reconnectListenerRegistered || !supabasePublic) {
    return;
  }
  reconnectListenerRegistered = true;

  try {
    const realtime = supabasePublic.realtime;
    if (realtime) {
      // 1. Daftarkan accessToken callback ke RealtimeClient Supabase
      realtime.accessToken = async () => {
        return await getRealtimeAccessToken();
      };

      // 2. Hubungkan ke event open pada socketAdapter
      let hasConnectedOnce = false;
      const socketAdapter = (realtime as unknown as { socketAdapter?: { onOpen?: (cb: () => void) => void } }).socketAdapter;
      if (socketAdapter && typeof socketAdapter.onOpen === "function") {
        socketAdapter.onOpen(() => {
          if (hasConnectedOnce) {
            // Reconnect WebSocket terdeteksi -> lakukan sinkronisasi auth realtime
            syncRealtimeAuth().catch((err) => {
              console.error("[REALTIME TOKEN] Gagal sinkronisasi token pada socket reconnect:", err);
            });
          } else {
            hasConnectedOnce = true;
          }
        });
      }
    }

    // 3. Tangani pemulihan koneksi internet peramban (event online)
    window.addEventListener("online", () => {
      syncRealtimeAuth().catch((err) => {
        console.error("[REALTIME TOKEN] Gagal sinkronisasi token pada event online:", err);
      });
    });
  } catch (err) {
    console.error("[REALTIME TOKEN] Gagal menginisialisasi reconnect handler:", err);
  }
}

/**
 * Mengambil access token Supabase Realtime yang sah.
 * Memanfaatkan cache memori jika masih valid (buffer 60 detik).
 * Jika tidak tersedia atau sudah mendekati kedaluwarsa, memanggil GET /api/auth/realtime-token.
 */
export async function getRealtimeAccessToken(forceRefresh = false): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (!forceRefresh && cachedToken && cachedExpiresAt && cachedExpiresAt - nowSec > 60) {
    return cachedToken;
  }

  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const res = await fetch("/api/auth/realtime-token", {
        method: "GET",
        credentials: "include",
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });

      if (!res.ok) {
        clearRealtimeTokenCache();
        return null;
      }

      const json: RealtimeTokenResponse = await res.json();
      if (!json.success || !json.data?.access_token) {
        clearRealtimeTokenCache();
        return null;
      }

      const token = json.data.access_token;
      const expiresAt =
        typeof json.data.expires_at === "number"
          ? json.data.expires_at
          : Math.floor(Date.now() / 1000) + 3600;

      cachedToken = token;
      cachedExpiresAt = expiresAt;

      scheduleProactiveRefresh(expiresAt);
      return token;
    } catch (err) {
      console.error("[REALTIME TOKEN] Gagal mengambil realtime access token:", err);
      clearRealtimeTokenCache();
      return null;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/**
 * Mengambil token realtime aktif, menerapkan ke supabasePublic.realtime.setAuth(newToken),
 * dan mengaktifkan mekanisme perpanjangan otomatis serta reconnect listener.
 */
export async function syncRealtimeAuth(): Promise<string | null> {
  if (typeof window === "undefined" || !supabasePublic) return null;

  setupRealtimeReconnectHandler();

  const token = await getRealtimeAccessToken(true);
  if (!token) return null;

  try {
    await supabasePublic.realtime.setAuth(token);
  } catch (err) {
    console.error("[REALTIME TOKEN] Gagal setAuth pada supabasePublic.realtime:", err);
  }

  return token;
}
