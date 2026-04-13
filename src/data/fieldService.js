import { supabase } from '../lib/supabase'
import { loadPicklists } from './outreachService'

// DB work-order statuses are short ("In Progress"); the UI filter options
// are long ("Work Order In Progress"). Map between them for display so the
// filter dropdowns still match.
const workOrderStatusLabel = raw => {
  if (!raw) return '—'
  return raw.startsWith('Work Order') ? raw : `Work Order ${raw}`
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function fetchProjects() {
  const picklists = await loadPicklists()

  const { data, error } = await supabase
    .from('projects')
    .select(`
      id,
      project_record_number,
      project_name,
      project_status,
      project_scheduled_date,
      project_completion_date,
      property_id,
      properties:property_id ( property_name, property_state )
    `)
    .eq('project_is_deleted', false)
    .order('project_scheduled_date', { ascending: true, nullsFirst: false })

  if (error) throw error

  // Also pull work order counts per project so the "WOs" column shows real data
  const { data: woRows } = await supabase
    .from('work_orders')
    .select('project_id')
    .eq('work_order_is_deleted', false)

  const woCountByProject = new Map()
  for (const w of woRows || []) {
    woCountByProject.set(w.project_id, (woCountByProject.get(w.project_id) || 0) + 1)
  }

  return (data || []).map(r => ({
    id: r.project_record_number || r.id.slice(0, 8).toUpperCase(),
    _id: r.id,
    name: r.project_name,
    property: r.properties?.property_name || '—',
    program: '—', // populated in a follow-up pass once project↔program link is live
    status: picklists.byId.get(r.project_status) || '—',
    owner: 'Nicholas Wood',
    workOrders: woCountByProject.get(r.id) || 0,
    startDate: r.project_scheduled_date || '',
    endDate: r.project_completion_date || '',
    state: r.properties?.property_state || '',
  }))
}

// ---------------------------------------------------------------------------
// Work orders
// ---------------------------------------------------------------------------

export async function fetchWorkOrders() {
  const picklists = await loadPicklists()

  const { data, error } = await supabase
    .from('work_orders')
    .select(`
      id,
      work_order_record_number,
      work_order_name,
      work_order_status,
      work_order_scheduled_start_date,
      work_order_duration,
      work_type_id,
      property_id,
      building_id,
      work_types:work_type_id ( work_type_name ),
      properties:property_id ( property_name, property_state ),
      buildings:building_id ( building_name )
    `)
    .eq('work_order_is_deleted', false)
    .order('work_order_scheduled_start_date', { ascending: true, nullsFirst: false })

  if (error) throw error

  return (data || []).map(r => ({
    id: r.work_order_record_number || r.id.slice(0, 8).toUpperCase(),
    _id: r.id,
    name: r.work_order_name,
    property: r.properties?.property_name || '—',
    building: r.buildings?.building_name || '—',
    workType: r.work_types?.work_type_name || '—',
    status: workOrderStatusLabel(picklists.byId.get(r.work_order_status)),
    teamLead: 'Unassigned',
    scheduledDate: r.work_order_scheduled_start_date || '',
    duration: r.work_order_duration ? `${r.work_order_duration}h` : '—',
    state: r.properties?.property_state || '',
  }))
}
