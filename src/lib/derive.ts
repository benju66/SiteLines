// Pure, deterministic derivation (Procore-Data-Seam-Plan, "Pure logic").
// These complete raw normalization-view rows (due_date, raw_status_label) into
// full Item display fields — computed CLIENT-side against the caller's `today`
// so data synced hours ago never shows stale urgency (DATA_CONTRACT §1).
//
// Rule: pass `today`/`now` IN; never read the clock inside (keeps tests
// deterministic).

import type { Tone, Urgency } from '@/types'

const DAY_MS = 86_400_000

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Parse an ISO date (YYYY-MM-DD or full timestamp) as a local date. */
function parseISO(iso: string): Date {
  // Bare dates parse as UTC midnight in JS; anchor them to local midnight so
  // day math doesn't drift across timezones.
  return iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso)
}

/**
 * Urgency from due date vs. today (DATA_CONTRACT §1): past due → 'over';
 * due within 7 days (incl. today) → 'week'; otherwise 'track'. Terminal /
 * informational records read as inactive → 'muted'. No due date → 'track'.
 */
export function deriveUrgency(dueDateISO: string | null, today: Date, isTerminal = false): Urgency {
  if (isTerminal) return 'muted'
  if (!dueDateISO) return 'track'
  const days = Math.round((startOfDay(parseISO(dueDateISO)) - startOfDay(today)) / DAY_MS)
  if (days < 0) return 'over'
  if (days <= 7) return 'week'
  return 'track'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Absolute display date, e.g. "Jun 11, 2026" — for dates shown as-is (a
 * commitment CO date, a pay-app billing date), not urgency-relative. No clock:
 * the year is always shown. null/blank → null so callers can render "—".
 */
export function formatShortDate(iso: string | null): string | null {
  if (!iso) return null
  const d = parseISO(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/**
 * Display string for a due date, matching the seed vocabulary:
 * "due Jun 24" (with the year appended when it isn't `today`'s year).
 * No due date → '—'.
 */
export function formatDueDate(dueDateISO: string | null, today: Date): string {
  if (!dueDateISO) return '—'
  const d = parseISO(dueDateISO)
  const yr = d.getFullYear() === today.getFullYear() ? '' : ` ${d.getFullYear()}`
  return `due ${MONTHS[d.getMonth()]} ${d.getDate()}${yr}`
}

/**
 * Status-pill tone from a Procore status label. Known labels map directly;
 * "Open" is urgency-dependent (overdue Open reads danger, due-this-week warn);
 * unknown labels fall back to 'muted' so a new Procore status degrades quietly
 * instead of miscoloring.
 */
const TONE_BY_LABEL: Record<string, Tone> = {
  // info — in someone's review pipeline
  'Under Review': 'info',
  Submitted: 'info',
  Scheduled: 'info',
  'Ready to Verify': 'info',
  'Pending Review': 'info',
  // warn — needs attention soon
  'Revise & Resubmit': 'warn',
  'Out for Signature': 'warn',
  'Agenda Due': 'warn',
  'Renew Soon': 'warn',
  Revised: 'warn',
  // danger — blocked / late
  'Pending Owner': 'danger',
  Behind: 'danger',
  // ok — healthy or terminal-good
  Approved: 'ok',
  Closed: 'ok',
  Current: 'ok',
  Final: 'ok',
  Issued: 'ok',
  Executed: 'ok',
  'On Track': 'ok',
  Answered: 'ok',
  // muted — inactive
  Draft: 'muted',
  Void: 'muted',
  Superseded: 'muted',
  'Minutes Draft': 'muted',
}

export function statusTone(rawLabel: string, urgency: Urgency): Tone {
  const known = TONE_BY_LABEL[rawLabel]
  if (known) return known
  if (rawLabel === 'Open') return urgency === 'over' ? 'danger' : urgency === 'week' ? 'warn' : 'info'
  return 'muted'
}

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/** Money display for the tools that show a dollar amount instead of a due date
 * (commitments, change orders, invoicing), e.g. `$186,400`. */
export function formatMoney(amount: number): string {
  return USD.format(amount)
}

/** Relative "synced Xm ago" label for the header indicator. */
export function timeAgo(then: Date, now: Date): string {
  const s = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
