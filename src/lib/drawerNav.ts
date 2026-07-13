// Pure transitions for the detail drawer's cross-link navigation + resize (the
// single place that governs the Back button and the drawer width). All four detail
// drawers (Record / Commitment / Change Event / Invoice) occupy one of four mutually
// exclusive `AppState` slots; navigating between them is a slot swap plus a push/pop
// of `drawerHistory`. Kept here as plain functions (no React, no clock) so the rules
// are unit-tested; components apply them via `patch(...)`. See `DrawerTarget` in
// `@/types` and the `DrawerShell` overlay.

import type { ChangeEvent, Commitment, DrawerTarget, Invoice, Item, ToolKey } from '@/types'

/** The four drawer slots this module reads and writes — the `AppState` subset it
 *  owns. Declared locally (not `Pick<AppState, …>`) so `lib` stays a leaf that only
 *  depends on domain types, never on the state module. */
export interface DrawerSlots {
  detail: { tool: ToolKey; record: Item } | null
  commitment: Commitment | null
  changeEvent: ChangeEvent | null
  invoice: Invoice | null
}

/** Floor width for the drag-resize, in px (a touch under the 452 default). */
export const DRAWER_MIN_WIDTH = 380
/** Default drawer width, in px (the original fixed size). */
export const DRAWER_DEFAULT_WIDTH = 452
/** Gap kept between the panel's left edge and the viewport edge, in px — so a strip
 *  of backdrop stays clickable to close even at max width / in full-width mode. This
 *  is also the ceiling for both the drag and the full-width mode. */
export const DRAWER_EDGE_GAP = 40

const CLEARED: DrawerSlots = { detail: null, commitment: null, changeEvent: null, invoice: null }

/** The slot patch that shows exactly `target` (and clears the other three). */
export function slotFor(target: DrawerTarget): DrawerSlots {
  switch (target.kind) {
    case 'detail':
      return { ...CLEARED, detail: target.value }
    case 'commitment':
      return { ...CLEARED, commitment: target.value }
    case 'changeEvent':
      return { ...CLEARED, changeEvent: target.value }
    case 'invoice':
      return { ...CLEARED, invoice: target.value }
  }
}

/** The currently-open drawer as a target, or null when none is open. */
export function currentTarget(s: DrawerSlots): DrawerTarget | null {
  if (s.detail) return { kind: 'detail', value: s.detail }
  if (s.commitment) return { kind: 'commitment', value: s.commitment }
  if (s.changeEvent) return { kind: 'changeEvent', value: s.changeEvent }
  if (s.invoice) return { kind: 'invoice', value: s.invoice }
  return null
}

/** Open `target` FRESH (from a register row / palette): show it and reset the
 *  back-stack — a freshly-opened drawer has nowhere to go back to. */
export function openPatch(target: DrawerTarget): DrawerSlots & { drawerHistory: DrawerTarget[] } {
  return { ...slotFor(target), drawerHistory: [] }
}

/** Navigate to `target` from WITHIN the drawer (following a cross-link): push the
 *  current target onto the back-stack, then show the new one. */
export function navigatePatch(
  s: DrawerSlots & { drawerHistory: DrawerTarget[] },
  target: DrawerTarget,
): DrawerSlots & { drawerHistory: DrawerTarget[] } {
  const cur = currentTarget(s)
  return { ...slotFor(target), drawerHistory: cur ? [...s.drawerHistory, cur] : s.drawerHistory }
}

/** Go back one step: pop the back-stack and restore that target. Returns an empty
 *  patch (a no-op) when the stack is empty. */
export function backPatch(s: { drawerHistory: DrawerTarget[] }): Partial<DrawerSlots & { drawerHistory: DrawerTarget[] }> {
  const hist = s.drawerHistory
  if (hist.length === 0) return {}
  const prev = hist[hist.length - 1]
  return { ...slotFor(prev), drawerHistory: hist.slice(0, -1) }
}

/** Close every detail drawer and clear the back-stack (× / Esc / backdrop click).
 *  The width + full-width preferences are intentionally left untouched (sticky). */
export function closePatch(): DrawerSlots & { drawerHistory: DrawerTarget[] } {
  return { ...CLEARED, drawerHistory: [] }
}

/** Clamp a proposed drawer width to [MIN, viewport − edge gap]. Guards a tiny
 *  viewport where the gap alone would push the max below the min. */
export function clampDrawerWidth(px: number, viewportWidth: number): number {
  const max = Math.max(DRAWER_MIN_WIDTH, viewportWidth - DRAWER_EDGE_GAP)
  return Math.min(max, Math.max(DRAWER_MIN_WIDTH, px))
}
