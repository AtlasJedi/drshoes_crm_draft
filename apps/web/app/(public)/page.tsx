import { redirect } from "next/navigation";

/**
 * Client install jest CRM-only — strona publiczna wyłączona.
 * Wejście na `/` od razu przekierowuje na panel admina.
 */
export default function HomePage() {
  redirect("/admin/login");
}
