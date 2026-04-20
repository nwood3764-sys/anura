import { supabase } from '../lib/supabase'
import { loadPicklists } from './outreachService'
export { loadPicklists }

/**
 * Get the current authenticated user's app-level UUID from the users table.
 */
let _cachedUserId = null
export async function getCurrentUserId() {
  if (_cachedUserId) return _cachedUserId
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data } = await supabase.from('users').select('id').eq('auth_user_id', user.id).single()
  _cachedUserId = data?.id || user.id
  return _cachedUserId
}

/**
 * Fetch the page layout configuration for a given object.
 * Returns { layout, sections: [{ ...section, widgets: [...] }] }
 */
export async function fetchPageLayout(objectName) {
  // Get the default record_detail layout for this object
  const { data: layouts, error: layoutErr } = await supabase
    .from('page_layouts')
    .select('*')
    .eq('page_layout_object', objectName)
    .eq('page_layout_type', 'record_detail')
    .eq('page_layout_is_default', true)
    .eq('is_deleted', false)
    .limit(1)

  if (layoutErr) throw layoutErr
  if (!layouts || layouts.length === 0) return null

  const layout = layouts[0]

  // Get sections ordered by section_order
  const { data: sections, error: secErr } = await supabase
    .from('page_layout_sections')
    .select('*')
    .eq('page_layout_id', layout.id)
    .order('section_order', { ascending: true })

  if (secErr) throw secErr

  // Get all widgets for this layout
  const { data: widgets, error: widErr } = await supabase
    .from('page_layout_widgets')
    .select('*')
    .eq('page_layout_id', layout.id)
    .eq('is_deleted', false)
    .order('widget_position', { ascending: true })

  if (widErr) throw widErr

  // Nest widgets under their sections
  const sectionMap = new Map()
  for (const s of sections || []) {
    sectionMap.set(s.id, { ...s, widgets: [] })
  }
  for (const w of widgets || []) {
    const sec = sectionMap.get(w.section_id)
    if (sec) sec.widgets.push(w)
  }

  return {
    layout,
    sections: Array.from(sectionMap.values()),
  }
}

/**
 * Fetch a single record from a table by ID.
 * Returns all columns (SELECT *).
 */
export async function fetchRecord(tableName, recordId) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', recordId)
    .limit(1)
    .single()

  if (error) throw error
  return data
}

/**
 * Resolve lookup fields — given an array of { lookup_table, lookup_field, value (uuid) },
 * batch-fetch display values. Returns a Map<uuid, displayValue>.
 */
export async function resolveLookups(lookupRequests) {
  const resolved = new Map()
  if (!lookupRequests || lookupRequests.length === 0) return resolved

  // Group by table to batch queries
  const byTable = new Map()
  for (const req of lookupRequests) {
    if (!req.value) continue
    const key = `${req.lookup_table}:${req.lookup_field}`
    if (!byTable.has(key)) {
      byTable.set(key, { table: req.lookup_table, field: req.lookup_field, ids: new Set() })
    }
    byTable.get(key).ids.add(req.value)
  }

  for (const [, { table, field, ids }] of byTable) {
    const idArr = Array.from(ids)
    const { data } = await supabase
      .from(table)
      .select(`id, ${field}`)
      .in('id', idArr)

    for (const row of data || []) {
      resolved.set(row.id, row[field])
    }
  }

  return resolved
}

/**
 * Fetch related records for a related_list widget.
 */
export async function fetchRelatedRecords(config, parentRecordId) {
  const { table, fk, is_deleted_col, columns, sort_field, sort_dir } = config

  let query = supabase
    .from(table)
    .select('id, ' + columns.map(c => c.name).join(', '))
    .eq(fk, parentRecordId)

  if (is_deleted_col) {
    query = query.eq(is_deleted_col, false)
  }

  if (sort_field) {
    query = query.order(sort_field, { ascending: sort_dir !== 'desc' })
  }

  query = query.limit(25)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Master function: load everything needed to render a record detail page.
 * Returns { record, layout, sections, picklists, lookups }
 */
export async function loadRecordDetailData(tableName, recordId) {
  // Parallel fetch: record, layout, picklists
  const [record, layoutData, picklists] = await Promise.all([
    fetchRecord(tableName, recordId),
    fetchPageLayout(tableName),
    loadPicklists(),
  ])

  if (!layoutData) {
    return { record, layout: null, sections: [], picklists, lookups: new Map() }
  }

  // Collect lookup requests from all field_group widgets
  const lookupRequests = []
  for (const sec of layoutData.sections) {
    for (const w of sec.widgets) {
      if (w.widget_type === 'field_group' && w.widget_config?.fields) {
        for (const f of w.widget_config.fields) {
          if (f.type === 'lookup' && record[f.name]) {
            lookupRequests.push({
              lookup_table: f.lookup_table,
              lookup_field: f.lookup_field,
              value: record[f.name],
            })
          }
        }
      }
    }
  }

  const lookups = await resolveLookups(lookupRequests)

  // Pre-fetch related list data
  for (const sec of layoutData.sections) {
    for (const w of sec.widgets) {
      if (w.widget_type === 'related_list' && w.widget_config) {
        w._relatedData = await fetchRelatedRecords(w.widget_config, recordId)
      }
    }
  }

  return {
    record,
    layout: layoutData.layout,
    sections: layoutData.sections,
    picklists,
    lookups,
  }
}

/**
 * Save changes to a record. Only sends the changed fields.
 * Returns the updated record.
 */
export async function saveRecord(tableName, recordId, changes) {
  const { data, error } = await supabase
    .from(tableName)
    .update(changes)
    .eq('id', recordId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Fetch picklist options for a given object + field.
 * Used to populate <select> dropdowns in edit mode.
 */
export async function fetchPicklistOptions(objectName, fieldName) {
  const { data, error } = await supabase
    .from('picklist_values')
    .select('id, picklist_value, picklist_label')
    .eq('picklist_object', objectName)
    .eq('picklist_field', fieldName)
    .eq('picklist_is_active', true)
    .order('picklist_sort_order', { ascending: true })

  if (error) throw error
  return (data || []).map(r => ({
    id: r.id,
    value: r.id,        // the UUID stored in the record
    label: r.picklist_label || r.picklist_value,
  }))
}

/**
 * Insert a new record. Returns the newly created record.
 */
export async function insertRecord(tableName, fields) {
  const { data, error } = await supabase
    .from(tableName)
    .insert(fields)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Fetch lookup options for a FK field — id + display name from the
 * referenced table. Used for <select> dropdowns on lookup fields.
 */
export async function fetchLookupOptions(lookupTable, lookupField, limit = 50) {
  const { data, error } = await supabase
    .from(lookupTable)
    .select(`id, ${lookupField}`)
    .limit(limit)

  if (error) throw error
  return (data || []).map(r => ({
    value: r.id,
    label: r[lookupField] || r.id.slice(0, 8),
  }))
}
