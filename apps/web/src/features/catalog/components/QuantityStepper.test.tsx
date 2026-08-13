import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from '@/test/a11y'
import { QuantityStepper } from './QuantityStepper'

function renderStepper(overrides: Partial<ComponentProps<typeof QuantityStepper>> = {}) {
  const onChange = vi.fn()
  const utils = render(
    <QuantityStepper qty={5} min={1} onChange={onChange} {...overrides} />,
  )
  return { onChange, ...utils }
}

describe('QuantityStepper', () => {
  it('has no axe violations', async () => {
    const { container } = renderStepper()
    await expectNoAxeViolations(container)
  })

  it('increments by 1 (default step) when the + button is clicked', () => {
    const { onChange } = renderStepper({ qty: 5 })
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    expect(onChange).toHaveBeenCalledWith(6)
  })

  it('decrements by 1 (default step) when the - button is clicked', () => {
    const { onChange } = renderStepper({ qty: 5 })
    fireEvent.click(screen.getByLabelText('Decrease quantity'))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('increments by stepQty when a step other than 1 is configured', () => {
    const { onChange } = renderStepper({ qty: 10, min: 10, stepQty: 10 })
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    expect(onChange).toHaveBeenCalledWith(20)
  })

  it('decrements by stepQty when a step other than 1 is configured', () => {
    const { onChange } = renderStepper({ qty: 20, min: 10, stepQty: 10 })
    fireEvent.click(screen.getByLabelText('Decrease quantity'))
    expect(onChange).toHaveBeenCalledWith(10)
  })

  it('disables the decrement button and never calls onChange below min', () => {
    const { onChange } = renderStepper({ qty: 1, min: 1 })
    const decrement = screen.getByLabelText('Decrease quantity')
    expect(decrement).toBeDisabled()
    fireEvent.click(decrement)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables the increment button and never calls onChange above max', () => {
    const { onChange } = renderStepper({ qty: 10, min: 1, max: 10 })
    const increment = screen.getByLabelText('Increase quantity')
    expect(increment).toBeDisabled()
    fireEvent.click(increment)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('leaves the increment button enabled when there is no max', () => {
    renderStepper({ qty: 1000, min: 1, max: undefined })
    expect(screen.getByLabelText('Increase quantity')).toBeEnabled()
  })

  it('snaps a typed value below min up to min on blur, calls onChange, and announces the snap', () => {
    const { onChange } = renderStepper({ qty: 5, min: 1, max: 50 })
    const input = screen.getByLabelText('Quantity')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(1)
    expect(screen.getByText('Adjusted to 1 — the nearest valid quantity')).toBeInTheDocument()
  })

  it('snaps a typed value above max down to max on Enter', () => {
    const { onChange } = renderStepper({ qty: 5, min: 1, max: 10 })
    const input = screen.getByLabelText('Quantity')
    fireEvent.change(input, { target: { value: '999' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(10)
  })

  it('snaps a typed value to the nearest step grid above min', () => {
    const { onChange } = renderStepper({ qty: 10, min: 10, stepQty: 10, max: 100 })
    const input = screen.getByLabelText('Quantity')
    fireEvent.change(input, { target: { value: '24' } })
    fireEvent.blur(input)
    // 24 is 14 above min(10); 14/10 rounds to 1 step -> snapped to 20.
    expect(onChange).toHaveBeenCalledWith(20)
  })

  it('does not call onChange when the typed value already matches the current, valid quantity', () => {
    const { onChange } = renderStepper({ qty: 5, min: 1 })
    const input = screen.getByLabelText('Quantity')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.blur(input)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('strips non-numeric characters as the buyer types', () => {
    renderStepper({ qty: 5, min: 1 })
    const input = screen.getByLabelText('Quantity') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1a2b' } })
    expect(input.value).toBe('12')
  })

  it('renders the pack label when provided', () => {
    renderStepper({ packLabel: '1 box = 10 pcs' })
    expect(screen.getByText('1 box = 10 pcs')).toBeInTheDocument()
  })

  it('omits the pack label paragraph when not provided', () => {
    renderStepper({ packLabel: undefined })
    expect(screen.queryByText(/box/)).not.toBeInTheDocument()
  })
})
