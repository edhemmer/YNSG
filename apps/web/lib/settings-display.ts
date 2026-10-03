// Presentation only: canonical configuration stays in integer minutes.
export function clockLabel(minutes: number): string {
  if (minutes === 1440) return 'Midnight (end of day)';
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
export function clockOptions(current: number, endOfDay = false): number[] {
  const options = Array.from({ length: endOfDay ? 49 : 48 }, (_, i) => i * 30);
  // Keep an existing custom time; do not silently round published configuration.
  return [...new Set([...options, current])].sort((a, b) => a - b);
}
