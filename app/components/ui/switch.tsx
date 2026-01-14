import * as React from "react";
import { cn } from "~/lib/utils";

export function Switch({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="inline-flex cursor-pointer items-center">
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        className={cn(
          "relative h-6 w-11 rounded-full bg-muted transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background peer-checked:bg-primary peer-checked:after:translate-x-5",
          className
        )}
      />
    </label>
  );
}
