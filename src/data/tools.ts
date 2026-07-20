// Tool registry (DATA_CONTRACT §3). Each tool key maps to a label, mono code
// badge, view type, and — for list registers — column labels.

import type { NavGroup, ToolKey, ToolMeta } from '@/types'

export const TOOLS: Record<ToolKey, ToolMeta> = {
  overview: { label: 'Overview', code: '', view: 'overview', desc: 'Portfolio health across all projects.' },
  home: {
    label: 'My Court',
    code: '',
    view: 'home',
    desc: 'Every open ball-in-court item across your projects, sorted by urgency.',
  },
  directory: { label: 'Directory', code: 'DIR', view: 'directory', desc: 'Project contacts — owner, design team, subs, and agencies.' },
  rfis: { label: 'RFIs', code: 'RFI', view: 'list', group: 0, whoLabel: 'Waiting on', rightLabel: 'Age', desc: 'Requests for information.' },
  submittals: { label: 'Submittals', code: 'SUB', view: 'list', group: 0, whoLabel: 'Waiting on', rightLabel: 'Status', desc: 'Shop drawings, product data, samples.' },
  drawings: { label: 'Drawings', code: 'DWG', view: 'drawings', group: 0, desc: 'Current drawing set, grouped by discipline.' },
  specs: { label: 'Specifications', code: 'SPEC', view: 'specs', group: 0, desc: 'Project specification sections, grouped by CSI division.' },
  changeEvents: { label: 'Change Events', code: 'CE', view: 'changeEvents', group: 0, desc: 'Potential changes being tracked and priced.' },
  punch: { label: 'Punch List', code: 'PUN', view: 'punch', group: 0, desc: 'Closeout deficiencies — progress by stage and by sub.' },
  dailyLog: { label: 'Daily Log', code: 'LOG', view: 'dailyLog', group: 0, desc: 'Field reports, weather, and manpower.' },
  photos: { label: 'Photos', code: 'IMG', view: 'photos', group: 0, desc: 'Jobsite documentation.' },
  meetings: { label: 'Meetings', code: 'MTG', view: 'list', group: 0, whoLabel: 'Owner', rightLabel: 'When', desc: 'Agendas, minutes, and follow-ups.' },
  schedule: { label: 'Schedule', code: 'TASK', view: 'list', group: 0, whoLabel: 'Owner', rightLabel: 'Target', desc: 'Milestones and near-term look-ahead.' },
  documents: { label: 'Documents', code: 'DOC', view: 'list', group: 0, whoLabel: 'Owner', rightLabel: 'Status', desc: 'Contracts, permits, reports, insurance.' },
  primeContract: { label: 'Prime Contract', code: 'PC', view: 'financial', group: 1, desc: 'Owner contract value and billing to date.' },
  budget: { label: 'Budget', code: 'BUD', view: 'budget', group: 1, desc: 'Cost control by division.' },
  commitments: { label: 'Commitments', code: 'COM', view: 'commitments', group: 1, desc: 'Subcontracts and purchase orders.' },
  changeOrders: { label: 'Change Orders', code: 'CO', view: 'list', group: 1, whoLabel: 'Waiting on', rightLabel: 'Status', desc: 'Executed and pending contract changes.' },
  invoicing: { label: 'Invoicing', code: 'INV', view: 'invoicing', group: 1, desc: 'Pay applications in and out.' },
}

export const GROUPS: NavGroup[] = [
  { label: 'Core', keys: ['directory'] },
  {
    label: 'Project Management',
    keys: ['rfis', 'submittals', 'drawings', 'specs', 'changeEvents', 'punch', 'dailyLog', 'photos', 'meetings', 'schedule', 'documents'],
  },
  { label: 'Financial Management', keys: ['primeContract', 'budget', 'commitments', 'changeOrders', 'invoicing'] },
]
