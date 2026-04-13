import { supabase } from '../lib/supabase'
import { loadPicklists } from './outreachService'

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

export async function fetchAssessments() {
  const picklists = await loadPicklists()

  const { data, error } = await supabase
    .from('assessments')
    .select(`
      id,
      assessment_record_number,
      assessment_name,
      assessment_date,
      assessment_status,
      assessment_type,
      assessment_total_units,
      property_id,
      building_id,
      properties:property_id ( property_name, property_state )
    `)
    .eq('assessment_is_deleted', false)
    .order('assessment_date', { ascending: false })

  if (error) throw error

  // UI status values in the columns don't match the DB values 1:1 —
  // DB has "Scheduled" but UI filters on "Assessment Scheduled". We map
  // by prepending "Assessment " if it's not already there.
  const statusLabel = id => {
    const raw = picklists.byId.get(id) || ''
    if (!raw) return '—'
    return raw.startsWith('Assessment') ? raw : `Assessment ${raw === 'Completed' ? 'Completed — To Be Reviewed' : raw === 'To Be Reviewed' ? 'Completed — To Be Reviewed' : raw}`
  }

  return (data || []).map(r => ({
    id: r.assessment_record_number || r.id.slice(0, 8).toUpperCase(),
    _id: r.id,
    name: r.assessment_name,
    property: r.properties?.property_name || '—',
    type: picklists.byId.get(r.assessment_type) || '—',
    status: statusLabel(r.assessment_status),
    assessor: 'Nicholas Wood',
    scheduledDate: r.assessment_date || '',
    completedDate: r.assessment_date || '',
    units: r.assessment_total_units ?? 0,
    state: r.properties?.property_state || '',
  }))
}

// ---------------------------------------------------------------------------
// Incentive applications
// ---------------------------------------------------------------------------

export async function fetchIncentiveApplications() {
  const picklists = await loadPicklists()

  const { data, error } = await supabase
    .from('incentive_applications')
    .select(`
      id,
      ia_record_number,
      ia_name,
      ia_status,
      ia_program_name,
      ia_program_year,
      ia_requested_incentive_amount,
      ia_approved_incentive_amount,
      ia_submission_date,
      property_id,
      properties:property_id ( property_name, property_state )
    `)
    .eq('ia_is_deleted', false)
    .order('ia_submission_date', { ascending: false, nullsFirst: false })

  if (error) throw error

  const fmtAmount = n => n == null ? '—' : `$${Number(n).toLocaleString()}`

  return (data || []).map(r => ({
    id: r.ia_record_number || r.id.slice(0, 8).toUpperCase(),
    _id: r.id,
    name: r.ia_name,
    property: r.properties?.property_name || '—',
    program: r.ia_program_name || '—',
    status: picklists.byId.get(r.ia_status) || '—',
    owner: 'Nicholas Wood',
    amount: Number(r.ia_approved_incentive_amount ?? r.ia_requested_incentive_amount) || 0,
    _amountFmt: fmtAmount(r.ia_approved_incentive_amount ?? r.ia_requested_incentive_amount),
    submittedDate: r.ia_submission_date || '',
    programYear: String(r.ia_program_year || ''),
    state: r.properties?.property_state || '',
  }))
}

// ---------------------------------------------------------------------------
// EFR Reports
// ---------------------------------------------------------------------------

export async function fetchEfrReports() {
  const { data, error } = await supabase
    .from('efr_reports')
    .select(`
      id,
      efr_record_number,
      efr_name,
      efr_assessment_date,
      efr_report_submitted_date,
      building_id,
      buildings:building_id (
        building_name,
        building_total_units,
        property_id,
        properties:property_id ( property_name, property_state )
      )
    `)
    .eq('efr_is_deleted', false)
    .order('efr_assessment_date', { ascending: false, nullsFirst: false })

  if (error) throw error

  return (data || []).map(r => ({
    id: r.efr_record_number || r.id.slice(0, 8).toUpperCase(),
    _id: r.id,
    name: r.efr_name,
    property: r.buildings?.properties?.property_name || '—',
    status: r.efr_report_submitted_date ? 'EFR Completed — To Be Reviewed' : 'EFR In Progress',
    assessor: 'Nicholas Wood',
    reportType: 'Denver Electrification',
    scheduledDate: r.efr_assessment_date || '',
    completedDate: r.efr_report_submitted_date || '',
    buildings: 1,
    units: r.buildings?.building_total_units ?? 0,
    state: r.buildings?.properties?.property_state || '',
  }))
}
