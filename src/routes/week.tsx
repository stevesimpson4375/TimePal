import { createFileRoute } from "@tanstack/react-router";
import { WeekView } from "@/components/week-view";

export const Route = createFileRoute("/week")({ component: WeekPage });

function WeekPage() {
  return <WeekView />;
}
