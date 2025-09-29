import React from 'react';
import { fetchStopByCode, fetchPlanned, fetchRealtime, joinPlannedRealtime } from './lib/api';
import { nowUtcIso, plusMinutesUtcIso, formatLocalHM, computeEtaMinutes, etaLabel, todayJerusalemISODate } from './lib/time';
import type { Stop, ArrivalJoined } from './lib/types';

const FAV_KEY='favorites';
type Favorite={id:string;code:string;name:string};
const readFavorites=():Favorite[]=>{try{return JSON.parse(localStorage.getItem(FAV_KEY)||'[]')}catch{return[]}};
const writeFavorites=(f:Favorite[])=>localStorage.setItem(FAV_KEY,JSON.stringify(f));
const upsertFavorite=(f:Favorite)=>{const a=readFavorites();const i=a.findIndex(x=>x.id===f.id);if(i>=0)a[i]=f;else a.push(f);writeFavorites(a)};
const removeFavorite=(id:string)=>writeFavorites(readFavorites().filter(x=>x.id!==id));

function DelayBadge({minutes}:{minutes:number|null|undefined}){
  if(minutes==null)return null;const abs=Math.abs(minutes);
  if(abs<=1)return <span className="ml-2 inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">בזמן</span>;
  if(minutes>0)return <span className="ml-2 inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-800 border border-yellow-200">מאחר {abs} דק׳</span>;
  return <span className="ml-2 inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">מקדּים {abs} דק׳</span>;
}

function Favorites({onSelect,currentStopId}:{onSelect:(f:Favorite)=>void;currentStopId?:string|null;}){
  const [items,setItems]=React.useState<Favorite[]>(()=>readFavorites());const refresh=React.useCallback(()=>setItems(readFavorites()),[]);
  React.useEffect(()=>{const onStorage=(e:StorageEvent)=>{if(e.key===FAV_KEY)refresh()};window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage)},[refresh]);
  if(!items.length)return <div className="text-sm text-gray-500">אין מועדפים עדיין. חפשו תחנה ושמרו אותה ⭐</div>;
  return <ul className="space-y-2">{items.map(f=>(<li key={f.id} className={`group flex items-center justify-between rounded-xl border p-2 hover:bg-gray-50 ${currentStopId===f.id?'border-blue-300 bg-blue-50':''}`}>
    <button className="text-right flex-1" onClick={()=>onSelect(f)} title={`פתח תחנה ${f.code}`}><div className="font-medium">{f.name||`תחנה ${f.code}`}</div><div className="text-xs text-gray-500">#{f.code}</div></button>
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button className="text-xs px-2 py-1 rounded-lg border hover:bg-white" onClick={()=>{const name=prompt('שם חדש למועדף:',f.name);if(!name)return;upsertFavorite({...f,name});refresh()}}>ערוך</button>
      <button className="text-xs px-2 py-1 rounded-lg border hover:bg-white text-red-600" onClick={()=>{if(!confirm('למחוק מהמועדפים?'))return;removeFavorite(f.id);refresh()}}>מחק</button>
    </div></li>))}</ul>;
}

export default function StopTimesApp(){
  const [stopCode,setStopCode]=React.useState<string>(()=>new URLSearchParams(location.search).get('stop')||localStorage.getItem('lastStopCode')||'20269');
  const [stop,setStop]=React.useState<Stop|null>(null);
  const [rows,setRows]=React.useState<ArrivalJoined[]>([]);
  const [status,setStatus]=React.useState<'idle'|'loading'|'error'|'success'>('idle');
  const [error,setError]=React.useState<string>('');
  const [autoRefresh,setAutoRefresh]=React.useState<boolean>(true);
  const nowDate=new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',dateStyle:'long'}).format(new Date());

  const load=React.useCallback(async(code:string)=>{try{
    setStatus('loading');setError('');const dateISO=todayJerusalemISODate();const s=await fetchStopByCode(code,dateISO);setStop(s);
    const from=nowUtcIso(), to=plusMinutesUtcIso(60);const [planned,rt]=await Promise.all([fetchPlanned(s.id,dateISO,from,to),fetchRealtime(s.id,from,to)]);
    const joined=joinPlannedRealtime(planned,rt).slice(0,12);setRows(joined);setStatus('success');localStorage.setItem('lastStopCode',code);
    const params=new URLSearchParams(location.search);params.set('stop',code);history.replaceState(null,'',`?${params.toString()}`);
  }catch(e:any){setStatus('error');setError(e?.message||'אירעה שגיאה')}},[]);

  React.useEffect(()=>{let t:any;if(status==='success'&&autoRefresh&&stop){t=setInterval(()=>load(stop.code),30_000)}return()=>clearInterval(t)},[status,autoRefresh,stop,load]);
  React.useEffect(()=>{const q=new URLSearchParams(location.search).get('stop');if(q)load(q)},[]);

  const onSubmit=(e:React.FormEvent)=>{e.preventDefault();if(!stopCode.trim())return;load(stopCode.trim())};
  const canFavorite=Boolean(stop?.id&&stop?.code);
  const addFavorite=()=>{if(!canFavorite||!stop)return;const name=prompt('תן שם למועדף הזה:',stop.name||`תחנה ${stop.code}`);if(!name)return;upsertFavorite({id:stop.id,code:stop.code,name});alert('נשמר למועדפים!')};

  return (<div className="mx-auto max-w-5xl p-4 md:p-6">
    <header className="flex items-center justify-between mb-4"><h1 className="text-2xl md:text-3xl font-bold">🚌 זמני אוטובוס בתחנה</h1><div className="text-sm text-gray-500">{nowDate}</div></header>
    <div className="grid md:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-4 space-y-3">
          <label className="block font-medium">מספר תחנה</label>
          <div className="flex gap-2">
            <input inputMode="numeric" pattern="\d*" className="flex-1 border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder="למשל 32891" value={stopCode} onChange={e=>setStopCode(e.target.value)} dir="ltr" />
            <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50" disabled={status==='loading'}>חיפוש</button>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)} />רענון אוטומטי כל 30 שניות</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={()=>stopCode&&load(stopCode)} className="text-sm px-3 py-1 rounded-lg border hover:bg-white">רענן עכשיו</button>
              <button type="button" onClick={addFavorite} disabled={!canFavorite} className="text-sm px-3 py-1 rounded-lg border hover:bg-white disabled:opacity-50">⭐ שמור למועדפים</button>
            </div>
          </div>
          <div className="text-sm text-gray-500" aria-live="polite">{status==='loading'?'טוען…':''}</div>
        </form>

        {status==='error'&&<div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">{error||'אירעה שגיאה בלתי צפויה'}</div>}
        {status==='success'&&stop&&(<div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <div><h2 className="text-xl font-bold">תחנה {stop.code}{stop.name?` · ${stop.name}`:''}</h2>{stop.city?<div className="text-gray-500 text-sm">{stop.city}</div>:null}</div>
            {stop.lat&&stop.lon?(<a className="text-blue-600 hover:underline text-sm" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${stop.lat}&mlon=${stop.lon}#map=18/${stop.lat}/${stop.lon}`}>פתח במפה</a>):null}
          </div>
          {rows.length===0?(<div className="bg-white border rounded-2xl p-6 text-center text-gray-500">אין הגעות בחלון הזמן הקרוב. נסו לרענן או לבדוק מספר תחנה אחר.</div>):(
            <ul className="grid gap-3">
              {rows.map((row,idx)=>{const shownIso=row.realtimeIso??row.plannedIso!;const etaMin=computeEtaMinutes(shownIso,null);const eta=etaLabel(etaMin);const abs=formatLocalHM(shownIso);
                return (<li key={idx} className="bg-white rounded-2xl shadow p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">קו {row.lineLabel} {row.routeLong?`· ${row.routeLong}`:''}</div>
                    <div className="text-gray-600">מגיע ב־<span className="font-medium">{abs}</span> <span className="text-gray-400">({eta})</span>{row.realtimeIso&&<span className="ml-2 text-sm text-gray-500">· זמן אמת</span>}<DelayBadge minutes={row.delayMinutes??null} /></div>
                  </div>
                  {row.updatedAt&&<div className="text-xs text-gray-400">עודכן ב־{formatLocalHM(row.updatedAt)}</div>}
                </li>)})
              }
            </ul>)}
        </div>)}
      </div>
      <aside className="space-y-3">
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between mb-2"><h3 className="font-semibold">מועדפים</h3>{stop?.id&&(<button className="text-xs px-2 py-1 rounded-lg border hover:bg-white" onClick={addFavorite}>➕ הוסף נוכחי</button>)}</div>
          <Favorites currentStopId={stop?.id} onSelect={(fav)=>{setStopCode(fav.code);load(fav.code);}} />
        </div>
        <div className="bg-white rounded-2xl shadow p-4 text-sm text-gray-600">
          <div className="font-medium mb-1">טיפים</div>
          <ul className="list-disc pr-5 space-y-1"><li>אפשר לפתוח עם קישור ישיר: ‎?stop=20269</li><li>רענון אוטומטי פועל רק אחרי חיפוש מוצלח</li><li>שם המועדף ניתן לעריכה בכל רגע</li></ul>
        </div>
      </aside>
    </div>
  </div>);
}