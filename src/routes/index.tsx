import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/chat-view";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <ChatView />;
}
