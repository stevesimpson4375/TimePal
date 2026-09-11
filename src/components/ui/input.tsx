import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      suppressHydrationWarning
      className={cn(
        "flex h-11 w-full rounded-md bg-muted px-3 text-sm text-foreground shadow-[var(--shadow-border)] transition-[box-shadow,background-color] duration-150 placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
