const cache = new Map<string, string>();
const colorCache = new Map<string, string>();

/** Liest ein CSS-Token zur Laufzeit, z. B. für die Karte, die keine CSS-Klassen kennt. */
export function token(name: `--${string}`): string {
  const cached = cache.get(name);
  if (cached) return cached;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (value) cache.set(name, value);
  return value;
}

/**
 * Löst ein Farb-Token zu `rgba(…)` auf. Tokens mit `color-mix()` liefert getPropertyValue unaufgelöst;
 * MapLibre versteht nur einfache Farbangaben. Der Browser rechnet die Farbe darum über einen Canvas-Pixel aus.
 */
export function colorToken(name: `--${string}`): string {
  const cached = colorCache.get(name);
  if (cached) return cached;

  const probe = document.createElement('span');
  probe.style.color = `var(${name})`;
  probe.hidden = true;
  document.body.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();

  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!context) return computed;
  context.fillStyle = computed;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  const value = `rgba(${r}, ${g}, ${b}, ${Math.round(((a ?? 255) / 255) * 100) / 100})`;
  colorCache.set(name, value);
  return value;
}
