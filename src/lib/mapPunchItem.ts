// Pure mapper: a `sitelines_punch` view row → the `PunchItem` shape the closeout
// dashboard renders. Deterministic — no clock; the display date is formatted from its
// ISO parts (formatResponseDate) while the raw ISO is kept for chronological sorting,
// and text is cleaned via the shared htmlToText helper.

import type { Project, PunchItem } from '@/types'
import { formatResponseDate, htmlToText } from './detailText'

/** One row of the sitelines_punch view (raw jsonb fields, still nullable). */
export interface PunchRow {
  id: string
  project: string | null
  number: string | null
  name: string | null
  assignee: string | null
  status: string | null
  workflow_status: string | null
  due_date: string | null // ISO "YYYY-MM-DD"
  has_photos: boolean | null
  has_open_response: boolean | null
  manager: string | null
}

/** Map a punch view row to the PunchItem contract shape. */
export function mapPunchItem(row: PunchRow): PunchItem {
  return {
    id: row.id,
    project: row.project === 'mckenna' ? 'mckenna' : ('opiii' as Project),
    number: (row.number ?? '').trim(),
    name: htmlToText(row.name),
    assignee: (row.assignee ?? '').trim(),
    status: (row.status ?? '').trim(),
    workflowStatus: (row.workflow_status ?? '').trim(),
    dueDate: formatResponseDate(row.due_date),
    dueSort: (row.due_date ?? '').trim(),
    hasPhotos: !!row.has_photos,
    hasOpenResponse: !!row.has_open_response,
    manager: (row.manager ?? '').trim(),
  }
}
