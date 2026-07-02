// Party resolution (DATA_CONTRACT §4). Maps a record's free-text `who` to a
// Directory contact. WHO2ID is the seed stand-in for Procore's real party /
// company id — the live normalization views (Data Seam Phase 2+) will emit a
// contact id on the record and this string lookup goes away.

import type { Contact, Item } from '@/types'

export const WHO2ID: Record<string, string> = {
  You: 'self',
  'Structural EOR': 'eor',
  'Braun Intertec': 'braun',
  Architect: 'arch',
  Owner: 'owner',
  Sub: 'finishes',
}

/** The Directory contact behind a record's "Waiting on" party (null for Ben/unknown). */
export function partyContact(contacts: Contact[], record: Item): Contact | null {
  const id = WHO2ID[record.who]
  if (!id || id === 'self') return null
  return contacts.find((c) => c.id === id) ?? null
}

/** Does this record involve this contact (by party id or title keyword match)? */
export function involvesContact(record: Item, contact: Contact): boolean {
  if (WHO2ID[record.who] === contact.id) return true
  return !!contact.match && record.title.toLowerCase().includes(contact.match.toLowerCase())
}
