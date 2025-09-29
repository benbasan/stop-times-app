export type Stop = {
  id: number | string
  code: string
  name?: string
  lat?: number
  lon?: number
}

export type PlannedRow = {
  id?: number | string
  arrival_time?: string | null
  departure_time?: string | null
  stop_sequence?: number | null
  gtfs_ride_id?: number | string | null
  gtfs_route__route_short_name?: string | null
  gtfs_route__route_long_name?: string | null
  gtfs_ride__journey_ref?: string | null
}

export type RealtimeRow = {
  id?: number | string
  gtfs_ride_stop_id?: number | string | null
  siri_ride__journey_ref?: string | null
  gtfs_ride__journey_ref?: string | null

  aimed_arrival_time?: string | null
  expected_arrival_time?: string | null
  actual_arrival_time?: string | null
  aimed_departure_time?: string | null
  expected_departure_time?: string | null
  actual_departure_time?: string | null

  gtfs_route__route_short_name?: string | null
  gtfs_route__agency_name?: string | null
  siri_route__line_ref?: number | string | null
  siri_route__operator_ref?: number | string | null

  recorded_at_time?: string | null
}

export type ArrivalJoined = {
  lineLabel: string
  routeLong?: string | null
  plannedIso?: string | null
  realtimeIso?: string | null
  delayMinutes?: number | null
  updatedAt?: string | null  // recorded_at_time

  // raw (debug)
  planned?: PlannedRow
  realtime?: RealtimeRow | null
}
