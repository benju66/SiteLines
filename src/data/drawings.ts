// Seed drawings (Drawings workstream, Phase 1). A small fixture so seed mode
// (VITE_DATA_SOURCE=seed) still renders the discipline-grouped log offline. In
// live mode these come from the `sitelines_drawings` view via mapDrawing().
//
// Numbers are chosen to exercise the natural sort (A2.9 before A2.10; S-11
// before S-101 — both wrong under a plain lexicographic sort) and the
// count-desc discipline order (Architectural 5 · Structural 3 · Mechanical 2).
// One sheet has no pdf, to exercise the disabled "Open PDF" affordance.

import type { Drawing } from '@/types'

export const DRAWINGS: Drawing[] = [
  // Architectural (5)
  d('drawings:seed-a01a', 'A0.1A', 'Cover Sheet & Sheet Index', 'Architectural', '2', 'Mar 4, 2026', 'Mar 19, 2026'),
  d('drawings:seed-a11', 'A1.1', 'Architectural Site Plan', 'Architectural', '3', 'Mar 4, 2026', 'Mar 19, 2026'),
  d('drawings:seed-a29', 'A2.9', 'Enlarged Unit Plans — Type C', 'Architectural', '1', 'Feb 18, 2026', 'Feb 20, 2026'),
  d('drawings:seed-a210', 'A2.10', 'Enlarged Unit Plans — Type D', 'Architectural', '1', 'Feb 18, 2026', 'Feb 20, 2026'),
  d('drawings:seed-a51', 'A5.1', 'Building Sections', 'Architectural', '4', 'Mar 4, 2026', 'Mar 19, 2026'),
  // Structural (3)
  d('drawings:seed-s11', 'S-11', 'Typical Details', 'Structural', '2', 'Jan 30, 2026', 'Feb 2, 2026'),
  d('drawings:seed-s101', 'S-101', 'Foundation Plan', 'Structural', '5', 'Feb 27, 2026', 'Mar 2, 2026'),
  d('drawings:seed-s102', 'S-102', 'Second Floor Framing Plan', 'Structural', '5', 'Feb 27, 2026', 'Mar 2, 2026'),
  // Mechanical (2)
  d('drawings:seed-m21', 'M2.1', 'First Floor HVAC Plan', 'Mechanical', '3', 'Feb 12, 2026', 'Feb 14, 2026'),
  d('drawings:seed-m22', 'M2.2', 'Second Floor HVAC Plan', 'Mechanical', '3', 'Feb 12, 2026', 'Feb 14, 2026', { noPdf: true }),
]

/** Compact fixture builder — a published sheet. `pngUrl` is a self-contained SVG
 *  placeholder (data URI) so the in-app viewer renders a real, zoomable sheet in
 *  seed mode; `pdfUrl` is a non-resolving placeholder (Open PDF is inert offline). */
function d(
  id: string,
  number: string,
  title: string,
  discipline: string,
  revision: string,
  drawingDate: string,
  receivedDate: string,
  opts: { noPdf?: boolean } = {},
): Drawing {
  return {
    id,
    drawingId: id.replace('drawings:seed-', 'dwg-'),
    number,
    title,
    discipline,
    revision,
    drawingDate,
    receivedDate,
    set: '2026.03.04 Orchard Path III — ASI 012',
    status: 'published',
    thumbnailUrl: null,
    pngUrl: opts.noPdf ? null : placeholderSheet(number, title),
    pdfUrl: opts.noPdf ? null : `https://example.com/seed/${number}.pdf`,
  }
}

/** A landscape "sheet" SVG as a data URI — a title block + number, for seed viewing. */
function placeholderSheet(number: string, title: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="850" viewBox="0 0 1100 850">
    <rect width="1100" height="850" fill="#fbfbfc"/>
    <rect x="24" y="24" width="1052" height="802" fill="none" stroke="#c4c9cf" stroke-width="2"/>
    <rect x="40" y="40" width="1020" height="770" fill="none" stroke="#e2e5e9" stroke-width="1"/>
    <text x="60" y="120" font-family="monospace" font-size="64" font-weight="700" fill="#1a1d21">${number}</text>
    <text x="60" y="170" font-family="sans-serif" font-size="28" fill="#5b626c">${title}</text>
    <rect x="740" y="700" width="320" height="90" fill="none" stroke="#c4c9cf" stroke-width="1.5"/>
    <text x="760" y="735" font-family="sans-serif" font-size="16" fill="#9298a1">SEED PLACEHOLDER SHEET</text>
    <text x="760" y="765" font-family="monospace" font-size="18" fill="#5b626c">${number}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
