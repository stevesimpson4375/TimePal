import { createFileRoute } from "@tanstack/react-router";
import { ArchiveView } from "@/components/archive-view";

export const Route = createFileRoute("/archive")({ component: ArchivePage });

function ArchivePage() {
  return <ArchiveView />;
}
