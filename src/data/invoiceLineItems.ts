// Seed fixture: pay-app G703 SOV line items (Invoicing, Phase 5). A deterministic
// slice shaped like the live sitelines_invoice_line_items view after mapInvoiceLineItem
// — the schedule of values behind a few seed pay apps. Each pay app's line `billedToDate`
// sum equals its invoice `billedToDate` (in INVOICES), so the drawer's SOV total
// reconciles to the G702 cover sheet. billedToDate = fromPrevious + thisPeriod + stored;
// balanceToFinish = scheduledValue − billedToDate; retainage ≈ 5% of billed. Raw dollars.
// Northline has two pay apps (7001 Apr, 7002 May) so the billing-history drill shows the
// SOV progressing period to period; the other latest pay apps carry one SOV each.

import type { InvoiceLineItem } from '@/types'

const line = (
  invoiceId: string,
  n: string,
  description: string,
  scheduledValue: number,
  fromPrevious: number,
  thisPeriod: number,
): InvoiceLineItem => {
  const billedToDate = fromPrevious + thisPeriod
  return {
    project: 'opiii',
    id: `${invoiceId}:li:${n}`,
    invoiceId,
    itemNumber: n,
    description,
    scheduledValue,
    fromPrevious,
    thisPeriod,
    stored: 0,
    billedToDate,
    pctComplete: scheduledValue > 0 ? billedToDate / scheduledValue : 0,
    retainage: Math.round(billedToDate * 0.05 * 100) / 100,
    balanceToFinish: scheduledValue - billedToDate,
  }
}

export const INVOICE_LINE_ITEMS: InvoiceLineItem[] = [
  // Northline Mechanical — pay app #1 (April), billed 1,200,000
  line('invoicing:7001', '1', 'HVAC systems — RTUs, ductwork, controls', 1_000_000, 0, 600_000),
  line('invoicing:7001', '2', 'Domestic water, sanitary & storm piping', 700_000, 0, 400_000),
  line('invoicing:7001', '3', 'Mechanical insulation', 300_000, 0, 200_000),
  // Northline Mechanical — pay app #2 (May, latest), billed 1,974,850
  line('invoicing:7002', '1', 'HVAC systems — RTUs, ductwork, controls', 1_000_000, 600_000, 395_000),
  line('invoicing:7002', '2', 'Domestic water, sanitary & storm piping', 700_000, 400_000, 290_000),
  line('invoicing:7002', '3', 'Mechanical insulation', 300_000, 200_000, 89_850),

  // Summit Interiors — pay app #2 (May, latest), billed 1,197,286
  line('invoicing:7004', '1', 'Gypsum board assemblies & taping', 800_000, 320_000, 470_000),
  line('invoicing:7004', '2', 'Field painting, two coats', 448_111, 45_000, 362_286),

  // Granite State Electric — latest, billed 1,150,900
  line('invoicing:7005', '1', 'Power distribution, panels & feeders', 900_000, 0, 895_900),
  line('invoicing:7005', '2', 'Low-voltage rough-in (data / fire alarm)', 265_775, 0, 255_000),

  // Lakeside Supply — appliance PO, billed 268,125
  line('invoicing:7006', '1', 'Unit appliance package (delivered)', 412_500, 0, 268_125),
]
