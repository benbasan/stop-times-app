import React from "react";
import { useFavorites } from "../favorites/FavoritesContext";

export default function Favorites({ onSelect }: { onSelect: (id: string) => void }) {
  const { favorites, removeFavorite } = useFavorites();

  return (
    <div className="space-y-2">
      <h2 className="font-semibold">מועדפים</h2>
      {favorites.length === 0 && <p className="text-gray-500">אין עדיין מועדפים</p>}
      <ul className="space-y-1">
        {favorites.map(f => (
          <li key={f.id} className="flex justify-between items-center bg-white p-2 rounded shadow">
            <button onClick={() => onSelect(f.id)} className="text-blue-600 hover:underline">
              {f.name} ({f.id})
            </button>
            <button onClick={() => removeFavorite(f.id)} className="text-red-500 text-sm">✕</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
