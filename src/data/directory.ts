// Project contacts (DATA_CONTRACT §4). Reference data — has no ball-in-court.
// Party resolution (who → contact) lives in src/lib/party.ts.

import type { Contact } from '@/types'

export const DIRECTORY: Contact[] = [
  { id: 'self', name: 'Ben Ostrander', company: 'Meridian Builders (GC)', role: 'Project Manager', trade: 'General Contractor', email: 'ben.ostrander@meridianbuild.com', phone: '612-555-0142', projects: ['mckenna', 'opiii'] },
  { id: 'eor', name: 'Dan Reismann, PE', company: 'Larson Structural', role: 'Structural EOR', trade: 'Structural Eng.', email: 'dreismann@larsonse.com', phone: '651-555-0188', projects: ['mckenna'] },
  { id: 'braun', name: 'Braun Intertec', company: 'Braun Intertec', role: 'Geotechnical Eng.', trade: 'Geotech', email: 'projects@braunintertec.com', phone: '952-555-0110', projects: ['mckenna'] },
  { id: 'arch', name: 'Maria Chen, AIA', company: 'Fieldhouse Architects', role: 'Architect of Record', trade: 'Architecture', email: 'mchen@fieldhouse-arch.com', phone: '612-555-0176', projects: ['mckenna', 'opiii'] },
  { id: 'owner', name: 'Tom Weller', company: 'Orchard Path Senior Living', role: 'Owner Representative', trade: 'Owner', email: 'tweller@orchardpath.org', phone: '952-555-0133', projects: ['mckenna', 'opiii'] },
  { id: 'harmon', name: 'Harmon Inc.', company: 'Harmon', role: 'Curtain Wall Sub', trade: 'Glazing', email: 'estimating@harmoninc.com', phone: '651-555-0155', projects: ['opiii'], match: 'Harmon' },
  { id: 'cemstone', name: 'Cemstone', company: 'Cemstone', role: 'Concrete Sub', trade: 'Concrete', email: 'dispatch@cemstone.com', phone: '651-555-0121', projects: ['mckenna'], match: 'Cemstone' },
  { id: 'otis', name: 'Otis Elevator', company: 'Otis', role: 'Elevator Sub', trade: 'Conveying', email: 'service@otis.com', phone: '800-555-0199', projects: ['mckenna'], match: 'Elevator' },
  { id: 'ahj', name: 'City of Prior Lake', company: 'City of Prior Lake', role: 'Building Official', trade: 'Authority (AHJ)', email: 'permits@priorlake.gov', phone: '952-555-0100', projects: ['mckenna'] },
  { id: 'finishes', name: 'Northland Finishes', company: 'Northland Finishes', role: 'Finishes Sub', trade: 'Finishes', email: 'ops@northlandfinishes.com', phone: '763-555-0166', projects: ['opiii', 'mckenna'], match: 'finish' },
]
