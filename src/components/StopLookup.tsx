
import React from 'react'
import { fetchStopByCode, fetchPlanned, fetchRealtime, joinPlannedRealtime } from '../lib/api'
import { nowUtcIso, plusMinutesUtcIso, formatLocalHM, computeEtaMinutes, etaLabel, todayJerusalemISODate } from '../lib/time'
import type { Stop, ArrivalJoined } from '../lib/types'
import { useFavorites } from "../favorites/FavoritesContext";

type StopLookupProps = { prefillStop?: string | null };

// --- Local favorites for LINES (separate from station favorites context) ---
const FAVORITE_LINES_KEY = 'favoriteLines';
function loadFavoriteLines(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITE_LINES_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function saveFavoriteLines(s: Set<string>) {
  try {
    localStorage.setItem(FAVORITE_LINES_KEY, JSON.stringify([...s]));
  } catch {}
}

// --- Safe date helpers (defensive UI rendering) ---
function isValidIso(d?: string | null): d is string {
  if (!d) return false;
  return Number.isFinite(Date.parse(d as string));
}

export default function StopLookup({ prefillStop }: StopLookupProps) {
  const [stopCode, setStopCode] = React.useState<string>(() => localStorage.getItem('lastStopCode') || '20269')
  const [stop, setStop] = React.useState<Stop | null>(null)
  const [rows, setRows] = React.useState<ArrivalJoined[]>([])
  const [status, setStatus] = React.useState<'idle'|'loading'|'error'|'success'>('idle')
  const [error, setError] = React.useState<string>('')
  const [autoRefresh, setAutoRefresh] = React.useState<boolean>(true)

  // Line favorites + filter
  const [favoriteLines, setFavoriteLines] = React.useState<Set<string>>(() => loadFavoriteLines());
  const [showFavOnly, setShowFavOnly] = React.useState<boolean>(false);

  // FavoritesContext for stops
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const isStopFavorite = React.useMemo(() => (
    stop?.code ? favorites.some(x => x.id === stop.code) : false
  ), [favorites, stop]);

  const toggleFavoriteLine = React.useCallback((label: string) => {
    setFavoriteLines(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      saveFavoriteLines(next);
      return next;
    });
  }, []);

  // --- Working implementation provided by user (adapted to component state) ---
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

  const onSubmit = React.useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!stopCode.trim()) return;
    await load(stopCode.trim());
  }, [stopCode]); // don't include `load` to avoid TDZ during render

  // Prefill from prop (runs only when prefillStop changes)
  React.useEffect(() => {
    if (prefillStop) {
      setStopCode(prefillStop)
      void load(prefillStop)
    }
  }, [prefillStop, load])

  // Auto refresh every 20s
  React.useEffect(() => {
    if (!autoRefresh || status === 'idle') return
    const id = setInterval(() => {
      if (stopCode) void load(stopCode)
    }, 20000)
    return () => clearInterval(id)
  }, [autoRefresh, stopCode, load, status])

  const visibleRows = React.useMemo(() => {
    const base = showFavOnly ? rows.filter(r => favoriteLines.has(r.lineLabel)) : rows;
    return base;
  }, [rows, showFavOnly, favoriteLines]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input
          value={stopCode}
          onChange={e => setStopCode(e.target.value)}
          placeholder="קוד תחנה (למשל 20269)"
          className="flex-1 px-3 py-2 rounded-xl border border-gray-300"
          dir="ltr"
        />
        <button
          type="submit"
          className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
        >
          חפש
        </button>
        <label className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={e => setAutoRefresh(e.target.checked)}
          />
          רענון אוטומטי
        </label>
      </form>

      {stop && (
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">
            תחנה {stop.code} · {stop.name}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={[
                "px-3 py-1.5 rounded-full text-sm border",
                isStopFavorite ? "bg-green-100 border-green-300" : "bg-gray-50 border-gray-300"
              ].join(" ")}
              onClick={() => {
                if (!stop) return;
                if (isStopFavorite) removeFavorite(stop.code);
                else addFavorite({ id: stop.code, name: stop.name });
              }}
              title={isStopFavorite ? "הסר תחנה מהמועדפים" : "הוסף תחנה למועדפים"}
              aria-pressed={isStopFavorite}
            >
              {isStopFavorite ? "הסר תחנה מהמועדפים" : "הוסף תחנה למועדפים"}
            </button>

            <button
              type="button"
              className={[
                "px-3 py-1.5 rounded-full text-sm border",
                showFavOnly ? "bg-amber-100 border-amber-300" : "bg-gray-50 border-gray-300"
              ].join(' ')}
              onClick={() => setShowFavOnly(v => !v)}
              title={showFavOnly ? "הצג הכל" : "הצג מועדפים בלבד"}
              aria-pressed={showFavOnly}
            >
              {showFavOnly ? "הצג הכל" : "הצג מועדפים בלבד ⭐"}
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {status === 'loading' && (
        <div className="p-3 rounded-xl bg-gray-50 text-gray-600 border border-gray-200">
          טוען נתונים...
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-3">
          {visibleRows.length === 0 ? (
            <div className="p-3 rounded-xl bg-gray-50 text-gray-600 border border-gray-200">
              {showFavOnly ? "אין הגעות לקווים המועדפים בתחנה זו כעת." : "אין הגעות קרובות."}
            </div>
          ) : (
            <ul className="space-y-3">
              {visibleRows.map((row, idx) => {
                const shownIso = row.realtimeIso ?? row.plannedIso ?? null;
                const etaMin = isValidIso(shownIso) ? computeEtaMinutes(shownIso as string, null) : null;
                const eta = (etaMin !== null) ? etaLabel(etaMin) : '—';
                const abs = isValidIso(shownIso) ? formatLocalHM(shownIso as string) : '—';
                const delay = row.delayMinutes
                  ? (Math.abs(row.delayMinutes) <= 1 ? 'בזמן' : (row.delayMinutes > 0 ? `מאחר ${Math.abs(row.delayMinutes)} דק׳` : `מקדּים ${Math.abs(row.delayMinutes)} דק׳`))
                  : null;

                const label = row.lineLabel;
                const isFav = favoriteLines.has(label);

                return (
                  <li
                    key={idx}
                    className={[
                      "rounded-2xl p-4 flex items-center justify-between border transition-shadow",
                      isFav ? "bg-amber-50 border-amber-300 ring-2 ring-amber-300 shadow" : "bg-white shadow"
                    ].join(' ')}
                  >
                    <div className="space-y-1">
                      <div className="text-lg font-semibold flex items-center gap-2">
                        <span className={isFav ? "text-amber-800" : ""}>
                          קו {label} {row.routeLong ? `· ${row.routeLong}` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleFavoriteLine(label)}
                          className={[
                            "ml-1 px-2 py-1 rounded-lg text-sm",
                            isFav ? "bg-amber-200 hover:bg-amber-300" : "bg-gray-100 hover:bg-gray-200"
                          ].join(' ')}
                          title={isFav ? "הסר מהמועדפים" : "הוסף למועדפים"}
                          aria-label={isFav ? "הסר מהמועדפים" : "הוסף למועדפים"}
                        >
                          {isFav ? "⭐" : "☆"}
                        </button>
                      </div>
                      <div className="text-gray-600">
                        מגיע ב־<span className="font-medium">{abs}</span> <span className="text-gray-400">({eta})</span>
                        {delay && <span className="ml-2 text-sm text-gray-500">· {delay}</span>}
                        {row.realtimeIso && !delay && <span className="ml-2 text-sm text-gray-500">· זמן אמת</span>}
                      </div>
                    </div>

                    {isValidIso(row.updatedAt) && (
                      <div className="text-xs text-gray-400">עודכן ב־{formatLocalHM(row.updatedAt as string)}</div>
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
