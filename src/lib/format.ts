/** Small display helpers shared across screens. Presentation only. */

export function initialsOf(name: string | null | undefined): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "Wednesday, Aug 26" — the mockup's eyebrow line. */
export function longDate(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/** "7:02 AM" */
export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "Today, 7:02 AM" / "Yesterday, 5:14 PM" / "Aug 24, 5:14 PM" */
export function relativeStamp(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const sameDay = then.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = then.toDateString() === yesterday.toDateString();

  if (sameDay) return `Today, ${timeOfDay(iso)}`;
  if (isYesterday) return `Yesterday, ${timeOfDay(iso)}`;
  return `${then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${timeOfDay(iso)}`;
}

/** "Aug 28" — for leave date ranges. */
export function shortDate(dateOnly: string): string {
  // date columns come back as YYYY-MM-DD; parse as local, not UTC, so the
  // displayed day doesn't shift backwards in negative-offset timezones.
  const [y, m, d] = dateOnly.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function dateRange(from: string, to: string): string {
  return from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`;
}

/** Philippine peso, the currency used throughout the mockup. */
export function peso(amount: number): string {
  return `₱${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function coords(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return 'No GPS captured';
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lng).toFixed(4)}°${ew}`;
}

/** YYYY-MM-DD in local time, for date columns. */
export function toDateColumn(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The semi-monthly cutoff (1st–15th, 16th–end of month) that the attendance
 * screens have always used. `cutoffFor` below generalises this to whatever
 * cadence HR/Admin has configured; this stays as the default.
 */
export function currentCutoff(now: Date = new Date()): { start: Date; end: Date; label: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const firstHalf = now.getDate() <= 15;
  const start = firstHalf ? new Date(y, m, 1) : new Date(y, m, 16);
  const end = firstHalf ? new Date(y, m, 15, 23, 59, 59) : new Date(y, m + 1, 0, 23, 59, 59);
  const monthName = start.toLocaleDateString(undefined, { month: 'short' });
  return {
    start,
    end,
    label: `${monthName} ${start.getDate()}–${end.getDate()}`,
  };
}

/**
 * The current cutoff window for a configured cadence. Weekly runs Monday to
 * Sunday; semi-monthly and monthly follow the calendar. Used by the worker's
 * running estimate and to pre-fill the HR/Admin run generator's date range —
 * the payroll engine itself takes explicit dates, so this is only a default.
 */
export function cutoffFor(
  cutoffType: 'weekly' | 'semi_monthly' | 'monthly',
  now: Date = new Date()
): { start: Date; end: Date; label: string } {
  if (cutoffType === 'semi_monthly') return currentCutoff(now);

  const y = now.getFullYear();
  const m = now.getMonth();

  if (cutoffType === 'monthly') {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59);
    return {
      start,
      end,
      label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    };
  }

  // Weekly: back up to Monday, forward to Sunday.
  const dow = now.getDay(); // 0 = Sunday
  const backToMonday = dow === 0 ? 6 : dow - 1;
  const start = new Date(y, m, now.getDate() - backToMonday);
  const end = new Date(y, m, now.getDate() - backToMonday + 6, 23, 59, 59);
  return { start, end, label: `${shortDate(toDateColumn(start))} – ${shortDate(toDateColumn(end))}` };
}

/** "72.5 h" — hour figures on the payroll grids. */
export function hours(value: number): string {
  const n = Number(value);
  return `${Number.isInteger(n) ? n : n.toFixed(2)} h`;
}

/** "Aug 1 – Aug 15" for a payroll run's period, from its two date columns. */
export function periodLabel(from: string, to: string): string {
  return `${shortDate(from)} – ${shortDate(to)}`;
}
