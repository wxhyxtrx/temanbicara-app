import { useUserStore } from "@/store/user-store";

let isHandlingUnauthorized = false;

/**
 * Menangani respon 401 / token kedaluwarsa (INVALID_TOKEN / UNAUTHENTICATED)
 * Membersihkan semua data sesi pengguna dan mengarahkan ke halaman login.
 */
export function handleUnauthorized(message?: string) {
  if (typeof window === "undefined") return;

  // Cegah multiple redirect bersamaan jika beberapa request API gagal bersamaan
  if (isHandlingUnauthorized) return;
  isHandlingUnauthorized = true;

  try {
    // 1. Bersihkan cookies sesi autentikasi
    document.cookie = "tb_access_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "tb_user_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "tb_user_status=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";

    // 2. Bersihkan local storage
    localStorage.removeItem("tb_access_token");
    localStorage.removeItem("tb_user_store_v4");

    // 3. Reset Zustand store autentikasi
    const store = useUserStore.getState();
    if (store && typeof store.logout === "function") {
      store.logout();
    }
  } catch (err) {
    console.error("Gagal membersihkan sesi kedaluwarsa:", err);
  }

  // 4. Request logout server-side secara non-blocking
  try {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  } catch {
    // Abaikan error fetch logout
  }

  // 5. Arahkan pengguna ke halaman login jika belum di halaman login
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
}
