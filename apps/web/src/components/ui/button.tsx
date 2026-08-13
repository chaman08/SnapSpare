import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex min-h-tap items-center justify-center gap-2 whitespace-nowrap rounded-[6px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-ink text-surface hover:bg-ink/90',
        // text-ink, not text-surface: white-on-signal is ~2.85:1, below the
        // 3:1 WCAG AA floor even for large/bold UI text — ink-on-signal is ~6.25:1.
        cta: 'bg-signal text-ink hover:bg-signal/90',
        outline: 'border border-steel/30 bg-surface text-ink hover:bg-surface-muted',
        ghost: 'text-ink hover:bg-surface-muted',
        destructive: 'bg-alert text-surface hover:bg-alert/90',
      },
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-9 rounded-[6px] px-3',
        lg: 'h-12 rounded-[6px] px-6',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
