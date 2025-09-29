import type { Stop, PlannedRow, RealtimeRow, ArrivalJoined } from './types'
import { todayJerusalemISODate, delayFromExpectedAimedMinutes } from './time'

const BASE = 'https://open-bus-stride-api.hasadna.org.il'

export async function fetchStopByCode(code: string, date?: string): Promise<Stop> {
  const url = new URL('/gtfs_stops/list', BASE)
  url.searchParams.set('code', code)
  url.searchParams.set('date', date ?? todayJerusalemISODate())
  url.searchParams.set('limit', '1')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('שגיאה בשליפת תחנה')
  const json = await res.json()
  const item = json?.[0] || json?.data?.[0]
  if (!item) throw new Error('תחנה לא נמצאה')
  return {
    id: item.id,
    code: String(item.code ?? code),
    name: item.name,
    lat: item.lat,
    lon: item.lon
  }
}

export async function fetchPlanned(gtfsStopId: string | number, dateISO: string, fromIso: string, toIso: string): Promise<PlannedRow[]> {
  const url = new URL('/gtfs_ride_stops/list', BASE)
  url.searchParams.set('gtfs_stop_ids', String(gtfsStopId))
  url.searchParams.set('gtfs_stop__date', dateISO)
  url.searchParams.set('arrival_time_from', fromIso)
  url.searchParams.set('arrival_time_to', toIso)
  url.searchParams.set('order_by', 'departure_time')
  url.searchParams.set('limit', '300')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('שגיאה בשליפת לוח זמנים')
  const json = await res.json()
  const rows = (json?.data ?? json ?? []) as any[]
  return rows.map(r => ({
    id: r.id,
    arrival_time: r.arrival_time,
    departure_time: r.departure_time,
    stop_sequence: r.stop_sequence,
    gtfs_ride_id: r.gtfs_ride_id ?? r.gtfs_ride__id,
    gtfs_route__route_short_name: r.gtfs_route__route_short_name ?? r.gtfs_ride__route_short_name,
    gtfs_route__route_long_name: r.gtfs_route__route_long_name,
    gtfs_ride__journey_ref: r.gtfs_ride__journey_ref ?? r.journey_ref
  }))
}

export async function fetchRealtime(gtfsStopId: string | number, fromIso: string, toIso: string): Promise<RealtimeRow[]> {
  const url = new URL('/siri_ride_stops/list', BASE)
  url.searchParams.set('gtfs_stop_id', String(gtfsStopId))
  // Prefer aimed window; fallback handled by API if unsupported
  url.searchParams.set('aimed_arrival_time_from', fromIso)
  url.searchParams.set('aimed_arrival_time_to', toIso)
  url.searchParams.set('limit', '500')

  const res = await fetch(url.toString())
  if (!res.ok) {
    // fallback to expected_* filters
    const url2 = new URL('/siri_ride_stops/list', BASE)
    url2.searchParams.set('gtfs_stop_id', String(gtfsStopId))
    url2.searchParams.set('expected_arrival_time_from', fromIso)
    url2.searchParams.set('expected_arrival_time_to', toIso)
    url2.searchParams.set('limit', '500')
    const res2 = await fetch(url2.toString())
    if (!res2.ok) throw new Error('שגיאה בשליפת זמן אמת')
    const json2 = await res2.json()
    return (json2?.data ?? json2 ?? []) as RealtimeRow[]
  }
  const json = await res.json()
  return (json?.data ?? json ?? []) as RealtimeRow[]
}

function keyBy<T>(arr: T[], getKey: (x: T) => string | number | null | undefined): Map<string | number, T> {
  const m = new Map<string | number, T>()
  for (const x of arr) {
    const k = getKey(x)
    if (k !== null && k !== undefined) m.set(k, x)
  }
  return m
}

// Heuristic join: prefer direct gtfs_ride_stop_id, else journey_ref+sequence (if exists), else by route+closest aimed to planned
export function joinPlannedRealtime(planned: PlannedRow[], rt: RealtimeRow[]): ArrivalJoined[] {
  // 1) direct map by gtfs_ride_stop_id if present on RT and id on planned
  const byPlannedId = keyBy(planned, p => p.id ?? null)

  // 2) index RT by gtfs_ride_stop_id
  const rtByPlannedId = keyBy(rt, r => (r as any).gtfs_ride_stop_id ?? null)

  // 3) also build a journey_ref index
  const byJourney = new Map<string, RealtimeRow[]>()
  for (const r of rt) {
    const jr = r.gtfs_ride__journey_ref ?? r.siri_ride__journey_ref ?? null
    if (!jr) continue
    const arr = byJourney.get(jr) ?? []
    arr.push(r)
    byJourney.set(jr, arr)
  }

  const result: ArrivalJoined[] = []

  for (const p of planned) {
    let matched: RealtimeRow | null = null

    // Try direct id match
    if (p.id != null && rtByPlannedId.has(p.id)) {
      matched = rtByPlannedId.get(p.id)!
    }

    // Try journey_ref match
    if (!matched && p.gtfs_ride__journey_ref && byJourney.has(p.gtfs_ride__journey_ref)) {
      // pick the entry whose aimed/expected time is closest to planned departure
      const candidates = byJourney.get(p.gtfs_ride__journey_ref)!
      matched = pickClosestToPlanned(candidates, p.departure_time ?? p.arrival_time ?? null)
    }

    // Fallback: route name + closest time
    if (!matched) {
      const sameRoute = rt.filter(r =>
        (r.gtfs_route__route_short_name ?? null) === (p.gtfs_route__route_short_name ?? null)
      )
      if (sameRoute.length) {
        matched = pickClosestToPlanned(sameRoute, p.departure_time ?? p.arrival_time ?? null)
      }
    }

    // Build joined row
    const plannedIso = p.departure_time ?? p.arrival_time ?? null
    const realtimeIso = matched?.actual_arrival_time
      ?? matched?.expected_arrival_time
      ?? matched?.aimed_arrival_time
      ?? matched?.actual_departure_time
      ?? matched?.expected_departure_time
      ?? matched?.aimed_departure_time
      ?? null

    const delayMinutes = delayFromExpectedAimedMinutes(
      matched?.expected_arrival_time ?? matched?.expected_departure_time,
      matched?.aimed_arrival_time ?? matched?.aimed_departure_time
    )

    result.push({
      lineLabel: p.gtfs_route__route_short_name ?? '—',
      routeLong: p.gtfs_route__route_long_name ?? null,
      plannedIso,
      realtimeIso,
      delayMinutes,
      updatedAt: matched?.recorded_at_time ?? null,
      planned: p,
      realtime: matched ?? null
    })
  }

  // keep only those within the window with some timestamp
  return result.filter(x => !!x.plannedIso).sort((a,b) => {
    const aTs = new Date(a.realtimeIso ?? a.plannedIso!).getTime()
    const bTs = new Date(b.realtimeIso ?? b.plannedIso!).getTime()
    return aTs - bTs
  })
}

function pickClosestToPlanned(candidates: RealtimeRow[], plannedIso: string | null): RealtimeRow | null {
  if (!plannedIso || candidates.length === 0) return candidates[0] ?? null
  const pTs = new Date(plannedIso).getTime()
  let best: RealtimeRow | null = null
  let bestDiff = Number.POSITIVE_INFINITY
  for (const c of candidates) {
    const iso = c.actual_arrival_time ?? c.expected_arrival_time ?? c.aimed_arrival_time
      ?? c.actual_departure_time ?? c.expected_departure_time ?? c.aimed_departure_time
    if (!iso) continue
    const diff = Math.abs(new Date(iso).getTime() - pTs)
    if (diff < bestDiff) { bestDiff = diff; best = c }
  }
  return best
}
