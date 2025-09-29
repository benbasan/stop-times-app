
import type { Stop, ArrivalPlanned, ArrivalRealtime, ArrivalJoined } from './types'

const USE_MOCK = (import.meta as any).env?.VITE_USE_MOCK !== 'false';
const BASE_URL: string | undefined = (import.meta as any).env?.VITE_API_BASE_URL;
const API_KEY: string | undefined = (import.meta as any).env?.VITE_API_KEY;

function authHeaders(): HeadersInit {
  const h: Record<string, string> = { 'Accept': 'application/json' };
  if (API_KEY) h['Authorization'] = `Bearer ${API_KEY}`;
  return h;
}

export async function fetchStopByCode(code: string, serviceDate: string): Promise<Stop> {
  if (USE_MOCK || !BASE_URL) {
    await delay(120);
    if (!/\d{4,6}/.test(code)) throw new Error('מספר תחנה לא תקין');
    return { id: `stop_${code}`, code, name: 'תחנה לדוגמה', city: 'תל אביב', lat: 32.08, lon: 34.78 };
  }
  const url = new URL('/gtfs/stops', BASE_URL);
  url.searchParams.set('stop_code', code);
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`שגיאה בשליפת תחנה (${res.status})`);
  const data = await res.json();
  const arr = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
  if (!arr.length) throw new Error('התחנה לא נמצאה');
  const s = arr[0];
  return {
    id: String(s.stop_id ?? s.id ?? `stop_${code}`),
    code: String(s.stop_code ?? code),
    name: s.stop_name ?? s.name,
    city: s.stop_city ?? s.city,
    lat: toNum(s.stop_lat ?? s.lat),
    lon: toNum(s.stop_lon ?? s.lon),
  };
}

export async function fetchPlanned(stopId: string, serviceDate: string, fromIso: string, toIso: string): Promise<ArrivalPlanned[]> {
  if (USE_MOCK || !BASE_URL) {
    await delay(120);
    const base = parseInt(stopId.replace(/\D/g,'')) % 3 + 1;
    return Array.from({ length: 10 }, (_, i) => ({
      routeId: `r${base}${i}`,
      lineLabel: String(100 + ((i * 3 + base) % 80)),
      routeLong: ['חדרה','חיפה','תל אביב','ירושלים'][i % 4],
      plannedIso: new Date(Date.now() + (i + 2) * 5 * 60000).toISOString(),
    }));
  }
  const url = new URL('/gtfs/planned_stop_times', BASE_URL);
  url.searchParams.set('stop_id', stopId);
  url.searchParams.set('from', fromIso);
  url.searchParams.set('to', toIso);
  url.searchParams.set('limit', '100');
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`שגיאה בשליפת לוח זמנים (${res.status})`);
  const data = await res.json();
  const rows = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
  const planned: ArrivalPlanned[] = rows.map((r: any) => ({
    routeId: String(r.route_id ?? r.trip_id ?? r.id),
    lineLabel: String(r.route_short_name ?? r.line_label ?? r.route_id ?? '???'),
    routeLong: r.route_long_name ?? r.headsign,
    plannedIso: r.arrival_time_iso ?? r.planned_iso ?? r.arrival_time ?? r.departure_time_iso ?? r.departure_time,
  })).filter((x: ArrivalPlanned) => !!x.plannedIso);
  return planned;
}

export async function fetchRealtime(stopIdOrCode: string, fromIso: string, toIso: string): Promise<ArrivalRealtime[]> {
  if (USE_MOCK || !BASE_URL) {
    await delay(120);
    return Array.from({ length: 8 }, (_, i) => ({
      routeId: `r${(parseInt(stopIdOrCode.replace(/\D/g,''))%3)+1}${i}`,
      realtimeIso: new Date(Date.now() + (i + 1) * 5 * 60000 + ((i%3)-1) * 60_000).toISOString(),
      delayMinutes: ((i%3)-1) * 2,
      updatedAt: new Date().toISOString(),
    }));
  }
  const url = new URL('/siri/stop-monitoring', BASE_URL);
  url.searchParams.set('MonitoringRef', stopIdOrCode);
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`שגיאה בשליפת זמן אמת (${res.status})`);
  const siri = await res.json();
  const visits = extractMonitoredStopVisits(siri);
  const rt: ArrivalRealtime[] = visits.map((v: any) => {
    const call = v.MonitoredVehicleJourney?.MonitoredCall ?? v.MonitoredCall ?? v;
    const pt = call?.ExpectedArrivalTime ?? call?.AimedArrivalTime ?? call?.ExpectedDepartureTime ?? call?.AimedDepartureTime;
    const delay = toNum(call?.DelayMinutes ?? call?.Delay ?? call?.ArrivalStatusDelay ?? 0);
    const lineRef = v.MonitoredVehicleJourney?.LineRef ?? v.LineRef ?? v.RouteRef ?? v.RouteId;
    const updatedAt = v.RecordedAtTime ?? v.MonitoredVehicleJourney?.RecordedAtTime ?? new Date().toISOString();
    return { routeId: String(lineRef ?? 'unknown'), realtimeIso: String(pt ?? new Date().toISOString()), delayMinutes: Number.isFinite(delay)?Number(delay):undefined, updatedAt: String(updatedAt) };
  }).filter(x => !!x.realtimeIso);
  return rt;
}

export function joinPlannedRealtime(planned: ArrivalPlanned[], realtime: ArrivalRealtime[]): ArrivalJoined[] {
  const byRoute = new Map<string, ArrivalJoined>();
  for (const p of planned) byRoute.set(p.routeId, { routeId: p.routeId, lineLabel: p.lineLabel, routeLong: p.routeLong, plannedIso: p.plannedIso });
  for (const r of realtime) {
    const base = byRoute.get(r.routeId);
    if (base) { base.realtimeIso = r.realtimeIso; base.delayMinutes = r.delayMinutes; base.updatedAt = r.updatedAt; }
    else { byRoute.set(r.routeId, { routeId: r.routeId, lineLabel: r.routeId, realtimeIso: r.realtimeIso, delayMinutes: r.delayMinutes, updatedAt: r.updatedAt }); }
  }
  return Array.from(byRoute.values()).sort((a,b) => new Date((a.realtimeIso ?? a.plannedIso)!).getTime() - new Date((b.realtimeIso ?? b.plannedIso)!).getTime());
}

function delay(ms: number) { return new Promise(res => setTimeout(res, ms)); }
function toNum(v: any): number | undefined { const n = Number(v); return Number.isFinite(n) ? n : undefined; }

function extractMonitoredStopVisits(siri: any): any[] {
  if (!siri) return [];
  const deliveries = siri?.Siri?.ServiceDelivery?.StopMonitoringDelivery ?? siri?.StopMonitoringDelivery;
  if (Array.isArray(deliveries)) {
    const visits = deliveries.flatMap((d: any) => Array.isArray(d?.MonitoredStopVisit) ? d.MonitoredStopVisit : []);
    if (visits.length) return visits;
  }
  if (Array.isArray(siri?.MonitoredStopVisit)) return siri.MonitoredStopVisit;
  if (Array.isArray(deliveries?.MonitoredStopVisit)) return deliveries.MonitoredStopVisit;
  return [];
}
