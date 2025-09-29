import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Favorite = { id: string; name: string };
type Ctx = {
  favorites: Favorite[];
  addFavorite: (fav: Favorite) => void;
  removeFavorite: (id: string) => void;
};

const FavoritesContext = createContext<Ctx | null>(null);
const KEY = "favorites";

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  // טען מהמקום המקומי בעת עלייה
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
  }, []);

  // שמירה מתמשכת
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  // סנכרון בין טאבים/חלונות (אופציונלי)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try { setFavorites(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<Ctx>(() => ({
    favorites,
    addFavorite: (fav) => {
      setFavorites((prev) => {
        if (prev.some((x) => x.id === fav.id)) return prev; // לא להוסיף כפולים
        return [...prev, fav];
      });
    },
    removeFavorite: (id) => setFavorites((prev) => prev.filter((x) => x.id !== id)),
  }), [favorites]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
