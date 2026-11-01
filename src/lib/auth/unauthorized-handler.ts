import { useUserStore, PERSISTENT_STORES_TO_CLEAR } from "@/store/user-store";
import { notify } from "@/lib/toast";

let isHandlingUnauthorized = false;
let isInterceptorInstalled = false;
let refreshPromise: Promise<boolean> | null = null;
let lastMaintenanceToastAt = 0;
const MAINTENANCE_TOAST_THROTTLE_MS = 2000;

const originalFetch =
  typeof window !== "undefined" ? window.fetch.bind(window) : fetch;

/**
 * Menangani respon 401 / token kedaluwarsa (INVALID_TOKEN / UNAUTHENTICATED)
 * Membersihkan semua data sesi pengguna dan mengarahkan ke halaman login.
 */
export async function handleUnauthorized(message?: string): Promise<void> {
  if (typeof window === "undefined") return;

  // Cegah multiple redirect bersamaan jika beberapa request API gagal bersamaan (anti-loop)
  if (isHandlingUnauthorized) return;
  isHandlingUnauthorized = true;

  try {
    // 1. Bersihkan cookies sesi non-httpOnly dari sisi klien (tb_access_token httpOnly dikelola server)
    document.cookie = "tb_user_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "tb_user_status=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";

    // 2. Bersihkan local storage data pengguna & persist stores
    PERSISTENT_STORES_TO_CLEAR.forEach((key) => {
      localStorage.removeItem(key);
    });

    // 3. Reset Zustand store autentikasi
    const store = useUserStore.getState();
    if (store && typeof store.logout === "function") {
      store.logout();
    }
  } catch (err) {
    console.error("Gagal membersihkan sesi kedaluwarsa:", err);
  }

  // 4. Request logout server-side dengan batas waktu maksimal 2 detik
  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 2000) : null;
    try {
      await originalFetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        keepalive: true,
        signal: controller ? controller.signal : undefined,
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  } catch {
    // Abaikan error / timeout / abort / 401 saat logout server-side (anti-loop)
  }

  // 5. Arahkan pengguna ke halaman login jika belum di halaman login
  try {
    if (!window.location.pathname.startsWith("/login")) {
      const currentPath = window.location.pathname + window.location.search;
      const loginUrl = new URL("/login", window.location.origin);
      loginUrl.searchParams.set("expired", "true");
      if (currentPath && currentPath !== "/") {
        loginUrl.searchParams.set("callbackUrl", currentPath);
      }
      window.location.href = loginUrl.toString();
    } else {
      isHandlingUnauthorized = false;
    }
  } catch {
    isHandlingUnauthorized = false;
  }
}

/**
 * Mencoba refresh token via POST /api/auth/refresh sekali.
 * Menggunakan shared promise agar request concurrent tidak mengirim refresh ganda.
 */
export async function tryAuthRefresh(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await originalFetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        return json?.success !== false;
      }
      return false;
    } catch (err) {
      console.error("[AUTH]: Refresh session network error:", err);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input);
}

function isInternalApiUrl(url: string): boolean {
  if (url.startsWith("/api/")) return true;
  if (typeof window !== "undefined") {
    if (url.startsWith(window.location.origin + "/api/")) return true;
  }
  return false;
}

function isAuthBypassUrl(url: string): boolean {
  return (
    url.includes("/api/auth/login") ||
    url.includes("/api/auth/refresh") ||
    url.includes("/api/auth/logout") ||
    url.includes("/api/auth/register")
  );
}

async function handleMaintenance503(res: Response): Promise<void> {
  if (res.status !== 503) return;
  try {
    const clone = res.clone();
    const data = await clone.json().catch(() => null);
    const errorCode = data?.error;
    if (errorCode === "MAINTENANCE_ACTIVE" || errorCode === "MAINTENANCE_DRAINING") {
      const now = Date.now();
      if (typeof window !== "undefined" && now - lastMaintenanceToastAt > MAINTENANCE_TOAST_THROTTLE_MS) {
        lastMaintenanceToastAt = now;
        const fallbackMsg =
          errorCode === "MAINTENANCE_DRAINING"
            ? "Sistem sedang bersiap untuk pemeliharaan. Transaksi baru ditunda sementara."
            : "Sistem sedang dalam pemeliharaan. Silakan coba beberapa saat lagi.";
        const description = data?.message || fallbackMsg;
        notify.warning("Pemeliharaan Sistem", description);
      }
    }
  } catch {
    // Abaikan error clone/parsing agar response asli tetap utuh
  }
}

/**
 * Wrapper fetch dengan auto-refresh token saat menerima status 401
 * serta notifikasi pemeliharaan sistem pada status 503 tanpa mengganggu sesi.
 * Jika refresh sukses, ulangi request semula; jika gagal, panggil handleUnauthorized().
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit & { _isAuthRetry?: boolean }
): Promise<Response> {
  let reqCloneForRetry: Request | null = null;
  if (typeof Request !== "undefined" && input instanceof Request) {
    try {
      reqCloneForRetry = input.clone();
    } catch {
      reqCloneForRetry = null;
    }
  }

  const res = await originalFetch(input, init);

  if (res.status === 503) {
    await handleMaintenance503(res);
    return res;
  }

  if (res.status === 401 && !init?._isAuthRetry) {
    const url = getRequestUrl(input);
    if (isInternalApiUrl(url) && !isAuthBypassUrl(url)) {
      const refreshed = await tryAuthRefresh();
      if (refreshed) {
        const retryInit: RequestInit & { _isAuthRetry?: boolean } = {
          ...init,
          _isAuthRetry: true,
        };
        const retryTarget = reqCloneForRetry || input;
        const retryRes = await originalFetch(retryTarget, retryInit);
        if (retryRes.status === 503) {
          await handleMaintenance503(retryRes);
          return retryRes;
        }
        if (retryRes.status === 401) {
          handleUnauthorized("Sesi berakhir setelah percobaan refresh token");
        }
        return retryRes;
      } else {
        handleUnauthorized("Sesi tidak valid atau kedaluwarsa");
      }
    }
  }

  return res;
}

/**
 * Menginstal interceptor pada window.fetch di sisi browser
 */
export function installAuthFetchInterceptor() {
  if (typeof window === "undefined" || isInterceptorInstalled) return;
  isInterceptorInstalled = true;
  window.fetch = fetchWithAuth;
}

// Auto install di browser saat modul dimuat
if (typeof window !== "undefined") {
  installAuthFetchInterceptor();
}
