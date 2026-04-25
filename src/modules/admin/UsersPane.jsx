import { useCallback, useEffect, useState } from 'react'
import { C } from '../../data/constants'
import { LoadingState, ErrorState } from '../../components/UI'
import { ListView } from '../../components/ListView'
import { fetchUsers } from '../../data/adminService'
import InviteUserModal from './InviteUserModal'

/**
 * UsersPane — Administration > Users.
 *
 * Differs from the generic NodePage in three ways:
 *
 *   1. The "New" button opens an InviteUserModal that sends a Supabase Auth
 *      invite email rather than creating a blank public.users row. Creating
 *      a row without a corresponding auth account would result in an
 *      orphan that can't sign in — so we never expose that path here.
 *
 *   2. A custom Sign-In column shows the auth-link state per row. Rows that
 *      have no auth_user_id get a "Send invite" inline action that
 *      provisions an auth account and links it to the existing row.
 *
 *   3. Refreshing after invite — the list re-fetches so the user just
 *      invited appears (or the orphan row's link state flips) without a
 *      page reload.
 */
export default function UsersPane({ onOpenRecord }) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // Modal state. `mode` is 'new' or 'relink'. `existingUser` carries the
  // row we're re-inviting in relink mode; null otherwise.
  const [modal, setModal] = useState(null) // { mode, existingUser }

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    return fetchUsers()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  // Custom cell renderer for the Sign-In column. Returns null for any
  // other column so ListView falls back to its default cell renderer.
  // We render a full <td> here; ListView expects renderCell to return
  // either a complete cell or a falsy value.
  const renderCell = (col, row) => {
    if (col.field !== 'authStatus') return null
    return (
      <td key="authStatus" style={cellStyle}>
        {row.hasAuthLink ? (
          <span style={badgeOk}>Active</span>
        ) : (
          <button
            type="button"
            // Stop the click from bubbling — the row click would otherwise
            // toggle the detail panel underneath us.
            onClick={(e) => {
              e.stopPropagation()
              setModal({ mode: 'relink', existingUser: row })
            }}
            style={inviteBtnStyle}
            title="Send a Supabase Auth invite email so this user can set a password and sign in."
          >
            Send invite
          </button>
        )}
      </td>
    )
  }

  const systemViews = [
    { id: 'AV',    name: 'All',                  filters: [], sortField: 'lastName', sortDir: 'asc' },
    { id: 'PEND',  name: 'Awaiting Sign-In',     filters: [{ field: 'authStatus', op: 'equals', value: 'Pending' }], sortField: 'lastName', sortDir: 'asc' },
    { id: 'INACT', name: 'Inactive',             filters: [{ field: 'status',     op: 'equals', value: 'Inactive' }], sortField: 'lastName', sortDir: 'asc' },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 24px 10px', background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary }}>Users</div>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
          {loading
            ? 'Loading…'
            : `${data.length} record${data.length === 1 ? '' : 's'}` +
              (data.length
                ? ` · ${data.filter(u => !u.hasAuthLink).length} awaiting sign-in`
                : '')}
        </div>
      </div>
      {loading && <LoadingState />}
      {error && !loading && <ErrorState error={error} />}
      {!loading && !error && (
        <ListView
          // Inject a virtual `authStatus` field on each row so ListView's
          // filter/sort code can reference it — the renderCell for that
          // column produces the actual button/badge.
          data={data.map(u => ({ ...u, authStatus: u.hasAuthLink ? 'Active' : 'Pending' }))}
          columns={USER_COLS}
          renderCell={renderCell}
          systemViews={systemViews}
          defaultViewId="AV"
          newLabel="User"
          onNew={() => setModal({ mode: 'new', existingUser: null })}
          onOpenRecord={onOpenRecord
            ? row => row?._id && onOpenRecord({ table: 'users', id: row._id, name: row.name || row.id })
            : undefined}
          onRefresh={reload}
        />
      )}

      {modal && (
        <InviteUserModal
          mode={modal.mode}
          existingUser={modal.existingUser}
          onClose={() => setModal(null)}
          onInvited={() => { reload() }}
        />
      )}
    </div>
  )
}

// ─── Column definitions ─────────────────────────────────────────────────────
// authStatus is a virtual column — its content comes from renderCell above.
// It still has a `field` because ListView uses field for keying, sorting,
// and filtering. The value `'Active' | 'Pending'` lives on each row inside
// UsersPane (mapped from hasAuthLink) so filters/sorts behave naturally.
const USER_COLS = [
  { field: 'id',         label: 'Record #',  type: 'text',   sortable: true,  filterable: false },
  { field: 'name',       label: 'Name',      type: 'text',   sortable: true,  filterable: true  },
  { field: 'role',       label: 'Role',      type: 'text',   sortable: true,  filterable: true  },
  { field: 'title',      label: 'Title',     type: 'text',   sortable: true,  filterable: true  },
  { field: 'email',      label: 'Email',     type: 'text',   sortable: true,  filterable: true  },
  { field: 'phone',      label: 'Phone',     type: 'text',   sortable: false, filterable: false },
  { field: 'authStatus', label: 'Sign-In',   type: 'select', sortable: true,  filterable: true,  options: ['Active', 'Pending'] },
  { field: 'status',     label: 'Status',    type: 'select', sortable: true,  filterable: true,  options: ['Active', 'Inactive'] },
]

// ─── Inline styles ──────────────────────────────────────────────────────────
const cellStyle = {
  padding: '8px 14px',
  fontSize: 12.5,
  color: C.textPrimary,
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
}

const badgeOk = {
  display: 'inline-block',
  padding: '2px 9px',
  fontSize: 11,
  fontWeight: 500,
  color: '#1a6e44',
  background: '#dff5e9',
  borderRadius: 999,
  border: '1px solid #b7e3cb',
}

const inviteBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  fontSize: 11.5,
  fontWeight: 500,
  color: C.emerald,
  background: '#ffffff',
  border: `1px solid ${C.emerald}`,
  borderRadius: 5,
  cursor: 'pointer',
}
