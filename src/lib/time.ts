const TZ = 'Asia/Jerusalem'

export function nowUtcIso(): string {
  return new Date().toISOString()
}

export function plusMinutesUtcIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

export function todayJerusalemISODate(): string {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('he-IL', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = fmt.formatToParts(now)
  const dd = parts.find(p => p.type === 'day')!.value
  const mm = parts.find(p => p.type === 'month')!.value
  const yyyy = parts.find(p => p.type === 'year')!.value
  return `${yyyy}-${mm}-${dd}`
}

export function formatLocalHM(isoUtc: string): string {
  const d = new Date(isoUtc)
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d)
}

export function computeEtaMinutes(arrivalIsoUtc: string | null, _diffSeconds?: number | null): number {
  if (!arrivalIsoUtc) return 0
  const arrivalTs = new Date(arrivalIsoUtc).getTime()
  const now = Date.now()
  return Math.round((arrivalTs - now) / 60000)
}

export function etaLabel(minutes: number): string {
  if (minutes <= 0) return 'עכשיו'
  if (minutes === 1) return 'דקה'
  return `${minutes} דק׳`
}

export function delayFromExpectedAimedMinutes(expectedIso?: string | null, aimedIso?: string | null): number | null {
  if (!expectedIso || !aimedIso) return null
  const exp = new Date(expectedIso).getTime()
  const aim = new Date(aimedIso).getTime()
  return Math.round((exp - aim) / 60000)
}
