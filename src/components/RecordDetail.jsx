import { useState, useEffect, useCallback } from 'react'
import { C } from '../data/constants'
import { Badge, Icon } from './UI'
import { loadRecordDetailData, saveRecord, fetchPicklistOptions } from '../data/layoutService'

// ---------------------------------------------------------------------------
// Field value formatter
// ---------------------------------------------------------------------------

function formatFieldValue(raw, fieldDef, picklists, lookups) {
  if (raw === null || raw === undefined) return '—'
  switch (fieldDef.type) {
    case 'picklist':   return picklists.byId.get(raw) || String(raw)
    case 'lookup':     return lookups.get(raw) || String(raw).slice(0, 8) + '…'
    case 'currency':   return `$${Number(raw).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    case 'percent':    return `${Number(raw)}%`
    case 'date':       return raw ? new Date(raw + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
    case 'datetime':   return raw ? new Date(raw).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
    case 'boolean':    return raw ? 'Yes' : 'No'
    case 'number':     return raw != null ? Number(raw).toLocaleString() : '—'
    default:           return String(raw)
  }
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const inputBase = {
  width: '100%', padding: '7px 10px', fontSize: 13, border: `1px solid ${C.border}`,
  borderRadius: 5, outline: 'none', fontFamily: 'Inter, sans-serif', color: C.textPrimary,
  background: '#fff', boxSizing: 'border-box',
}
const monoInput = { ...inputBase, fontFamily: 'JetBrains Mono, monospace' }

// ---------------------------------------------------------------------------
// Breadcrumb — Salesforce-style hierarchy path
// ---------------------------------------------------------------------------

const TABLE_META = {
  contacts:                  { module: 'Outreach',       label: 'Contacts',            parents: ['property_owner_id', 'property_management_company_id'] },
  properties:                { module: 'Outreach',       label: 'Properties',           parents: ['property_owner_id'] },
  buildings:                 { module: 'Outreach',       label: 'Buildings',            parents: ['property_id'] },
  units:                     { module: 'Outreach',       label: 'Units',                parents: ['building_id', 'property_id'] },
  opportunities:             { module: 'Outreach',       label: 'Opportunities',        parents: ['property_id'] },
  property_programs:         { module: 'Outreach',       label: 'Enrollment',           parents: ['property_id'] },
  work_orders:               { module: 'Field',          label: 'Work Orders',          parents: ['project_id', 'property_id', 'building_id'] },
  projects:                  { module: 'Field',          label: 'Projects',             parents: ['property_id'] },
  assessments:               { module: 'Qualification',  label: 'Assessments',          parents: ['property_id', 'building_id'] },
  incentive_applications:    { module: 'Qualification',  label: 'Applications',         parents: ['property_id'] },
  efr_reports:               { module: 'Qualification',  label: 'EFR Reports',          parents: ['property_id'] },
  project_payment_requests:  { module: 'Incentives',     label: 'Payment Requests',     parents: ['project_id', 'property_id'] },
  payment_receipts:          { module: 'Incentives',     label: 'Payment Receipts',     parents: [] },
  products:                  { module: 'Stock',          label: 'Product Catalog',      parents: [] },
  product_items:             { module: 'Stock',          label: 'Inventory On-Hand',    parents: [] },
  materials_requests:        { module: 'Stock',          label: 'Materials Requests',   parents: ['project_id'] },
  equipment:                 { module: 'Stock',          label: 'Equipment',            parents: [] },
  vehicles:                  { module: 'Fleet',          label: 'Vehicles',             parents: [] },
  vehicle_activities:        { module: 'Fleet',          label: 'Activities',           parents: ['vehicle_id'] },
  equipment_containers:      { module: 'Fleet',          label: 'Vehicle Kits',         parents: ['issued_to_vehicle_id'] },
  users:                     { module: 'People',         label: 'Users',                parents: [] },
  technicians:               { module: 'People',         label: 'Technicians',          parents: [] },
  certifications:            { module: 'People',         label: 'Certifications',       parents: ['technician_id'] },
  time_sheets:               { module: 'People',         label: 'Time Sheets',          parents: ['technician_id'] },
  programs:                  { module: 'Admin',          label: 'Programs',             parents: [] },
  work_types:                { module: 'Admin',          label: 'Work Types',           parents: [] },
  email_templates:           { module: 'Admin',          label: 'Email Templates',      parents: [] },
  document_templates:        { module: 'Admin',          label: 'Document Templates',   parents: [] },
  automation_rules:          { module: 'Admin',          label: 'Automation Rules',     parents: [] },
  validation_rules:          { module: 'Admin',          label: 'Validation Rules',     parents: [] },
  roles:                     { module: 'Admin',          label: 'Roles',                parents: [] },
  picklist_values:           { module: 'Admin',          label: 'Picklist Values',      parents: [] },
  portal_users:              { module: 'Portal',         label: 'Portal Users',         parents: ['property_owner_id', 'partner_org_id'] },
  partner_organizations:     { module: 'Portal',         label: 'Partners',             parents: [] },
}

function Breadcrumbs({ tableName, record, lookups, onBack }) {
  const meta = TABLE_META[tableName] || { module: '—', label: tableName, parents: [] }

  // Build parent chain from resolved lookups
  const parentCrumbs = []
  for (const fk of meta.parents) {
    const val = record[fk]
    if (val && lookups.has(val)) {
      parentCrumbs.push(lookups.get(val))
    }
  }

  const sep = <span style={{ color: C.textMuted, margin: '0 6px', fontSize: 10 }}>/</span>

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, marginBottom: 14 }}>
      <span style={{ fontSize: 12, color: C.textMuted }}>{meta.module}</span>
      {sep}
      <button onClick={onBack} style={{ fontSize: 12, color: '#1a5a8a', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 }}>
        {meta.label}
      </button>
      {parentCrumbs.map((name, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
          {sep}
          <span style={{ fontSize: 12, color: C.textSecondary }}>{name}</span>
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EditField — renders the right input for a field type
// ---------------------------------------------------------------------------

function EditField({ field, value, onChange, picklistOpts }) {
  const v = value ?? ''

  switch (field.type) {
    case 'text': case 'phone': case 'email':
      return <input type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
        style={inputBase} value={v} onChange={e => onChange(field.name, e.target.value)} />

    case 'number': case 'currency': case 'percent':
      return <input type="number" step="any" style={monoInput}
        value={v} onChange={e => onChange(field.name, e.target.value === '' ? null : Number(e.target.value))} />

    case 'date':
      return <input type="date" style={monoInput}
        value={v || ''} onChange={e => onChange(field.name, e.target.value || null)} />

    case 'textarea':
      return <textarea style={{ ...inputBase, minHeight: 64, resize: 'vertical' }}
        value={v} onChange={e => onChange(field.name, e.target.value)} />

    case 'boolean':
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.textPrimary }}>
          <input type="checkbox" checked={!!value} onChange={e => onChange(field.name, e.target.checked)}
            style={{ width: 16, height: 16, accentColor: C.emerald }} />
          {value ? 'Yes' : 'No'}
        </label>
      )

    case 'picklist': {
      const opts = picklistOpts || []
      return (
        <select style={{ ...inputBase, cursor: 'pointer' }}
          value={v || ''} onChange={e => onChange(field.name, e.target.value || null)}>
          <option value="">— Select —</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }

    case 'lookup': case 'datetime':
      return <span style={{ fontSize: 13, color: C.textMuted, fontStyle: 'italic' }}>Read-only</span>

    default:
      return <input type="text" style={inputBase} value={v} onChange={e => onChange(field.name, e.target.value)} />
  }
}

// ---------------------------------------------------------------------------
// FieldGroup widget — view mode OR edit mode
// ---------------------------------------------------------------------------

function FieldGroupWidget({ widget, record, picklists, lookups, editing, draft, onChange, allPicklistOpts }) {
  const fields = widget.widget_config?.fields || []
  if (fields.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
      {fields.map(f => {
        const raw = editing ? draft[f.name] : record[f.name]
        const display = formatFieldValue(raw, f, picklists, lookups)
        const isLink = f.type === 'email' || f.type === 'lookup'
        const isEditable = editing && f.type !== 'lookup' && f.type !== 'datetime'

        return (
          <div key={f.name} style={{
            padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', flexDirection: 'column', gap: 4,
            background: isEditable ? '#fafffe' : 'transparent',
          }}>
            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {f.label}
            </span>
            {isEditable ? (
              <EditField field={f} value={draft[f.name]} onChange={onChange} picklistOpts={allPicklistOpts?.[f.name]} />
            ) : (
              <span style={{
                fontSize: 13,
                color: isLink ? '#1a5a8a' : C.textPrimary,
                fontWeight: 400,
                fontFamily: f.type === 'number' || f.type === 'currency' || f.type === 'percent' ? 'JetBrains Mono, monospace' : 'inherit',
                wordBreak: 'break-word',
              }}>
                {f.type === 'picklist' && raw ? <Badge s={display} /> : display}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RelatedList widget (read-only)
// ---------------------------------------------------------------------------

function RelatedListWidget({ widget, picklists }) {
  const config = widget.widget_config || {}
  const columns = config.columns || []
  const rows = widget._relatedData || []

  return (
    <div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>{rows.length} record{rows.length !== 1 ? 's' : ''}</div>
      {rows.length === 0 ? (
        <div style={{ padding: '16px 0', fontSize: 12, color: C.textMuted }}>No related records found.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {columns.map(col => (
                <th key={col.name} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{col.label}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={row.id || ri} style={{ borderBottom: `1px solid ${C.border}` }}>
                  {columns.map(col => {
                    let val = row[col.name]
                    if (col.type === 'picklist' && val) val = picklists.byId.get(val) || val
                    if (col.type === 'date' && val) val = new Date(val + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    if (col.type === 'number' && val != null) val = Number(val).toLocaleString()
                    return (
                      <td key={col.name} style={{ padding: '10px 12px', fontSize: 12, color: C.textPrimary, fontFamily: col.type === 'number' ? 'JetBrains Mono, monospace' : 'inherit' }}>
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
// Section
// ---------------------------------------------------------------------------

function Section({ section, record, picklists, lookups, editing, draft, onChange, allPicklistOpts, tableName }) {
  const [collapsed, setCollapsed] = useState(section.section_is_collapsed_by_default || false)
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
      <div onClick={() => section.section_is_collapsible && setCollapsed(c => !c)}
        style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: section.section_is_collapsible ? 'pointer' : 'default', borderBottom: collapsed ? 'none' : `1px solid ${C.border}`, background: '#fafbfd' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{section.section_label}</span>
        {section.section_is_collapsible && <Icon path={collapsed ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} size={14} color={C.textMuted} />}
      </div>
      {!collapsed && section.widgets.map(w => {
        if (w.widget_type === 'field_group')
          return <FieldGroupWidget key={w.id} widget={w} record={record} picklists={picklists} lookups={lookups}
            editing={editing} draft={draft} onChange={onChange} allPicklistOpts={allPicklistOpts} />
        if (w.widget_type === 'related_list')
          return <div key={w.id} style={{ padding: '12px 18px' }}><RelatedListWidget widget={w} picklists={picklists} /></div>
        return null
      })}
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
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [allPicklistOpts, setAllPicklistOpts] = useState({})

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null); setEditing(false)
    loadRecordDetailData(tableName, recordId)
      .then(d => { if (!cancelled) setData(d) })
      .catch(err => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tableName, recordId])

  const loadPicklistOpts = useCallback(async (sections) => {
    const fields = []
    for (const s of sections) for (const w of s.widgets)
      if (w.widget_type === 'field_group' && w.widget_config?.fields)
        for (const f of w.widget_config.fields) if (f.type === 'picklist') fields.push(f.name)
    if (!fields.length) return
    const opts = {}
    await Promise.all(fields.map(async fn => {
      try { opts[fn] = await fetchPicklistOptions(tableName, fn) } catch { opts[fn] = [] }
    }))
    setAllPicklistOpts(opts)
  }, [tableName])

  const startEditing = () => {
    if (!data?.record) return
    setDraft({ ...data.record }); setSaveError(null); setEditing(true)
    if (data.sections) loadPicklistOpts(data.sections)
  }
  const cancelEditing = () => { setEditing(false); setDraft({}); setSaveError(null) }
  const handleFieldChange = (name, value) => setDraft(prev => ({ ...prev, [name]: value }))

  const handleSave = async () => {
    setSaving(true); setSaveError(null)
    const changes = {}
    for (const [k, v] of Object.entries(draft)) if (v !== data.record[k]) changes[k] = v
    for (const sys of ['id','created_at','updated_at']) delete changes[sys]
    // Also strip any _is_deleted, _created_at, _created_by, _updated_at, _updated_by system columns
    for (const k of Object.keys(changes)) {
      if (k.endsWith('_created_at') || k.endsWith('_created_by') || k.endsWith('_updated_at') || k.endsWith('_updated_by') || k.endsWith('_is_deleted')) delete changes[k]
    }
    if (!Object.keys(changes).length) { setEditing(false); setSaving(false); return }
    try {
      const updated = await saveRecord(tableName, recordId, changes)
      setData(prev => ({ ...prev, record: updated }))
      setEditing(false); setDraft({})
    } catch (err) { setSaveError(err.message || String(err)) }
    finally { setSaving(false) }
  }

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 13 }}>Loading record…</div>
  if (error) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24 }}>
      <div style={{ color: '#b03a2e', fontSize: 14, fontWeight: 600 }}>Error loading record</div>
      <div style={{ color: C.textMuted, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', maxWidth: 560, textAlign: 'center' }}>{String(error.message || error)}</div>
      <button onClick={onBack} style={{ marginTop: 8, background: C.page, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 16px', fontSize: 12, color: C.textSecondary, cursor: 'pointer' }}>Back to List</button>
    </div>
  )

  const { record, layout, sections, picklists, lookups } = data

  const displayName = record.contact_first_name
    ? `${record.contact_first_name} ${record.contact_last_name || ''}`.trim()
    : record.property_name || record.opportunity_name || record.work_order_name || record.project_name
      || record.building_name || record.unit_name || record.vehicle_name || record.technician_name
      || record.product_name || record.equipment_name || record.name || 'Record'

  const recordNumber = record.contact_record_number || record.property_record_number
    || record.opportunity_record_number || record.work_order_record_number || record.project_record_number
    || record.building_record_number || record.vehicle_record_number || record.technician_record_number
    || record.product_record_number || record.equipment_record_number
    || record.id?.slice(0, 8).toUpperCase() || ''

  const statusRaw = record.contact_status || record.property_status || record.opportunity_status
    || record.work_order_status || record.project_status || record.building_status
    || record.vehicle_status || record.technician_status
  const statusLabel = statusRaw ? (picklists.byId.get(statusRaw) || statusRaw) : null

  if (!layout) return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
      <Breadcrumbs tableName={tableName} record={record} lookups={lookups} onBack={onBack} />
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

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
      <Breadcrumbs tableName={tableName} record={record} lookups={lookups} onBack={onBack} />

      {/* Header */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '20px 24px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{recordNumber}</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, margin: '0 0 8px' }}>{displayName}</h1>
          {statusLabel && <Badge s={statusLabel} />}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {editing ? (<>
            <button onClick={handleSave} disabled={saving} style={{ background: C.emerald, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12.5, fontWeight: 500, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon path="M5 13l4 4L19 7" size={13} color="#fff" />{saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={cancelEditing} disabled={saving} style={{ background: C.page, color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 16px', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
          </>) : (<>
            <button onClick={startEditing} style={{ background: C.emerald, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>Edit</button>
            <button style={{ background: C.page, color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 16px', fontSize: 12.5, cursor: 'pointer', opacity: 0.5, pointerEvents: 'none' }}>Clone</button>
          </>)}
        </div>
      </div>

      {/* Save error */}
      {saveError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#b03a2e', marginBottom: 3 }}>Save failed</div>
          <div style={{ fontSize: 12, color: '#7f1d1d' }}>{saveError}</div>
        </div>
      )}

      {/* Editing indicator */}
      {editing && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon path="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={14} color="#166534" />
          Editing mode — modify fields and click Save.
        </div>
      )}

      {/* Timestamps (view mode only) */}
      {!editing && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 16, fontSize: 11, color: C.textMuted }}>
          {(record.created_at || record.contact_created_at || record.property_created_at || record.opportunity_created_at || record.work_order_created_at || record.project_created_at) && (
            <span>Created {new Date(record.created_at || record.contact_created_at || record.property_created_at || record.opportunity_created_at || record.work_order_created_at || record.project_created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          )}
        </div>
      )}

      {/* Sections */}
      {sections.map(sec => (
        <Section key={sec.id} section={sec} record={record} picklists={picklists} lookups={lookups}
          editing={editing} draft={draft} onChange={handleFieldChange} allPicklistOpts={allPicklistOpts} tableName={tableName} />
      ))}
    </div>
  )
}
