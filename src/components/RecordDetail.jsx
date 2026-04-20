import { useState, useEffect, useCallback } from 'react'
import { C } from '../data/constants'
import { Badge, Icon } from './UI'
import { useToast } from './Toast'
import {
  loadRecordDetailData,
  saveRecord,
  insertRecord,
  deleteRecord,
  fetchTableMetadata,
  fetchPicklistOptions,
  fetchLookupOptions,
  fetchPageLayout,
  loadPicklists as loadAllPicklists,
  getCurrentUserId,
} from '../data/layoutService'

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
// Validation helpers
// ---------------------------------------------------------------------------

// Known object prefixes so humanize() can strip them for readable error messages
const FIELD_PREFIXES = [
  'contact_', 'property_', 'opportunity_', 'work_order_', 'project_',
  'building_', 'unit_', 'assessment_', 'vehicle_', 'va_', 'technician_',
  'product_item_', 'product_', 'equipment_', 'ia_', 'ppr_', 'user_',
]

function humanizeFieldName(col) {
  let name = col
  for (const p of FIELD_PREFIXES) {
    if (name.startsWith(p)) { name = name.slice(p.length); break }
  }
  if (name.endsWith('_id')) name = name.slice(0, -3)
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

// Build a { fieldName → layoutLabel } map from the loaded page layout sections.
function buildLabelMap(sections) {
  const out = {}
  for (const s of sections || []) {
    for (const w of s.widgets || []) {
      if (w.widget_type === 'field_group' && w.widget_config?.fields) {
        for (const f of w.widget_config.fields) {
          if (f?.name && f?.label) out[f.name] = f.label
        }
      }
    }
  }
  return out
}

// Return an array of human-readable labels for required fields that are
// missing from the provided values object. An empty string is treated as
// missing; `false` and `0` are valid values.
function findMissingRequired(requiredFields, values, labelMap) {
  const missing = []
  for (const f of requiredFields || []) {
    const v = values?.[f]
    if (v === null || v === undefined || v === '') {
      missing.push(labelMap[f] || humanizeFieldName(f))
    }
  }
  return missing
}

// ---------------------------------------------------------------------------
// Delete confirmation modal
// ---------------------------------------------------------------------------

function DeleteConfirmModal({ objectLabel, recordName, onConfirm, onCancel, busy }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: C.card, borderRadius: 10, padding: 26, width: 420,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon path="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"
              size={15} color="#b03a2e" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>
              Move to recycle bin?
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
              This will remove <strong style={{ color: C.textPrimary }}>{recordName || `this ${objectLabel.toLowerCase()}`}</strong> from all list views.
              It stays in the recycle bin until an administrator purges it.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              flex: 1,
              background: busy ? '#d0574a' : '#b03a2e',
              color: '#fff', border: 'none', borderRadius: 6,
              padding: '9px 0', fontSize: 13, fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.8 : 1,
            }}
          >
            {busy ? 'Deleting…' : 'Move to Recycle Bin'}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              flex: 1, background: C.page, color: C.textSecondary,
              border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '9px 0', fontSize: 13, cursor: busy ? 'wait' : 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EditField — renders the right input for a field type
// ---------------------------------------------------------------------------

function EditField({ field, value, onChange, picklistOpts, lookupOpts }) {
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

    case 'lookup': {
      const opts = lookupOpts || []
      if (opts.length > 0) {
        return (
          <select style={{ ...inputBase, cursor: 'pointer' }}
            value={v || ''} onChange={e => onChange(field.name, e.target.value || null)}>
            <option value="">— Select —</option>
            {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )
      }
      return <span style={{ fontSize: 13, color: C.textMuted, fontStyle: 'italic' }}>Read-only</span>
    }

    case 'datetime':
      return <span style={{ fontSize: 13, color: C.textMuted, fontStyle: 'italic' }}>Read-only</span>

    default:
      return <input type="text" style={inputBase} value={v} onChange={e => onChange(field.name, e.target.value)} />
  }
}

// ---------------------------------------------------------------------------
// FieldGroup widget — view mode OR edit mode
// ---------------------------------------------------------------------------

function FieldGroupWidget({ widget, record, picklists, lookups, editing, draft, onChange, allPicklistOpts, allLookupOpts }) {
  const fields = widget.widget_config?.fields || []
  if (fields.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
      {fields.map(f => {
        const raw = editing ? draft[f.name] : record[f.name]
        const display = formatFieldValue(raw, f, picklists, lookups)
        const isLink = f.type === 'email' || f.type === 'lookup'
        const hasLookupOpts = f.type === 'lookup' && allLookupOpts?.[f.name]?.length > 0
        const isEditable = editing && (f.type !== 'datetime') && (f.type !== 'lookup' || hasLookupOpts)

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
              <EditField field={f} value={draft[f.name]} onChange={onChange}
                picklistOpts={allPicklistOpts?.[f.name]} lookupOpts={allLookupOpts?.[f.name]} />
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
// RelatedListWidget — Salesforce-style card
//   • Collapsible header with icon, title, record count badge
//   • "New" button to add a child record (passes parent FK as prefill)
//   • First N rows shown as a clickable table
//   • "View All (N)" footer link when more rows exist
// ---------------------------------------------------------------------------

const RELATED_LIST_MAX_ROWS = 5

function RelatedListWidget({ widget, picklists, onNavigateToRecord, parentRecordId }) {
  const config = widget.widget_config || {}
  const columns = config.columns || []
  const allRows = widget._relatedData || []
  const shownRows = allRows.slice(0, RELATED_LIST_MAX_ROWS)
  const hiddenCount = Math.max(0, allRows.length - shownRows.length)
  const [collapsed, setCollapsed] = useState(false)

  const childTable = config.table
  const fk = config.fk
  const canNavigate = !!onNavigateToRecord && !!childTable

  const handleRowClick = (row) => {
    if (!canNavigate || !row?.id) return
    onNavigateToRecord({ table: childTable, id: row.id, mode: 'view' })
  }

  const handleNewClick = (e) => {
    e.stopPropagation()
    if (!canNavigate) return
    const prefillObj = fk && parentRecordId ? { [fk]: parentRecordId } : {}
    onNavigateToRecord({ table: childTable, id: null, mode: 'create', prefill: prefillObj })
  }

  const title = widget.widget_label || config.label || 'Related'

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px 10px 16px',
          background: '#fafbfd',
          borderBottom: collapsed ? 'none' : `1px solid ${C.border}`,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 4,
            background: '#e8f3fb', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon path="M4 6h16M4 12h16M4 18h7" size={12} color="#1a5a8a" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </span>
          <span style={{
            background: C.page, color: C.textSecondary,
            fontSize: 11, fontWeight: 600,
            padding: '1px 8px', borderRadius: 10,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {allRows.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {canNavigate && (
            <button
              onClick={handleNewClick}
              style={{
                background: C.card, color: C.textSecondary,
                border: `1px solid ${C.border}`, borderRadius: 5,
                padding: '4px 10px', fontSize: 11.5, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontWeight: 500,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#eef2f7'; e.currentTarget.style.borderColor = C.borderDark }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.card; e.currentTarget.style.borderColor = C.border }}
            >
              <Icon path="M12 5v14M5 12h14" size={11} color={C.textSecondary} />
              New
            </button>
          )}
          <Icon path={collapsed ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} size={12} color={C.textMuted} />
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <>
          {allRows.length === 0 ? (
            <div style={{ padding: '22px 16px', fontSize: 12, color: C.textMuted, textAlign: 'center' }}>
              No {title.toLowerCase()} related to this record.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {columns.map((col) => (
                      <th key={col.name} style={{
                        textAlign: 'left', padding: '8px 14px',
                        fontSize: 10, fontWeight: 600, color: C.textMuted,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shownRows.map((row, ri) => (
                    <tr
                      key={row.id || ri}
                      onClick={() => handleRowClick(row)}
                      onDoubleClick={() => handleRowClick(row)}
                      style={{
                        borderBottom: ri < shownRows.length - 1 ? `1px solid ${C.border}` : 'none',
                        cursor: canNavigate ? 'pointer' : 'default',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { if (canNavigate) e.currentTarget.style.background = '#f7f9fc' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      {columns.map((col, ci) => {
                        let val = row[col.name]
                        if (col.type === 'picklist' && val) val = picklists.byId.get(val) || val
                        if (col.type === 'date' && val) val = new Date(val + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        if (col.type === 'number' && val != null) val = Number(val).toLocaleString()
                        const isFirstCol = ci === 0
                        return (
                          <td key={col.name} style={{
                            padding: '10px 14px',
                            fontSize: 12.5,
                            color: isFirstCol && canNavigate ? '#1a5a8a' : C.textPrimary,
                            fontWeight: isFirstCol ? 500 : 400,
                            fontFamily: col.type === 'number' ? 'JetBrains Mono, monospace' : 'inherit',
                            whiteSpace: 'nowrap', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {col.type === 'picklist' && val ? <Badge s={val} /> : (val != null && val !== '' ? val : '—')}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hiddenCount > 0 && (
            <div style={{
              padding: '8px 14px',
              borderTop: `1px solid ${C.border}`,
              background: '#fafbfd',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 11.5,
            }}>
              <span style={{ color: C.textMuted }}>
                Showing {shownRows.length} of {allRows.length}
              </span>
              <span
                title="View All list view coming soon"
                style={{
                  color: C.textMuted, fontStyle: 'italic',
                  cursor: 'not-allowed',
                }}
              >
                View All ({allRows.length}) →
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

function Section({ section, record, picklists, lookups, editing, draft, onChange, allPicklistOpts, allLookupOpts, tableName }) {
  const [collapsed, setCollapsed] = useState(section.section_is_collapsed_by_default || false)
  // Only render field_group widgets inside a section. Related lists are
  // rendered as their own standalone cards outside sections.
  const fieldGroupWidgets = (section.widgets || []).filter(w => w.widget_type === 'field_group')
  if (fieldGroupWidgets.length === 0) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
      <div onClick={() => section.section_is_collapsible && setCollapsed(c => !c)}
        style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: section.section_is_collapsible ? 'pointer' : 'default', borderBottom: collapsed ? 'none' : `1px solid ${C.border}`, background: '#fafbfd' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{section.section_label}</span>
        {section.section_is_collapsible && <Icon path={collapsed ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} size={14} color={C.textMuted} />}
      </div>
      {!collapsed && fieldGroupWidgets.map(w => (
        <FieldGroupWidget key={w.id} widget={w} record={record} picklists={picklists} lookups={lookups}
          editing={editing} draft={draft} onChange={onChange} allPicklistOpts={allPicklistOpts} allLookupOpts={allLookupOpts} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RecordDetail — main component
// ---------------------------------------------------------------------------

export default function RecordDetail({ tableName, recordId, onBack, mode = 'view', onRecordCreated, onNavigateToRecord, prefill }) {
  const isCreate = mode === 'create'
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(isCreate)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [allPicklistOpts, setAllPicklistOpts] = useState({})
  const [allLookupOpts, setAllLookupOpts] = useState({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // When non-null, we are cloning the current record: same table, insert path,
  // draft pre-populated from the source.
  const [cloneSource, setCloneSource] = useState(null)
  const isInsertMode = isCreate || cloneSource !== null

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)

    if (isCreate) {
      // Create mode: fetch layout + picklists only, no record
      Promise.all([fetchPageLayout(tableName), loadAllPicklists()])
        .then(([layoutData, picklists]) => {
          if (cancelled) return
          setData({
            record: {},
            layout: layoutData?.layout || null,
            sections: layoutData?.sections || [],
            picklists,
            lookups: new Map(),
          })
          setDraft(prefill ? { ...prefill } : {})
          setEditing(true)
          // Pre-load picklist + lookup options
          if (layoutData?.sections) {
            loadAllEditOpts(layoutData.sections)
          }
        })
        .catch(err => { if (!cancelled) setError(err) })
        .finally(() => { if (!cancelled) setLoading(false) })
    } else {
      // View mode: fetch everything
      setEditing(false)
      loadRecordDetailData(tableName, recordId)
        .then(d => { if (!cancelled) setData(d) })
        .catch(err => { if (!cancelled) setError(err) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }
    return () => { cancelled = true }
  }, [tableName, recordId, isCreate])

  const loadAllEditOpts = useCallback(async (sections) => {
    const pickFields = []
    const lookupFields = []
    for (const s of sections) for (const w of s.widgets)
      if (w.widget_type === 'field_group' && w.widget_config?.fields)
        for (const f of w.widget_config.fields) {
          if (f.type === 'picklist') pickFields.push(f.name)
          if (f.type === 'lookup' && f.lookup_table && f.lookup_field)
            lookupFields.push({ name: f.name, table: f.lookup_table, field: f.lookup_field })
        }

    // Fetch picklist options
    if (pickFields.length) {
      const opts = {}
      await Promise.all(pickFields.map(async fn => {
        try { opts[fn] = await fetchPicklistOptions(tableName, fn) } catch { opts[fn] = [] }
      }))
      setAllPicklistOpts(opts)
    }

    // Fetch lookup options
    if (lookupFields.length) {
      const opts = {}
      await Promise.all(lookupFields.map(async lf => {
        try { opts[lf.name] = await fetchLookupOptions(lf.table, lf.field) } catch { opts[lf.name] = [] }
      }))
      setAllLookupOpts(opts)
    }
  }, [tableName])

  const startEditing = () => {
    if (!data?.record) return
    setDraft({ ...data.record }); setEditing(true)
    if (data.sections) loadAllEditOpts(data.sections)
  }
  const cancelEditing = () => {
    if (isCreate) { onBack(); return }
    if (cloneSource) { setCloneSource(null); setEditing(false); setDraft({}); return }
    setEditing(false); setDraft({})
  }
  const handleFieldChange = (name, value) => setDraft(prev => ({ ...prev, [name]: value }))

  // Clone: strip system fields, append " (Copy)" to visible name fields,
  // enter insert-mode so Save inserts a brand-new record in the same table.
  const handleClone = useCallback(() => {
    if (!data?.record) return
    const seed = { ...data.record }
    for (const k of Object.keys(seed)) {
      if (
        k === 'id' ||
        k === 'is_deleted' ||
        k === 'created_at' || k === 'updated_at' ||
        k === 'created_by' || k === 'updated_by' ||
        k.endsWith('_created_at') || k.endsWith('_created_by') ||
        k.endsWith('_updated_at') || k.endsWith('_updated_by') ||
        k.endsWith('_is_deleted') ||
        k.endsWith('_record_number')
      ) delete seed[k]
    }
    // Make it obvious this is a copy by default
    for (const k of Object.keys(seed)) {
      if (k.endsWith('_name') && typeof seed[k] === 'string' && seed[k]) {
        seed[k] = `${seed[k]} (Copy)`
      }
    }
    setCloneSource({ sourceId: recordId, sourceName: data.record?.contact_name
      || data.record?.property_name || data.record?.opportunity_name
      || data.record?.work_order_name || data.record?.project_name
      || data.record?.name || 'record' })
    setDraft(seed)
    if (data.sections) loadAllEditOpts(data.sections)
    setEditing(true)
  }, [data, recordId, loadAllEditOpts])

  const handleSave = async () => {
    setSaving(true)

    if (isInsertMode) {
      // INSERT path — runs for true create and for clone
      try {
        const userId = await getCurrentUserId()
        const fields = { ...draft }

        // Auto-fill system fields based on table naming conventions
        const prefixes = ['contact','property','opportunity','work_order','project','building','unit',
                          'assessment','vehicle','technician','product','equipment']
        for (const p of prefixes) {
          if (tableName.startsWith(p) || tableName === p + 's' || tableName === p + 'ies') {
            if (!fields[`${p}_record_number`]) fields[`${p}_record_number`] = 'NEW'
            if (!fields[`${p}_owner`]) fields[`${p}_owner`] = userId
            if (!fields[`${p}_created_by`]) fields[`${p}_created_by`] = userId
            // Auto-derive name for contacts
            if (p === 'contact' && !fields.contact_name && fields.contact_first_name) {
              fields.contact_name = `${fields.contact_first_name} ${fields.contact_last_name || ''}`.trim()
            }
            break
          }
        }
        // Special cases for tables with different column naming
        if (tableName === 'incentive_applications') {
          if (!fields.ia_record_number) fields.ia_record_number = 'NEW'
          if (!fields.ia_owner) fields.ia_owner = userId
          if (!fields.ia_created_by) fields.ia_created_by = userId
        }
        if (tableName === 'project_payment_requests') {
          if (!fields.ppr_record_number) fields.ppr_record_number = 'NEW'
          if (!fields.ppr_owner) fields.ppr_owner = userId
          if (!fields.ppr_created_by) fields.ppr_created_by = userId
        }
        if (tableName === 'partner_organizations') {
          if (!fields.owner_id) fields.owner_id = userId
          if (!fields.created_by) fields.created_by = userId
          if (!fields.record_type) fields.record_type = 'Partner Organization'
        }

        // Strip empty string values (convert to null)
        for (const [k, v] of Object.entries(fields)) {
          if (v === '') fields[k] = null
        }

        // Validate required fields *after* auto-fill so we don't flag
        // system fields the user never saw.
        const meta = await fetchTableMetadata(tableName)
        const labelMap = buildLabelMap(data?.sections)
        const missing = findMissingRequired(meta.required_fields, fields, labelMap)
        if (missing.length) {
          toast.error(
            missing.length === 1
              ? `Required field missing: ${missing[0]}`
              : `Required fields missing:\n• ${missing.join('\n• ')}`
          )
          setSaving(false)
          return
        }

        const created = await insertRecord(tableName, fields)
        toast.success(cloneSource ? 'Clone created' : 'Record created')

        if (onRecordCreated) {
          onRecordCreated({ table: tableName, id: created.id })
        } else if (onNavigateToRecord) {
          onNavigateToRecord({ table: tableName, id: created.id })
        } else {
          onBack()
        }
      } catch (err) {
        toast.error(`${cloneSource ? 'Clone' : 'Create'} failed — ${err.message || String(err)}`)
      } finally {
        setSaving(false)
      }
      return
    }

    // UPDATE mode: compute diff and save only changed fields
    const changes = {}
    for (const [k, v] of Object.entries(draft)) if (v !== data.record[k]) changes[k] = v
    for (const sys of ['id','created_at','updated_at']) delete changes[sys]
    for (const k of Object.keys(changes)) {
      if (k.endsWith('_created_at') || k.endsWith('_created_by') || k.endsWith('_updated_at') || k.endsWith('_updated_by') || k.endsWith('_is_deleted')) delete changes[k]
    }
    if (!Object.keys(changes).length) { setEditing(false); setSaving(false); return }

    // Normalise empty strings to null before validation + save
    for (const [k, v] of Object.entries(changes)) {
      if (v === '') changes[k] = null
    }

    try {
      // Validate against the merged view — existing record with pending changes applied
      const meta = await fetchTableMetadata(tableName)
      const labelMap = buildLabelMap(data?.sections)
      const merged = { ...data.record, ...changes }
      const missing = findMissingRequired(meta.required_fields, merged, labelMap)
      if (missing.length) {
        toast.error(
          missing.length === 1
            ? `Required field missing: ${missing[0]}`
            : `Required fields missing:\n• ${missing.join('\n• ')}`
        )
        setSaving(false)
        return
      }

      const updated = await saveRecord(tableName, recordId, changes)
      setData(prev => ({ ...prev, record: updated }))
      setEditing(false); setDraft({})
      toast.success('Changes saved')
    } catch (err) {
      toast.error(`Save failed — ${err.message || String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteRecord(tableName, recordId)
      toast.success('Moved to recycle bin')
      setShowDeleteConfirm(false)
      onBack()
    } catch (err) {
      toast.error(`Delete failed — ${err.message || String(err)}`)
      setDeleting(false)
    }
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

  const objectLabel = TABLE_META[tableName]?.label || tableName
  const displayName = isCreate
    ? `New ${objectLabel.replace(/s$/, '')}`
    : (record.contact_first_name
        ? `${record.contact_first_name} ${record.contact_last_name || ''}`.trim()
        : record.property_name || record.opportunity_name || record.work_order_name || record.project_name
          || record.building_name || record.unit_name || record.vehicle_name || record.technician_name
          || record.product_name || record.equipment_name || record.name || 'Record')

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
            <button
              onClick={handleClone}
              title="Create a new record seeded from this one"
              style={{ background: C.page, color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 16px', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#eef2f7' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.page }}
            >
              <Icon path="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" size={13} color={C.textSecondary} />
              Clone
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              title="Move to recycle bin"
              style={{
                background: C.page, color: '#b03a2e',
                border: `1px solid ${C.border}`, borderRadius: 6,
                padding: '7px 12px', fontSize: 12.5, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fca5a5' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.page; e.currentTarget.style.borderColor = C.border }}
            >
              <Icon path="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" size={13} color="#b03a2e" />
              Delete
            </button>
          </>)}
        </div>
      </div>

      {/* Editing / cloning indicator */}
      {editing && cloneSource && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon path="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" size={14} color="#1e40af" />
          Cloning <strong>{cloneSource.sourceName}</strong> — modify the copy and Save to create a new record.
        </div>
      )}
      {editing && !cloneSource && (
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

      {/* Sections — field groups only */}
      {sections.map(sec => (
        <Section key={sec.id} section={sec} record={record} picklists={picklists} lookups={lookups}
          editing={editing} draft={draft} onChange={handleFieldChange}
          allPicklistOpts={allPicklistOpts} allLookupOpts={allLookupOpts} tableName={tableName} />
      ))}

      {/* Related lists — standalone Salesforce-style cards, in page order */}
      {!isInsertMode && sections
        .flatMap(sec => (sec.widgets || []).filter(w => w.widget_type === 'related_list'))
        .map(w => (
          <RelatedListWidget
            key={w.id}
            widget={w}
            picklists={picklists}
            onNavigateToRecord={onNavigateToRecord}
            parentRecordId={recordId}
          />
        ))}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          objectLabel={objectLabel}
          recordName={displayName}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
