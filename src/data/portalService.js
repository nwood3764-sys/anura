import { supabase } from '../lib/supabase'

// ---------------------------------------------------------------------------
// Portal users (external users with access via customer portal or partner portal)
// ---------------------------------------------------------------------------

export async function fetchPortalUsers() {
  const { data, error } = await supabase
    .from('portal_users')
    .select(`
      id,
      full_name,
      email,
      phone,
      portal_role,
      status,
      last_login,
      notes,
      property_owner_id,
      partner_org_id,
      property_owners:property_owner_id ( property_owner_name ),
      partner_organizations:partner_org_id ( name )
    `)
    .eq('is_deleted', false)
    .order('last_login', { ascending: false, nullsFirst: false })

  if (error) throw error

  return (data || []).map(r => ({
    id: r.id.slice(0, 8).toUpperCase(),
    _id: r.id,
    name: r.full_name,
    email: r.email || '—',
    phone: r.phone || '—',
    portalRole: r.portal_role,
    status: r.status,
    lastLogin: r.last_login
      ? new Date(r.last_login).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Never',
    propertyOwner: r.property_owners?.property_owner_name || '—',
    partnerOrg: r.partner_organizations?.name || '—',
    organization: r.property_owners?.property_owner_name || r.partner_organizations?.name || '—',
    userType: r.property_owner_id ? 'Property Owner Portal' : 'Partner Portal',
    notes: r.notes || '',
  }))
}

// ---------------------------------------------------------------------------
// Partner organizations (subcontractors / service providers)
// ---------------------------------------------------------------------------

export async function fetchPartnerOrganizations() {
  const { data, error } = await supabase
    .from('partner_organizations')
    .select(`
      id,
      name,
      short_name,
      status,
      partner_type,
      phone,
      address_street,
      address_city,
      address_state,
      address_zip,
      primary_contact,
      primary_contact_phone,
      primary_contact_email,
      notes
    `)
    .eq('is_deleted', false)
    .order('name', { ascending: true })

  if (error) throw error

  return (data || []).map(r => ({
    id: r.short_name || r.id.slice(0, 8).toUpperCase(),
    _id: r.id,
    name: r.name,
    shortName: r.short_name || '—',
    status: r.status,
    partnerType: r.partner_type || '—',
    phone: r.phone || '—',
    city: r.address_city || '—',
    state: r.address_state || '—',
    primaryContact: r.primary_contact || '—',
    primaryContactPhone: r.primary_contact_phone || '—',
    primaryContactEmail: r.primary_contact_email || '—',
    address: [r.address_street, r.address_city, r.address_state, r.address_zip].filter(Boolean).join(', ') || '—',
    notes: r.notes || '',
  }))
}
