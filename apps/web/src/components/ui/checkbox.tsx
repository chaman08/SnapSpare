import { Check } from 'lucide-react'
import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * Hand-rolled, not Radix — a styled `<input type="checkbox">` with a custom
 * check glyph is the same complexity class as the existing hand-rolled
 * RadioGroup (no focus-trap/roving-tabindex correctness cost the way
 * Dialog/Select have), so it follows that precedent rather than adding
 * @radix-ui/react-checkbox.
 */
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => (
  <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-[4px] border border-steel/40 bg-surface checked:border-signal checked:bg-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
    {/* text-ink, not text-surface: white-on-signal is ~2.85:1, below the 3:1 WCAG AA floor for graphical objects. */}
    <Check
      className="pointer-events-none absolute h-3.5 w-3.5 text-ink opacity-0 peer-checked:opacity-100"
      aria-hidden="true"
      strokeWidth={3}
    />
  </span>
))
Checkbox.displayName = 'Checkbox'

export { Checkbox }
