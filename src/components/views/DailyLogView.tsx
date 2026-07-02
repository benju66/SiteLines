// Daily Log (README §5) — field-report feed: date + project + sign-off pill,
// Weather / Temp / Manpower stats, and a notes paragraph. The In My Court
// toggle filters to entries needing Ben's sign-off.

import { mediaInScope } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono } from '@/theme/tokens'
import { ProjectTag } from '@/components/ui/primitives'

function Stat({ label, value, monospace }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div>
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--tx-faint)' }}>{label}</span>
      <div style={{ fontSize: 12.5, fontWeight: 530, marginTop: 1, ...(monospace ? { fontFamily: mono } : {}) }}>{value}</div>
    </div>
  )
}

export function DailyLogView() {
  const { state } = useApp()
  const { dailyLogs } = useSiteData()
  const rows = mediaInScope(dailyLogs, state)

  return (
    <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((l) => (
        <div key={`${l.project}:${l.date}`} style={{ background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: mono, fontSize: 12.5, fontWeight: 650 }}>{l.date}</span>
            <ProjectTag project={l.project} />
            <div style={{ flex: 1 }} />
            {l.mine ? (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.3px', background: '#fbf1d8', color: '#8a6300', border: '1px solid #efd89a', padding: '2px 8px', borderRadius: 5 }}>
                NEEDS SIGN-OFF
              </span>
            ) : (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.3px', background: '#e7f4ec', color: '#2c7a4f', border: '1px solid #bfe3cd', padding: '2px 8px', borderRadius: 5 }}>
                SIGNED
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
            <Stat label="Weather" value={l.weather} />
            <Stat label="Temp" value={l.temp} monospace />
            <Stat label="Manpower" value={`${l.crew} on site`} monospace />
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.5, color: '#3c434c' }}>{l.notes}</p>
        </div>
      ))}
      {rows.length === 0 && (
        <div style={{ padding: 52, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>
          No logs awaiting your sign-off. Toggle to <b style={{ color: 'var(--tx-secondary-2)' }}>All</b> for the full log.
        </div>
      )}
    </div>
  )
}
