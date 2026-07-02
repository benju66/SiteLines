// Activity feed (DATA_CONTRACT §7). Reverse-chron events; header count is the
// unread total. In production, likely driven by Procore webhooks / change events.

import type { ActivityEvent } from '@/types'

export const ACTIVITY: ActivityEvent[] = [
  { project: 'mckenna', text: 'Structural EOR has not responded to RFI #042', sub: 'Tunnel tie-in conflict', tone: 'danger', when: '2h ago' },
  { project: 'mckenna', text: 'CO #007 still pending Owner approval', sub: '18 days open', tone: 'danger', when: 'today' },
  { project: 'opiii', text: 'Submittal #094 is ready for your review', sub: 'Curtain wall shop dwgs', tone: 'info', when: 'today' },
  { project: 'mckenna', text: 'You logged Daily Log for Jun 30', sub: 'Awaiting sign-off', tone: 'warn', when: '1d ago' },
  { project: 'opiii', text: 'CO #003 needs pricing before submission', sub: 'Added generator pad', tone: 'warn', when: '1d ago' },
  { project: 'mckenna', text: 'Submittal #112 submitted to Architect', sub: 'Structural steel seq. B', tone: 'info', when: '2d ago' },
  { project: 'opiii', text: 'Punch #012 assigned to sub', sub: 'Corridor Wing B', tone: 'muted', when: '3d ago' },
]
