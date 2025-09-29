export type Stop = { id: string; code: string; name?: string; city?: string; lat?: number; lon?: number; };
export type ArrivalPlanned = { routeId: string; lineLabel: string; routeLong?: string; plannedIso: string; };
export type ArrivalRealtime = { routeId: string; realtimeIso: string; delayMinutes?: number; updatedAt?: string; };
export type ArrivalJoined = { routeId: string; lineLabel: string; routeLong?: string; plannedIso?: string; realtimeIso?: string; delayMinutes?: number; updatedAt?: string; };