// A tiny generic undo/redo history (Commitments, Scope-Editor R1 follow-up). Pure +
// deterministic (no clock, no I/O) so the view stays dumb and the tricky bits — a no-op
// edit records nothing, and a burst of same-`tag` edits collapses into ONE undo step —
// are unit-tested. Used by the scope editor to step `ScopeBlockOverride[]` snapshots
// back and forth; because every snapshot was produced by the words-locked pure ops,
// undo/redo can only revisit valid states — it never fabricates a new one, so the
// on-save `partitionsSource` guarantee is untouched.

export interface History<T> {
  /** Prior states, oldest first; the last entry is the one `undo` restores. */
  past: T[]
  /** The current state. */
  present: T
  /** Undone states, next-to-redo first. */
  future: T[]
  /** The tag of the last recorded edit, for coalescing consecutive same-tag edits. */
  tag: string | null
}

/** A fresh history holding just `present`. */
export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], tag: null }
}

/**
 * Record an edit: apply `fn` to the present and push the old present onto `past`,
 * clearing the redo stack. Two shortcuts keep the undo stack meaningful:
 *   • if `fn` returns the SAME reference (a no-op op, e.g. a split out of range),
 *     nothing is recorded — the history is returned unchanged; and
 *   • if `tag` is non-null and equals the previous edit's tag, the edit COALESCES —
 *     it replaces the present without growing `past`, so a burst of note typing (all
 *     tagged the same) is a single undo step rather than one-per-keystroke.
 */
export function pushEdit<T>(h: History<T>, fn: (present: T) => T, tag: string | null = null): History<T> {
  const next = fn(h.present)
  if (next === h.present) return h
  if (tag !== null && tag === h.tag) {
    return { past: h.past, present: next, future: [], tag }
  }
  return { past: [...h.past, h.present], present: next, future: [], tag }
}

/** Step back one state (no-op when there's nothing to undo). Clears the coalescing tag
 *  so the next edit always starts a fresh step. */
export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
    tag: null,
  }
}

/** Step forward one state (no-op when there's nothing to redo). */
export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h
  return {
    past: [...h.past, h.present],
    present: h.future[0],
    future: h.future.slice(1),
    tag: null,
  }
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0
