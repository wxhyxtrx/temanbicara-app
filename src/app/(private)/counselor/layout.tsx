import React from "react";
import { RoleGuard } from "@/components/shared/auth/role-guard";

export default function CounselorLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard allowedRoles={["counselor"]}>{children}</RoleGuard>;
}
