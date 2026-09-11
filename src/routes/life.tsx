import { createFileRoute } from "@tanstack/react-router";
import { LifeView } from "@/components/life-view";

export const Route = createFileRoute("/life")({ component: LifePage });

function LifePage() {
  return <LifeView />;
}
