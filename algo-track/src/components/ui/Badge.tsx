import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "easy" | "medium" | "hard" | "tag";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "bg-muted text-foreground": variant === "default",
          "bg-easy-bg text-easy border border-easy/20": variant === "easy",
          "bg-medium-bg text-medium border border-medium/20": variant === "medium",
          "bg-hard-bg text-hard border border-hard/20": variant === "hard",
          "bg-tag-bg text-tag border border-tag/20": variant === "tag",
        },
        className
      )}
      {...props}
    />
  );
}
