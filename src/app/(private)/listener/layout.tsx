import React from "react";
import { RoleGuard } from "@/components/shared/auth/role-guard";

export default function ListenerLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard allowedRoles={["peer_listener"]}>{children}</RoleGuard>;
}
