import { useState } from 'react'
import { C } from '../../data/constants'
import { Icon } from '../../components/UI'
import RecordDetail from '../../components/RecordDetail'
import SetupHome from './SetupHome'
import ObjectManager from './ObjectManager'
import ObjectDetail from './ObjectDetail'

// ---------------------------------------------------------------------------
// AdminModule — Salesforce-style Setup shell.
//
// Top bar: breadcrumb (Setup / [current tab or record])
// Primary tabs: Setup Home | Object Manager
//   - Setup Home:  left tree nav + content pane (renders list of whatever node is selected)
//   - Object Manager: searchable list of 89 tables → click one → ObjectDetail with sub-tabs
// Both tabs can open individual record detail pages (contacts, templates, etc.)
// ---------------------------------------------------------------------------

export default function AdminModule() {
  const [tab, setTab] = useState('setup')               // 'setup' | 'objects'
  const [selectedObject, setSelectedObject] = useState(null)   // catalog entry from ObjectManager
  const [selectedRecord, setSelectedRecord] = useState(null)   // { table, id, name?, mode?, prefill? }

  const openObjectManager = () => {
    setTab('objects')
    setSelectedObject(null)
    setSelectedRecord(null)
  }

  const openRecord = (payload) => {
    // Called when a child list view wants to open a record detail page.
    // `payload` shape: { table, id, name?, mode?, prefill? }
    setSelectedRecord(payload)
  }

  const closeRecord = () => setSelectedRecord(null)

  // Breadcrumb trail — depends on current view
  const crumbs = buildCrumbs(tab, selectedObject, selectedRecord)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ─── Top bar — breadcrumb + reports ─────────────────────────── */}
      <div style={{
        height: 54, background: C.card, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1
            return (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <span style={{ color: C.textMuted }}>/</span>}
                <span
                  onClick={crumb.onClick}
                  style={{
                    color: isLast ? C.textPrimary : C.textMuted,
                    fontWeight: isLast ? 500 : 400,
                    cursor: crumb.onClick ? 'pointer' : 'default',
                  }}
                  onMouseEnter={e => { if (crumb.onClick && !isLast) e.currentTarget.style.color = C.emerald }}
                  onMouseLeave={e => { if (crumb.onClick && !isLast) e.currentTarget.style.color = C.textMuted }}
                >
                  {crumb.label}
                </span>
              </span>
            )
          })}
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: C.page, border: `1px solid ${C.border}`, borderRadius: 6,
          padding: '6px 12px', fontSize: 12.5, color: C.textSecondary, cursor: 'pointer', fontWeight: 500,
        }}>
          <Icon path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" size={13} color={C.textSecondary}/>
          Reports
        </button>
      </div>

      {/* ─── Primary tab bar — Setup Home / Object Manager ──────────── */}
      <div style={{
        background: C.card, borderBottom: `1px solid ${C.border}`,
        padding: '0 24px', display: 'flex', alignItems: 'center', flexShrink: 0,
      }}>
        <TabButton
          label="Setup Home"
          active={tab === 'setup' && !selectedRecord}
          onClick={() => { setTab('setup'); setSelectedObject(null); setSelectedRecord(null) }}
        />
        <TabButton
          label="Object Manager"
          active={tab === 'objects' && !selectedRecord}
          onClick={openObjectManager}
        />
      </div>

      {/* ─── Content ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {selectedRecord ? (
          <RecordDetail
            tableName={selectedRecord.table}
            recordId={selectedRecord.id}
            onBack={closeRecord}
            mode={selectedRecord.mode || 'view'}
            onRecordCreated={r => setSelectedRecord({ table: r.table, id: r.id })}
            prefill={selectedRecord.prefill}
            onNavigateToRecord={r => setSelectedRecord({ table: r.table, id: r.id, mode: r.mode, prefill: r.prefill })}
          />
        ) : tab === 'setup' ? (
          <SetupHome onOpenObjectManager={openObjectManager} onOpenRecord={openRecord} />
        ) : selectedObject ? (
          <ObjectDetail obj={selectedObject} onBack={() => setSelectedObject(null)} />
        ) : (
          <ObjectManager onOpenObject={obj => setSelectedObject(obj)} />
        )}
      </div>
    </div>
  )
}

// ─── Primary tab button ────────────────────────────────────────────────

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '11px 18px', background: 'none', border: 'none',
        borderBottom: active ? `2px solid ${C.emerald}` : '2px solid transparent',
        color: active ? C.textPrimary : C.textMuted,
        fontSize: 13, fontWeight: active ? 500 : 400,
        cursor: 'pointer', marginBottom: -1,
      }}
    >
      {label}
    </button>
  )
}

// ─── Breadcrumb builder ────────────────────────────────────────────────

function buildCrumbs(tab, selectedObject, selectedRecord) {
  const crumbs = [{ label: 'Admin', onClick: null }]
  if (tab === 'setup') {
    crumbs.push({ label: 'Setup Home', onClick: null })
  } else {
    crumbs.push({ label: 'Object Manager', onClick: null })
    if (selectedObject) crumbs.push({ label: selectedObject.pluralLabel, onClick: null })
  }
  if (selectedRecord) {
    crumbs.push({ label: selectedRecord.name || selectedRecord.table, onClick: null })
  }
  return crumbs
}
