"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminVerificationsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/users?tab=verifications");
  }, [router]);

  return (
    <div className="p-8 text-center text-xs text-slate-500">
      Mengalihkan ke Manajemen Pengguna & Verifikasi Mitra...
    </div>
  );
}
