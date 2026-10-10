import { redirect } from "next/navigation";

export default function LegacyTopUpPage() {
  redirect("/patient/top-up");
}
