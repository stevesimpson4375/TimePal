import { createFileRoute } from "@tanstack/react-router";
import { CodesView } from "@/components/codes-view";

export const Route = createFileRoute("/codes")({ component: CodesPage });

function CodesPage() {
  return <CodesView />;
}
