# מתי האוטובוס מגיע? (React + Vite + Tailwind)

אתר קטן שמציג את ההגעות הקרובות לתחנת אוטובוס בישראל לפי **מספר תחנה**, בעזרת OpenBus / Stride.

## הרצה מקומית
```bash
pnpm i
pnpm dev
```
או:
```bash
npm i
npm run dev
```

השרת יעלה על http://localhost:5173

## בנייה ופריסה
```bash
pnpm build
pnpm preview
```
ניתן לפרוס כסטטי ל־Netlify/Vercel/GitHub Pages.

## קובצי מפתח
- `src/components/StopLookup.tsx` – קומפוננטת החיפוש וההצגה
- `src/lib/api.ts` – קריאות ל־OpenBus / Stride
- `src/lib/time.ts` – המרות/פורמט זמן ל־Asia/Jerusalem
- `src/lib/types.ts` – טיפוסים פשוטים
- `App.tsx` – מעטפת העמוד

## הערות
- הקריאות הן ישירות לדומיין של Stride (CORS פתוח לקריאה). אם תיתקלו בחסימת רשת ארגונית, אפשר להגדיר פרוקסי dev של Vite.
- `valid_for_date` מחושב לפי שעון ירושלים, וה־ETA מחושב מהתכנון + סטיית זמן־אמת (אם קיימת).
- כדי לבדוק מהר: נסו מספר תחנה לדוגמה **32891**.

## רישוי
MIT
