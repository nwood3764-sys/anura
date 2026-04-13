import { supabase } from '../lib/supabase'
import { loadPicklists } from './outreachService'

// ---------------------------------------------------------------------------
// Users (all app user accounts)
// ---------------------------------------------------------------------------

export async function fetchUsers() {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id,
      user_record_number,
      user_name,
      user_first_name,
      user_last_name,
      user_title,
      user_email,
      user_phone,
      user_is_active,
      role_id,
      roles:role_id ( role_name )
    `)
    .order('user_created_at', { ascending: false })

  if (error) throw error

  return (data || [])
    .filter(r => r.user_is_active !== false)
    .map(r => ({
      id: r.user_record_number || r.id.slice(0, 8).toUpperCase(),
      _id: r.id,
      name: r.user_name || `${r.user_first_name || ''} ${r.user_last_name || ''}`.trim(),
      firstName: r.user_first_name || '—',
      lastName: r.user_last_name || '—',
      title: r.user_title || '—',
      email: r.user_email || '—',
      phone: r.user_phone || '—',
      role: r.roles?.role_name || '—',
      status: r.user_is_active ? 'Active' : 'Inactive',
    }))
}

// ---------------------------------------------------------------------------
// Technicians (field workers, a subset of users with extra fields)
// ---------------------------------------------------------------------------

export async function fetchTechnicians() {
  const picklists = await loadPicklists()

  const { data, error } = await supabase
    .from('technicians')
    .select(`
      id,
      technician_record_number,
      technician_name,
      technician_first_name,
      technician_last_name,
      technician_title,
      technician_status,
      technician_employee_id,
      technician_hire_date,
      technician_phone,
      technician_email,
      technician_bpi_certified,
      technician_bpi_certification_date,
      technician_bpi_expiry_date,
      technician_drivers_license,
      technician_drivers_license_state,
      technician_drivers_license_expiry
    `)
    .eq('technician_is_deleted', false)
    .order('technician_hire_date', { ascending: false })

  if (error) throw error

  return (data || []).map(r => ({
    id: r.technician_record_number || r.id.slice(0, 8).toUpperCase(),
    _id: r.id,
    name: r.technician_name,
    firstName: r.technician_first_name,
    lastName: r.technician_last_name,
    title: r.technician_title || '—',
    status: picklists.byId.get(r.technician_status) || '—',
    employeeId: r.technician_employee_id || '—',
    hireDate: r.technician_hire_date || '—',
    phone: r.technician_phone || '—',
    email: r.technician_email || '—',
    bpiCertified: r.technician_bpi_certified ? 'Yes' : 'No',
    bpiExpiry: r.technician_bpi_expiry_date || '—',
    driversLicense: r.technician_drivers_license || '—',
    licenseState: r.technician_drivers_license_state || '—',
    licenseExpiry: r.technician_drivers_license_expiry || '—',
  }))
}

// ---------------------------------------------------------------------------
// Certifications (joined to technicians for display)
// ---------------------------------------------------------------------------

export async function fetchCertifications() {
  const { data, error } = await supabase
    .from('certifications')
    .select(`
      id,
      certification_name,
      certification_type,
      issuing_body,
      certification_number,
      issue_date,
      expiration_date,
      status,
      technician_id,
      technicians:technician_id ( technician_name )
    `)
    .eq('is_deleted', false)
    .order('expiration_date', { ascending: true, nullsFirst: false })

  if (error) throw error

  return (data || []).map(r => ({
    id: r.id.slice(0, 8).toUpperCase(),
    _id: r.id,
    name: r.certification_name,
    technician: r.technicians?.technician_name || '—',
    type: r.certification_type,
    issuingBody: r.issuing_body || '—',
    certNumber: r.certification_number || '—',
    issueDate: r.issue_date || '—',
    expirationDate: r.expiration_date || '—',
    status: r.status,
  }))
}

// ---------------------------------------------------------------------------
// Time sheets (weekly roll-ups, one row per technician-week)
// ---------------------------------------------------------------------------

export async function fetchTimeSheets() {
  const picklists = await loadPicklists()

  const { data, error } = await supabase
    .from('time_sheets')
    .select(`
      id,
      ts_record_number,
      ts_name,
      ts_week_start_date,
      ts_week_end_date,
      ts_status,
      ts_total_hours,
      ts_notes,
      technician_id,
      technicians:technician_id ( technician_name )
    `)
    .eq('ts_is_deleted', false)
    .order('ts_week_start_date', { ascending: false })

  if (error) throw error

  return (data || []).map(r => ({
    id: r.ts_record_number || r.id.slice(0, 8).toUpperCase(),
    _id: r.id,
    name: r.ts_name,
    technician: r.technicians?.technician_name || '—',
    weekStart: r.ts_week_start_date || '—',
    weekEnd: r.ts_week_end_date || '—',
    status: picklists.byId.get(r.ts_status) || '—',
    totalHours: r.ts_total_hours ? Number(r.ts_total_hours) : 0,
    notes: r.ts_notes || '',
  }))
}
