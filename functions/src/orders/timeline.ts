import type { TimelineActor, TimelineEntry } from '@snapspare/shared'

/**
 * Appends one entry to a timeline array without mutating the input — every
 * transition function does `timeline: appendTimelineEntry(subOrder.timeline, ...)`.
 * Omits the `note` key entirely when absent rather than setting it to
 * `undefined` — the Admin SDK throws on literal `undefined` field values
 * since this project never sets `ignoreUndefinedProperties`.
 */
export function appendTimelineEntry(
  existing: TimelineEntry[],
  status: string,
  actor: TimelineActor,
  note: string | undefined,
  at: number,
): TimelineEntry[] {
  const entry: TimelineEntry = note !== undefined ? { status, actor, note, at } : { status, actor, at }
  return [...existing, entry]
}
