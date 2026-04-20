import { useState, useEffect } from 'react'
import { C } from '../data/constants'
import { Badge, Icon } from './UI'
import { loadRecordDetailData } from '../data/layoutService'

// ---------------------------------------------------------------------------
// Field value formatter — converts raw DB values to display strings
// ---------------------------------------------------------------------------

function formatFieldValue(raw, fieldDef, picklists, lookups) {
  if (raw === null || raw === undefined) return '—'

  switch (fieldDef.type) {
    case 'picklist':
      return picklists.byId.get(raw) || String(raw)
    case 'lookup':
      return lookups.get(raw) || String(raw).slice(0, 8) + '…'
    case 'currency':
      return `$${Number(raw).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    case 'percent':
      return `${Number(raw)}%`
    case 'date':
      if (!raw) return '—'
      return new Date(raw + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    case 'datetime':
      if (!raw) return '—'
      return new Date(raw).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    case 'boolean':
      return raw ? 'Yes' : 'No'
    case 'email':
      return raw
    case 'phone':
      return raw
    case 'number':
      return raw != null ? Number(raw).toLocaleString() : '—'
    case 'textarea':
      return raw
    default:
      return String(raw)
  }
}

// ---------------------------------------------------------------------------
// FieldGroup widget — renders a 2-column grid of label/value pairs
// ---------------------------------------------------------------------------

function FieldGroupWidget({ widget, record, picklists, lookups }) {
  const fields = widget.widget_config?.fields || []
  if (fields.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
      {fields.map(f => {
        const raw = record[f.name]
        const display = formatFieldValue(raw, f, picklists, lookups)
        const isLink = f.type === 'email' || f.type === 'lookup'

        return (
          <div key={f.name} style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}>
            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {f.label}
            </span>
            <span style={{
              fontSize: 13,
              color: isLink ? '#1a5a8a' : C.textPrimary,
              fontWeight: 400,
              fontFamily: f.type === 'number' || f.type === 'currency' || f.type === 'percent' ? 'JetBrains Mono, monospace' : 'inherit',
              wordBreak: 'break-word',
            }}>
              {f.type === 'picklist' && raw ? <Badge s={display} /> : display}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RelatedList widget — renders a mini-table of child records
// ---------------------------------------------------------------------------

function RelatedListWidget({ widget, picklists }) {
  const config = widget.widget_config || {}
  const columns = config.columns || []
  const rows = widget._relatedData || []

  return (
    <div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
        {rows.length} record{rows.length !== 1 ? 's' : ''}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '16px 0', fontSize: 12, color: C.textMuted }}>No related records found.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {columns.map(col => (
                  <th key={col.name} style={{
                    textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600,
                    color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={row.id || ri} style={{ borderBottom: `1px solid ${C.border}` }}>
                  {columns.map(col => {
                    let val = row[col.name]
                    if (col.type === 'picklist' && val) val = picklists.byId.get(val) || val
                    if (col.type === 'date' && val) val = new Date(val + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    if (col.type === 'number' && val != null) val = Number(val).toLocaleString()
                    return (
                      <td key={col.name} style={{
                        padding: '10px 12px', fontSize: 12,
                        color: C.textPrimary,
                        fontFamily: col.type === 'number' ? 'JetBrains Mono, monospace' : 'inherit',
                      }}>
                        {col.type === 'picklist' && val ? <Badge s={val} /> : (val || '—')}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section — a collapsible card with a label and child widgets
// ---------------------------------------------------------------------------

function Section({ section, record, picklists, lookups }) {
  const [collapsed, setCollapsed] = useState(section.section_is_collapsed_by_default || false)

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      <div
        onClick={() => section.section_is_collapsible && setCollapsed(c => !c)}
        style={{
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: section.section_is_collapsible ? 'pointer' : 'default',
          borderBottom: collapsed ? 'none' : `1px solid ${C.border}`,
          background: '#fafbfd',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{section.section_label}</span>
        {section.section_is_collapsible && (
          <Icon path={collapsed ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} size={14} color={C.textMuted} />
        )}
      </div>
      {!collapsed && (
        <div>
          {section.widgets.map(w => {
            if (w.widget_type === 'field_group') {
              return <FieldGroupWidget key={w.id} widget={w} record={record} picklists={picklists} lookups={lookups} />
            }
            if (w.widget_type === 'related_list') {
              return (
                <div key={w.id} style={{ padding: '12px 18px' }}>
                  <RelatedListWidget widget={w} picklists={picklists} />
                </div>
              )
            }
            return null
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RecordDetail — main component
// ---------------------------------------------------------------------------

export default function RecordDetail({ tableName, recordId, onBack }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadRecordDetailData(tableName, recordId)
      .then(d => { if (!cancelled) setData(d) })
      .catch(err => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tableName, recordId])

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 13 }}>
        Loading record…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24 }}>
        <div style={{ color: '#b03a2e', fontSize: 14, fontWeight: 600 }}>Error loading record</div>
        <div style={{ color: C.textMuted, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', maxWidth: 560, textAlign: 'center' }}>
          {String(error.message || error)}
        </div>
        <button onClick={onBack} style={{ marginTop: 8, background: C.page, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 16px', fontSize: 12, color: C.textSecondary, cursor: 'pointer' }}>
          Back to List
        </button>
      </div>
    )
  }

  const { record, layout, sections, picklists, lookups } = data

  // Derive a display name from the record — look for common name fields
  const displayName = record.contact_first_name
    ? `${record.contact_first_name} ${record.contact_last_name || ''}`.trim()
    : record.property_name || record.opportunity_name || record.work_order_name || record.project_name || record.name || 'Record'

  // Derive a record number
  const recordNumber = record.contact_record_number || record.property_record_number
    || record.opportunity_record_number || record.work_order_record_number || record.project_record_number
    || record.id?.slice(0, 8).toUpperCase() || ''

  // Derive status — look for common status fields
  const statusRaw = record.contact_status || record.property_status || record.opportunity_status
    || record.work_order_status || record.project_status
  const statusLabel = statusRaw ? (picklists.byId.get(statusRaw) || statusRaw) : null

  // No layout configured — fall back to raw field dump
  if (!layout) {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 12, marginBottom: 16, padding: 0 }}>
          <Icon path="M15 19l-7-7 7-7" size={14} color={C.textMuted} /> Back to List
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, margin: '0 0 16px' }}>{displayName}</h1>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>No page layout configured for "{tableName}". Showing raw fields.</div>
          {Object.entries(record).filter(([k]) => !k.endsWith('_is_deleted') && k !== 'id').map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, gap: 16 }}>
              <span style={{ color: C.textMuted, fontSize: 12, flexShrink: 0 }}>{k}</span>
              <span style={{ color: C.textPrimary, fontSize: 12, textAlign: 'right', wordBreak: 'break-all' }}>{v != null ? String(v) : '—'}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
      {/* Back nav */}
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        color: C.textMuted, fontSize: 12, marginBottom: 16, padding: 0,
      }}>
        <Icon path="M15 19l-7-7 7-7" size={14} color={C.textMuted} /> Back to List
      </button>

      {/* Record header */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '20px 24px', marginBottom: 16,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
            {recordNumber}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, margin: '0 0 8px' }}>
            {displayName}
          </h1>
          {statusLabel && <Badge s={statusLabel} />}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            background: C.emerald, color: '#fff', border: 'none', borderRadius: 6,
            padding: '7px 16px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
            opacity: 0.5, pointerEvents: 'none',
          }}>Edit</button>
          <button style={{
            background: C.page, color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: 6,
            padding: '7px 16px', fontSize: 12.5, cursor: 'pointer',
            opacity: 0.5, pointerEvents: 'none',
          }}>Clone</button>
        </div>
      </div>

      {/* Timestamp bar */}
      <div style={{
        display: 'flex', gap: 20, marginBottom: 16, fontSize: 11, color: C.textMuted,
      }}>
        {record.created_at || record.contact_created_at || record.property_created_at || record.opportunity_created_at || record.work_order_created_at || record.project_created_at ? (
          <span>Created {new Date(
            record.created_at || record.contact_created_at || record.property_created_at ||
            record.opportunity_created_at || record.work_order_created_at || record.project_created_at
          ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        ) : null}
        {record.updated_at || record.contact_updated_at || record.property_updated_at || record.opportunity_updated_at || record.work_order_updated_at || record.project_updated_at ? (
          <span>Updated {new Date(
            record.updated_at || record.contact_updated_at || record.property_updated_at ||
            record.opportunity_updated_at || record.work_order_updated_at || record.project_updated_at
          ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        ) : null}
      </div>

      {/* Dynamic sections */}
      {sections.map(sec => (
        <Section key={sec.id} section={sec} record={record} picklists={picklists} lookups={lookups} />
      ))}
    </div>
  )
}
