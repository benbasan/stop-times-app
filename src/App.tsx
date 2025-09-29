// App.tsx
import React, { useState } from "react";
import StopLookup from "./components/StopLookup";
import Favorites from "./components/Favorites";
import { FavoritesProvider } from "./favorites/FavoritesContext";

export default function App() {
  const [selectedStop, setSelectedStop] = useState<string | null>(null);

  return (
    <FavoritesProvider>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold">מתי האוטובוס מגיע?</h1>
            <p className="text-gray-500">הקלד/י מספר תחנה וקבל/י את ההגעות הקרובות</p>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          <Favorites onSelect={(id) => setSelectedStop(id)} />
          <StopLookup prefillStop={selectedStop ?? undefined} />
        </main>
        <footer className="text-center text-sm text-gray-400 py-8">
          מבוסס על OpenBus / Stride · נתוני משרד התחבורה
        </footer>
      </div>
    </FavoritesProvider>
  );
}
