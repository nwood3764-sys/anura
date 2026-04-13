import { supabase } from '../lib/supabase'
import { loadPicklists } from './outreachService'

// ---------------------------------------------------------------------------
// Products (the catalog — types of things we sell/install)
// ---------------------------------------------------------------------------

export async function fetchProducts() {
  const picklists = await loadPicklists()

  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      product_record_number,
      product_name,
      product_family,
      product_manufacturer,
      product_model_number,
      product_description,
      product_is_active
    `)
    .eq('product_is_deleted', false)
    .order('product_created_at', { ascending: false })

  if (error) throw error

  return (data || []).map(r => ({
    id: r.product_record_number || r.id.slice(0, 8).toUpperCase(),
    _id: r.id,
    name: r.product_name,
    family: picklists.byId.get(r.product_family) || '—',
    manufacturer: r.product_manufacturer || '—',
    model: r.product_model_number || '—',
    description: r.product_description || '',
    status: r.product_is_active ? 'Active' : 'Inactive',
  }))
}

// ---------------------------------------------------------------------------
// Product items (on-hand inventory — specific products at specific locations)
// ---------------------------------------------------------------------------

export async function fetchProductItems() {
  const { data, error } = await supabase
    .from('product_items')
    .select(`
      id,
      product_item_record_number,
      product_item_name,
      product_item_quantity_on_hand,
      product_item_vendor,
      product_id,
      location_id,
      products:product_id ( product_name, product_family, product_manufacturer ),
      locations:location_id ( location_name, location_city, location_state )
    `)
    .eq('product_item_is_deleted', false)
    .order('product_item_created_at', { ascending: false })

  if (error) throw error

  const picklists = await loadPicklists()

  return (data || []).map(r => ({
    id: r.product_item_record_number || r.id.slice(0, 8).toUpperCase(),
    _id: r.id,
    name: r.products?.product_name || r.product_item_name,
    family: picklists.byId.get(r.products?.product_family) || '—',
    manufacturer: r.products?.product_manufacturer || '—',
    quantityOnHand: Number(r.product_item_quantity_on_hand || 0),
    location: r.locations?.location_name || '—',
    state: r.locations?.location_state || '',
    vendor: r.product_item_vendor || '—',
  }))
}

// ---------------------------------------------------------------------------
// Materials requests (with a roll-up line-item count)
// ---------------------------------------------------------------------------

export async function fetchMaterialsRequests() {
  const picklists = await loadPicklists()

  const { data, error } = await supabase
    .from('materials_requests')
    .select(`
      id,
      mr_record_number,
      mr_name,
      mr_status,
      mr_need_by_datetime,
      mr_description,
      project_id,
      source_location_id,
      projects:project_id (
        project_name,
        property_id,
        properties:property_id ( property_name, property_state )
      ),
      source_location:source_location_id ( location_name )
    `)
    .eq('mr_is_deleted', false)
    .order('mr_created_at', { ascending: false })

  if (error) throw error

  // Get line item counts per request in one shot
  const { data: liRows } = await supabase
    .from('materials_request_line_items')
    .select('materials_request_id')
    .eq('mrli_is_deleted', false)

  const liCount = new Map()
  for (const li of liRows || []) {
    liCount.set(li.materials_request_id, (liCount.get(li.materials_request_id) || 0) + 1)
  }

  return (data || []).map(r => ({
    id: r.mr_record_number || r.id.slice(0, 8).toUpperCase(),
    _id: r.id,
    name: r.mr_name,
    property: r.projects?.properties?.property_name || '—',
    project: r.projects?.project_name || '—',
    status: picklists.byId.get(r.mr_status) || '—',
    sourceLocation: r.source_location?.location_name || '—',
    needBy: r.mr_need_by_datetime ? r.mr_need_by_datetime.slice(0, 10) : '—',
    lineItems: liCount.get(r.id) || 0,
    description: r.mr_description || '',
    state: r.projects?.properties?.property_state || '',
  }))
}

// ---------------------------------------------------------------------------
// Equipment (durable, non-consumable items — blower doors, ladders, cameras)
// ---------------------------------------------------------------------------

export async function fetchEquipment() {
  const picklists = await loadPicklists()

  const { data, error } = await supabase
    .from('equipment')
    .select(`
      id,
      equipment_record_number,
      equipment_name,
      equipment_manufacturer,
      equipment_model,
      equipment_serial_number,
      equipment_year_of_manufacture,
      equipment_condition,
      equipment_is_active,
      assigned_to_id,
      location_id,
      locations:location_id ( location_name )
    `)
    .eq('equipment_is_deleted', false)
    .order('equipment_created_at', { ascending: false })

  if (error) throw error

  return (data || []).map(r => ({
    id: r.equipment_record_number || r.id.slice(0, 8).toUpperCase(),
    _id: r.id,
    name: r.equipment_name,
    manufacturer: r.equipment_manufacturer || '—',
    model: r.equipment_model || '—',
    serialNumber: r.equipment_serial_number || '—',
    year: r.equipment_year_of_manufacture || '—',
    condition: picklists.byId.get(r.equipment_condition) || '—',
    status: r.equipment_is_active ? 'Active' : 'Retired',
    location: r.locations?.location_name || '—',
    assignedTo: 'Nicholas Wood', // TODO: wire to users table in a follow-up pass
  }))
}
