import { redirect } from "next/navigation";

export default function LegacySchedulePage() {
  redirect("/patient/schedule");
}
