export interface ColorProfile {
  bg: string;
  border: string;
  text: string;
  badgeBg: string;
  accentStrip: string;
}

// ─── Department-keyed "Academic Calm" palette ────────────────────────────────
// Muted, low-saturation tones: distinct per department, modern in both light & dark mode.
const DEPT_PALETTE: Record<string, ColorProfile> = {
  // Electrical Engineering — emerald / sage
  EE:  { bg: 'var(--surface)', border: '#10b981', text: '#10b981', badgeBg: 'rgba(16, 185, 129, 0.14)', accentStrip: '#10b981' },
  // Computer Science / CL — indigo / slate blue
  CS:  { bg: 'var(--surface)', border: '#6366f1', text: '#6366f1', badgeBg: 'rgba(99, 102, 241, 0.14)', accentStrip: '#6366f1' },
  CL:  { bg: 'var(--surface)', border: '#6366f1', text: '#6366f1', badgeBg: 'rgba(99, 102, 241, 0.14)', accentStrip: '#6366f1' },
  // Humanities & Social Sciences — rose / coral
  HS:  { bg: 'var(--surface)', border: '#f43f5e', text: '#f43f5e', badgeBg: 'rgba(244, 63, 94, 0.14)', accentStrip: '#f43f5e' },
  // Mathematics — warm amber / ochre
  MA:  { bg: 'var(--surface)', border: '#f59e0b', text: '#d97706', badgeBg: 'rgba(245, 158, 11, 0.14)', accentStrip: '#f59e0b' },
  // Physics — cyan / teal
  PH:  { bg: 'var(--surface)', border: '#06b6d4', text: '#0891b2', badgeBg: 'rgba(6, 182, 212, 0.14)', accentStrip: '#06b6d4' },
  // Mechanical Engineering — orange / terracotta
  ME:  { bg: 'var(--surface)', border: '#f97316', text: '#ea580c', badgeBg: 'rgba(249, 115, 22, 0.14)', accentStrip: '#f97316' },
  // Chemical Engineering — purple / violet
  CH:  { bg: 'var(--surface)', border: '#a855f7', text: '#9333ea', badgeBg: 'rgba(168, 85, 247, 0.14)', accentStrip: '#a855f7' },
  // Aerospace — sky blue
  AE:  { bg: 'var(--surface)', border: '#0284c7', text: '#0284c7', badgeBg: 'rgba(2, 132, 199, 0.14)', accentStrip: '#0284c7' },
  // Civil Engineering — forest green
  CE:  { bg: 'var(--surface)', border: '#059669', text: '#059669', badgeBg: 'rgba(5, 150, 105, 0.14)', accentStrip: '#059669' },
  // Management / Entrepreneurship — warm gold
  MG:  { bg: 'var(--surface)', border: '#d97706', text: '#b45309', badgeBg: 'rgba(217, 119, 6, 0.14)', accentStrip: '#d97706' },
  ENT: { bg: 'var(--surface)', border: '#d97706', text: '#b45309', badgeBg: 'rgba(217, 119, 6, 0.14)', accentStrip: '#d97706' },
  // Technology, Design — fuchsia / mauve
  TD:  { bg: 'var(--surface)', border: '#d946ef', text: '#c026d3', badgeBg: 'rgba(217, 70, 239, 0.14)', accentStrip: '#d946ef' },
};

// Fallback palette for unrecognised dept prefixes
const FALLBACK_PALETTE: ColorProfile[] = [
  { bg: 'var(--surface)', border: '#6366f1', text: '#6366f1', badgeBg: 'rgba(99, 102, 241, 0.14)', accentStrip: '#6366f1' },
  { bg: 'var(--surface)', border: '#10b981', text: '#10b981', badgeBg: 'rgba(16, 185, 129, 0.14)', accentStrip: '#10b981' },
  { bg: 'var(--surface)', border: '#f43f5e', text: '#f43f5e', badgeBg: 'rgba(244, 63, 94, 0.14)', accentStrip: '#f43f5e' },
  { bg: 'var(--surface)', border: '#f59e0b', text: '#d97706', badgeBg: 'rgba(245, 158, 11, 0.14)', accentStrip: '#f59e0b' },
  { bg: 'var(--surface)', border: '#06b6d4', text: '#0891b2', badgeBg: 'rgba(6, 182, 212, 0.14)', accentStrip: '#06b6d4' },
  { bg: 'var(--surface)', border: '#f97316', text: '#ea580c', badgeBg: 'rgba(249, 115, 22, 0.14)', accentStrip: '#f97316' },
  { bg: 'var(--surface)', border: '#a855f7', text: '#9333ea', badgeBg: 'rgba(168, 85, 247, 0.14)', accentStrip: '#a855f7' },
  { bg: 'var(--surface)', border: '#0284c7', text: '#0284c7', badgeBg: 'rgba(2, 132, 199, 0.14)', accentStrip: '#0284c7' },
];


/**
 * Extracts a standard course code (e.g. "EE325", "HS109") or uses the cleaned formatted title.
 */
export function getCourseCode(title: string): string {
  if (!title) return '';
  const match = title.toUpperCase().match(/[A-Z]{2,4}\s*\d{3}[A-Z]?/);
  if (match) {
    return match[0].replace(/\s+/g, '');
  }
  const clean = title.trim();
  if (clean.length > 12) {
    return clean.slice(0, 10) + '…';
  }
  return clean;
}

/**
 * Gets clean short label for Month view pills.
 */
export function getEventShortLabel(title: string, category?: string): string {
  if (category === 'CLASS') {
    return getCourseCode(title);
  }
  const match = title.toUpperCase().match(/[A-Z]{2,4}\s*\d{3}[A-Z]?/);
  if (match) {
    return match[0].replace(/\s+/g, '');
  }
  const clean = title.trim();
  return clean.length > 14 ? clean.slice(0, 12) + '…' : clean;
}

/**
 * Extracts the department prefix from a course code.
 * e.g. "EE325" → "EE", "HS109" → "HS", "ENT620" → "ENT"
 */
export function getDeptPrefix(title: string): string {
  const code = getCourseCode(title).toUpperCase();
  const match = code.match(/^([A-Z]{2,4})\d/);
  return match ? match[1] : '';
}

/**
 * Returns a stable muted "Academic Calm" color profile.
 * First tries dept-keyed lookup; falls back to hash-based muted palette.
 */
export function getDeterministicColor(title: string): ColorProfile {
  const dept = getDeptPrefix(title);
  if (dept && DEPT_PALETTE[dept]) {
    return DEPT_PALETTE[dept];
  }
  // Hash-based fallback for unrecognised departments
  const code = getCourseCode(title) || title || 'default';
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = ((hash * 31) + code.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

/**
 * Returns React inline CSS properties defining --dept-bg, --dept-border, --dept-text variables.
 */
export function getDepartmentColor(title: string): Record<string, string> {
  const profile = getDeterministicColor(title);
  return {
    '--dept-bg': 'var(--surface)',
    '--dept-border': 'var(--border)',
    '--dept-text': 'var(--text-primary)',
    '--dept-badge-bg': profile.badgeBg,
    '--dept-badge-text': profile.text,
    '--dept-accent-strip': profile.accentStrip,
  };
}


