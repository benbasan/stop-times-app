import React from 'react'
import { fetchStopByCode, fetchPlanned, fetchRealtime, joinPlannedRealtime } from './lib/api'
import { nowUtcIso, plusMinutesUtcIso, formatLocalHM, computeEtaMinutes, etaLabel, todayJerusalemISODate } from './lib/time'
import type { Stop, ArrivalJoined } from './lib/types'

export default function StopLookup() {
  const [stopCode, setStopCode] = React.useState<string>(() => localStorage.getItem('lastStopCode') || '20269')
  const [stop, setStop] = React.useState<Stop | null>(null)
  const [rows, setRows] = React.useState<ArrivalJoined[]>([])
  const [status, setStatus] = React.useState<'idle'|'loading'|'error'|'success'>('idle')
  const [error, setError] = React.useState<string>('')
  const [autoRefresh, setAutoRefresh] = React.useState<boolean>(true)

  const load = React.useCallback(async (code: string) => {
    try {
      setStatus('loading'); setError('')
      const dateISO = todayJerusalemISODate()
      const s = await fetchStopByCode(code, dateISO)
      setStop(s)
      const from = nowUtcIso()
      const to = plusMinutesUtcIso(60)

      const [planned, rt] = await Promise.all([
        fetchPlanned(s.id, dateISO, from, to),
        fetchRealtime(s.id, from, to)
      ])

      const joined = joinPlannedRealtime(planned, rt).slice(0, 12)
      setRows(joined)
      setStatus('success')
      localStorage.setItem('lastStopCode', code)
    } catch (e: any) {
      setStatus('error')
      setError(e?.message || 'אירעה שגיאה')
    }
  }, [])

  React.useEffect(() => {
    let t: any
    if (status === 'success' && autoRefresh && stop) {
      t = setInterval(() => load(stop.code), 30_000)
    }
    return () => clearInterval(t)
  }, [status, autoRefresh, stop, load])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!stopCode.trim()) return
    load(stopCode.trim())
  }

  const nowDate = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'long' }).format(new Date())

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-4 space-y-3">
        <label className="block font-medium">מספר תחנה</label>
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            pattern="\d*"
            className="flex-1 border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="למשל 32891"
            value={stopCode}
            onChange={(e) => setStopCode(e.target.value)}
            dir="ltr"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            disabled={status==='loading'}
          >
            חיפוש
          </button>
          
        </div>
        <button
  onClick={() => {
    const name = prompt("תן שם למועדף הזה:");
    if (!name) return;
    const existing = JSON.parse(localStorage.getItem("favorites") || "[]");
    const updated = [...existing, { id: stopId, name }];
    localStorage.setItem("favorites", JSON.stringify(updated));
    alert("נשמר למועדפים!");
  }}
>
  ⭐ שמור למועדפים
</button>

        <div className="flex items-center gap-3 text-sm text-gray-500">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            רענון אוטומטי כל 30 שניות
          </label>
          <span aria-live="polite">{status === 'loading' ? 'טוען…' : ''}</span>
        </div>
      </form>

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
          {error || 'אירעה שגיאה בלתי צפויה'}
        </div>
      )}

      {status === 'success' && stop && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-xl font-bold">
                תחנה {stop.code}{stop.name ? ` · ${stop.name}` : ''}
              </h2>
              <p className="text-gray-500 text-sm">{nowDate}</p>
            </div>
            {(stop.lat && stop.lon) && (
              <a
                className="text-blue-600 hover:underline text-sm"
                target="_blank"
                rel="noreferrer"
                href={`https://www.openstreetmap.org/?mlat=${stop.lat}&mlon=${stop.lon}#map=18/${stop.lat}/${stop.lon}`}
              >
                פתח במפה
              </a>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="bg-white border rounded-2xl p-6 text-center text-gray-500">
              אין הגעות בחלון הזמן הקרוב. נסו לרענן או לבדוק מספר תחנה אחר.
            </div>
          ) : (
            <ul className="grid gap-3">
              {rows.map((row, idx) => {
                const shownIso = row.realtimeIso ?? row.plannedIso!
                const etaMin = computeEtaMinutes(shownIso, null)
                const eta = etaLabel(etaMin)
                const abs = formatLocalHM(shownIso)
                const delay = row.delayMinutes
                  ? (Math.abs(row.delayMinutes) <= 1 ? 'בזמן' : (row.delayMinutes > 0 ? `מאחר ${Math.abs(row.delayMinutes)} דק׳` : `מקדּים ${Math.abs(row.delayMinutes)} דק׳`))
                  : null

                return (
                  <li key={idx} className="bg-white rounded-2xl shadow p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">
                        קו {row.lineLabel} {row.routeLong ? `· ${row.routeLong}` : ''}
                      </div>
                      <div className="text-gray-600">
                        מגיע ב־<span className="font-medium">{abs}</span> <span className="text-gray-400">({eta})</span>
                        {delay && <span className="ml-2 text-sm text-gray-500">· {delay}</span>}
                        {row.realtimeIso && !delay && <span className="ml-2 text-sm text-gray-500">· זמן אמת</span>}
                      </div>
                    </div>
                    {row.updatedAt && (
                      <div className="text-xs text-gray-400">עודכן ב־{formatLocalHM(row.updatedAt)}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
