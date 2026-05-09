import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, label, hint, id, ...props }, ref) => (
  <label className="flex flex-col gap-1.5 text-sm" htmlFor={id}>
    {label ? <span className="font-medium text-foreground">{label}</span> : null}
    <input
      ref={ref}
      id={id}
      className={cn(
        "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
    {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
  </label>
));

Input.displayName = "Input";
