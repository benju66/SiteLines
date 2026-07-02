// Design tokens (from README "Design Tokens"). This is the single source of
// truth for values consumed in JS — dynamic, data-driven coloring (urgency
// dots, project tags, status pills). Static shell chrome lives in index.css as
// CSS custom properties; keep the two in sync.

import type { Project, Tone, Urgency } from '@/types'

export const projectMeta: Record<
  Project,
  { short: string; full: string; color: string; bg: string }
> = {
  mckenna: { short: 'McKenna', full: 'McKenna Crossing', color: '#2f5f8a', bg: '#eaf1f8' },
  opiii: { short: 'OP_III', full: 'OP_III', color: '#2f7d76', bg: '#e7f2f1' },
}

/** % complete per project (Overview progress bars). */
export const projectPct: Record<Project, number> = { mckenna: 62, opiii: 41 }

export const urgency: Record<
  Urgency,
  { dot: string; ring: string; color: string; rank: number }
> = {
  over: { dot: '#e8590c', ring: '#e8590c22', color: '#b23c0e', rank: 0 },
  week: { dot: '#d99400', ring: '#d9940026', color: '#8a6300', rank: 1 },
  track: { dot: '#3fa06a', ring: '#3fa06a22', color: '#2c7a4f', rank: 2 },
  muted: { dot: '#c4c9cf', ring: '#c4c9cf22', color: '#9298a1', rank: 3 },
}

/** Status-pill tones: text / background / border. */
export const tone: Record<Tone, { c: string; bg: string; bd: string }> = {
  danger: { c: '#b23c0e', bg: '#fbe9e0', bd: '#f2c9b6' },
  warn: { c: '#8a6300', bg: '#fbf1d8', bd: '#efd89a' },
  ok: { c: '#2c7a4f', bg: '#e7f4ec', bd: '#bfe3cd' },
  info: { c: '#2f5f8a', bg: '#eaf1f8', bd: '#c3d5e8' },
  muted: { c: '#6b727b', bg: '#eef0f3', bd: '#dde1e6' },
}

export const accent = '#e8590c' // safety-orange: overdue, "your court", flags

export const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace'
