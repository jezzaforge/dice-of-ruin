import { useState, useEffect } from "react";

export function loadStorage(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
export function saveStorage(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// Hook that syncs state with localStorage
export function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => loadStorage(key, defaultValue));
  useEffect(() => { saveStorage(key, state); }, [key, state]);
  return [state, setState];
}