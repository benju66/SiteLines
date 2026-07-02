// Seed records. In production these are replaced by the Procore-integration
// service producing the same normalized `Record` shape (DATA_CONTRACT §1).
//
// Ids are synthesized as `${tool}:${num}` so cross-tool links (§5) resolve
// stably. `links` holds related record ids; relationships are bidirectional.

import type { Item, Status, ToolKey, Urgency } from '@/types'

/** Compact raw shape for authoring the seed; expanded to `Item` below. */
type Raw = {
  project: Item['project']
  num: string
  title: string
  who: string
  mine: boolean
  date: string
  urgency: Urgency
  status: Status | null
  links?: string[]
}

const build = (tool: ToolKey, rows: Raw[]): Item[] =>
  rows.map((r) => ({ id: `${tool}:${r.num}`, tool, ...r }))

export const DATA: Record<ToolKey, Item[]> = {
  overview: [],
  home: [],
  directory: [],
  primeContract: [],
  budget: [],
  photos: [],
  dailyLog: [],

  rfis: build('rfis', [
    { project: 'mckenna', num: '#042', title: 'Tunnel tie-in elevation conflict at existing garage', who: 'Structural EOR', mine: false, date: 'due Jun 24', urgency: 'over', status: { label: 'Open', tone: 'danger' }, links: ['drawings:S-101'] },
    { project: 'mckenna', num: '#039', title: 'Boring log mislabeling clarification', who: 'Braun Intertec', mine: false, date: 'due Jul 3', urgency: 'week', status: { label: 'Open', tone: 'warn' } },
    { project: 'mckenna', num: '#044', title: 'Fire-rated ceiling assembly at Unit 210', who: 'You', mine: true, date: 'due Jul 8', urgency: 'track', status: { label: 'Draft', tone: 'muted' } },
    { project: 'opiii', num: '#021', title: 'Door hardware spec conflict, Level 2', who: 'Architect', mine: false, date: 'due Jul 2', urgency: 'week', status: { label: 'Open', tone: 'warn' }, links: ['submittals:#118', 'specs:08 71 00'] },
    { project: 'opiii', num: '#019', title: 'Slab depression at mechanical room', who: 'Architect', mine: false, date: 'answered', urgency: 'muted', status: { label: 'Closed', tone: 'ok' } },
  ]),
  submittals: build('submittals', [
    { project: 'mckenna', num: '#118', title: 'Door hardware spec, Type 4 sets', who: 'You', mine: true, date: 'due Jul 7', urgency: 'track', status: { label: 'Under Review', tone: 'info' }, links: ['rfis:#021', 'specs:08 71 00'] },
    { project: 'mckenna', num: '#112', title: 'Structural steel — sequence B', who: 'Architect', mine: false, date: 'due Jul 5', urgency: 'week', status: { label: 'Submitted', tone: 'info' } },
    { project: 'opiii', num: '#094', title: 'Curtain wall shop drawings', who: 'You', mine: true, date: 'due Jul 6', urgency: 'track', status: { label: 'Under Review', tone: 'info' }, links: ['commitments:SC-22'] },
    { project: 'opiii', num: '#088', title: 'Elevator cab finishes', who: 'Sub', mine: false, date: 'w/ sub', urgency: 'week', status: { label: 'Revise & Resubmit', tone: 'warn' } },
  ]),
  changeOrders: build('changeOrders', [
    { project: 'mckenna', num: 'CO #007', title: 'Site grade correction scope', who: 'Owner', mine: false, date: 'due Jun 18', urgency: 'over', status: { label: 'Pending Owner', tone: 'danger' } },
    { project: 'opiii', num: 'CO #003', title: 'Added generator pad', who: 'You', mine: true, date: 'needs pricing', urgency: 'week', status: { label: 'Draft', tone: 'muted' } },
    { project: 'mckenna', num: 'CO #005', title: 'Revised canopy steel', who: 'Owner', mine: false, date: 'Jun 12', urgency: 'track', status: { label: 'Approved', tone: 'ok' } },
  ]),
  punch: build('punch', [
    { project: 'opiii', num: '#012', title: 'Corridor finish touch-up, Wing B', who: 'Sub', mine: false, date: 'due Jul 4', urgency: 'week', status: { label: 'Open', tone: 'warn' } },
    { project: 'mckenna', num: '#008', title: 'Sealant at storefront jambs', who: 'Sub', mine: false, date: 'overdue', urgency: 'over', status: { label: 'Open', tone: 'danger' } },
    { project: 'opiii', num: '#015', title: 'Touch-up paint, stair 2', who: 'You', mine: true, date: 'verify', urgency: 'track', status: { label: 'Ready to Verify', tone: 'info' } },
  ]),
  changeEvents: build('changeEvents', [
    { project: 'mckenna', num: 'CE #014', title: 'Unforeseen rock at footing F-12', who: 'You', mine: true, date: 'price pending', urgency: 'week', status: { label: 'Open', tone: 'warn' }, links: ['rfis:#042'] },
    { project: 'opiii', num: 'CE #009', title: 'Owner-requested lobby finish upgrade', who: 'You', mine: true, date: 'ROM sent', urgency: 'track', status: { label: 'Open', tone: 'info' } },
    { project: 'mckenna', num: 'CE #011', title: 'Weather delay — May storms', who: '—', mine: false, date: 'documented', urgency: 'muted', status: { label: 'Void', tone: 'muted' } },
  ]),
  commitments: build('commitments', [
    { project: 'mckenna', num: 'SC-14', title: 'Concrete — Cemstone', who: '—', mine: false, date: '$1.24M', urgency: 'track', status: { label: 'Executed', tone: 'ok' } },
    { project: 'opiii', num: 'SC-22', title: 'Curtain wall — Harmon', who: 'You', mine: true, date: '$3.10M', urgency: 'week', status: { label: 'Out for Signature', tone: 'warn' }, links: ['submittals:#094', 'invoicing:App 05'] },
    { project: 'mckenna', num: 'PO-08', title: 'Elevators — Otis', who: 'You', mine: true, date: '$412K', urgency: 'track', status: { label: 'Draft', tone: 'muted' } },
  ]),
  invoicing: build('invoicing', [
    { project: 'mckenna', num: 'App 08', title: 'Cemstone — May progress', who: 'You', mine: true, date: '$186,400', urgency: 'week', status: { label: 'Pending Review', tone: 'warn' }, links: ['commitments:SC-14'] },
    { project: 'opiii', num: 'App 05', title: 'Harmon — deposit', who: 'You', mine: true, date: '$310,000', urgency: 'track', status: { label: 'Pending Review', tone: 'info' }, links: ['commitments:SC-22'] },
    { project: 'mckenna', num: 'App 07', title: 'Owner pay app — June', who: 'Owner', mine: false, date: '$1,020,000', urgency: 'track', status: { label: 'Submitted', tone: 'info' } },
  ]),
  meetings: build('meetings', [
    { project: 'mckenna', num: 'OAC 14', title: 'Owner–Architect–Contractor weekly', who: 'You', mine: true, date: 'Jul 2, 9:00a', urgency: 'week', status: { label: 'Agenda Due', tone: 'warn' } },
    { project: 'opiii', num: 'COORD 06', title: 'MEP coordination', who: 'You', mine: true, date: 'Jul 3, 1:00p', urgency: 'track', status: { label: 'Scheduled', tone: 'info' } },
    { project: 'mckenna', num: 'OAC 13', title: 'OAC weekly — minutes', who: 'You', mine: true, date: 'Jun 25', urgency: 'track', status: { label: 'Minutes Draft', tone: 'muted' } },
  ]),
  schedule: build('schedule', [
    { project: 'mckenna', num: 'M-03', title: 'Underground MEP rough-in', who: '—', mine: false, date: 'Jun 27', urgency: 'over', status: { label: 'Behind', tone: 'danger' } },
    { project: 'mckenna', num: 'M-04', title: 'Structural steel top-out', who: '—', mine: false, date: 'Jul 10', urgency: 'week', status: { label: 'On Track', tone: 'ok' } },
    { project: 'opiii', num: 'M-06', title: 'Curtain wall start', who: '—', mine: false, date: 'Jul 21', urgency: 'track', status: { label: 'On Track', tone: 'ok' } },
  ]),
  drawings: build('drawings', [
    { project: 'mckenna', num: 'S-101', title: 'Foundation Plan', who: 'Rev 3', mine: true, date: 'Jun 28', urgency: 'week', status: { label: 'Under Review', tone: 'info' }, links: ['rfis:#042'] },
    { project: 'mckenna', num: 'A-201', title: 'Level 2 Floor Plan', who: 'Rev 4', mine: false, date: 'Jun 20', urgency: 'track', status: { label: 'Current', tone: 'ok' } },
    { project: 'opiii', num: 'A-501', title: 'Wall Sections', who: 'Rev 2', mine: false, date: 'Jun 15', urgency: 'track', status: { label: 'Current', tone: 'ok' } },
    { project: 'opiii', num: 'A-200', title: 'Level 1 Floor Plan', who: 'Rev 1', mine: false, date: 'May 30', urgency: 'muted', status: { label: 'Superseded', tone: 'muted' } },
  ]),
  specs: build('specs', [
    { project: 'mckenna', num: '08 71 00', title: 'Door Hardware', who: 'Rev 2', mine: true, date: 'Jun 22', urgency: 'week', status: { label: 'Revised', tone: 'warn' }, links: ['submittals:#118', 'rfis:#021'] },
    { project: 'mckenna', num: '03 30 00', title: 'Cast-in-Place Concrete', who: 'Rev 1', mine: false, date: 'May 10', urgency: 'track', status: { label: 'Current', tone: 'ok' } },
    { project: 'opiii', num: '08 44 13', title: 'Glazed Curtain Walls', who: 'Rev 1', mine: false, date: 'May 18', urgency: 'track', status: { label: 'Current', tone: 'ok' } },
  ]),
  documents: build('documents', [
    { project: 'opiii', num: 'INS', title: 'Certificate of Insurance — Harmon', who: 'You', mine: true, date: 'exp Aug 1', urgency: 'week', status: { label: 'Renew Soon', tone: 'warn' } },
    { project: 'mckenna', num: 'GEO', title: 'Geotech Report — Braun Intertec', who: '—', mine: false, date: 'Apr 02', urgency: 'track', status: { label: 'Final', tone: 'ok' } },
    { project: 'mckenna', num: 'PERMIT', title: 'Building Permit — City of Prior Lake', who: '—', mine: false, date: 'Mar 15', urgency: 'track', status: { label: 'Issued', tone: 'ok' } },
  ]),
}
