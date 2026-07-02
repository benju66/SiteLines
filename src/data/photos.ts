// Photos seed (README §4). Striped CSS placeholders in the UI — wire to
// Procore photo thumbnails in production (Data Seam Phase 4).

import type { Photo } from '@/types'

export const PHOTOS: Photo[] = [
  { project: 'mckenna', caption: 'Footing F-12 rock condition', date: 'Jun 29', mine: true },
  { project: 'opiii', caption: 'Curtain wall mockup review', date: 'Jun 30', mine: true },
  { project: 'mckenna', caption: 'Level 2 slab pour', date: 'Jun 27', mine: false },
  { project: 'mckenna', caption: 'Storefront install', date: 'Jun 24', mine: false },
  { project: 'opiii', caption: 'Corridor Wing B punch walk', date: 'Jun 28', mine: false },
  { project: 'opiii', caption: 'Site logistics / crane set', date: 'Jun 20', mine: false },
  { project: 'mckenna', caption: 'Underground MEP rough-in', date: 'Jun 26', mine: false },
  { project: 'opiii', caption: 'MEP overhead coordination', date: 'Jun 22', mine: false },
]
