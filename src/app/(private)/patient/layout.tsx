import React from "react";
import { RoleGuard } from "@/components/shared/auth/role-guard";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard allowedRoles={["patient"]}>{children}</RoleGuard>;
}
