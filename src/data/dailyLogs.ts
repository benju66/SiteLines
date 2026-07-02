// Daily-log seed (README §5). Field reports with weather / manpower stats;
// `mine` = entries awaiting Ben's sign-off.

import type { DailyLogEntry } from '@/types'

export const DAILY_LOGS: DailyLogEntry[] = [
  {
    project: 'mckenna',
    date: 'Jun 30',
    weather: 'Partly cloudy',
    temp: '78°F',
    crew: 34,
    mine: true,
    notes: 'Structural steel erection continued at grid C–F. Concrete washout relocated per SWPPP. Rock encountered at footing F-12 — see CE #014.',
  },
  {
    project: 'opiii',
    date: 'Jun 30',
    weather: 'Clear',
    temp: '81°F',
    crew: 26,
    mine: true,
    notes: 'Curtain wall mockup reviewed with Harmon. MEP overhead rough-in continued Level 1. No safety incidents.',
  },
  {
    project: 'mckenna',
    date: 'Jun 27',
    weather: 'Rain AM',
    temp: '66°F',
    crew: 18,
    mine: false,
    notes: 'Slab pour Level 2 completed. 2-hour weather delay in the morning. Pump truck demobilized 2:30p.',
  },
  {
    project: 'opiii',
    date: 'Jun 28',
    weather: 'Clear',
    temp: '79°F',
    crew: 22,
    mine: false,
    notes: 'Punch walk of Wing B corridor with owner rep. Touch-up list issued to finishes sub.',
  },
]
