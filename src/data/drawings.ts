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

/** Compact fixture builder — a published sheet with placeholder (non-resolving) urls. */
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
    pngUrl: opts.noPdf ? null : `https://example.com/seed/${number}.png`,
    pdfUrl: opts.noPdf ? null : `https://example.com/seed/${number}.pdf`,
  }
}
