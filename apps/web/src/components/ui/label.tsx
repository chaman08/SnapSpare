import { forwardRef, type LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control -- generic primitive; callers supply htmlFor/id
    <label
      ref={ref}
      className={cn('text-sm font-medium leading-none text-ink', className)}
      {...props}
    />
  ),
)
Label.displayName = 'Label'

export { Label }
