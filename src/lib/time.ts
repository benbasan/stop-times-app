const JERUSALEM_TZ = 'Asia/Jerusalem';
export function nowUtcIso(): string { return new Date().toISOString(); }
export function plusMinutesUtcIso(mins: number): string { return new Date(Date.now() + mins * 60000).toISOString(); }
export function computeEtaMinutes(targetIso: string, nowIso?: string | null): number { const now = nowIso ? new Date(nowIso) : new Date(); return Math.round((new Date(targetIso).getTime() - now.getTime()) / 60000); }
export function etaLabel(mins: number): string { if (mins <= 0) return 'כמעט עכשיו'; if (mins === 1) return 'דקה'; if (mins < 60) return `${mins} דק׳`; const h = Math.floor(mins / 60), m = mins % 60; return `${h}:${String(m).padStart(2,'0')} שע׳`; }
export function formatLocalHM(iso: string): string { const d = new Date(iso); return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: JERUSALEM_TZ }); }
export function todayJerusalemISODate(): string { const now = new Date(); const tzDate = now.toLocaleDateString('en-CA', { timeZone: JERUSALEM_TZ }); return tzDate; }