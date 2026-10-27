const cache = new Map<string, string>();

/** Liest ein CSS-Token zur Laufzeit, z. B. für die Canvas-Marker der Karte, die keine CSS-Klassen kennen. */
export function token(name: `--${string}`): string {
  const cached = cache.get(name);
  if (cached) return cached;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (value) cache.set(name, value);
  return value;
}
