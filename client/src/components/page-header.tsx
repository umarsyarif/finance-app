import { cn } from "@/lib/utils"

// Page title block from DESIGN.md: optional eyebrow, one Display title, optional pill action
export function PageTitle({ eyebrow, title, action, className }: {
  eyebrow?: string
  title: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex items-end justify-between gap-4 pt-4 pb-6", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-sm text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.02em]">{title}</h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </section>
  )
}

// Surface pill used for page-level actions and selectors
export function PillButton({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full bg-card px-[18px] text-[15px] font-semibold shadow-resting transition-colors hover:bg-muted disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-[18px]",
        className
      )}
      {...props}
    />
  )
}
