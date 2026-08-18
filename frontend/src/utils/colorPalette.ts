export interface ColorProfile {
  bg: string;
  border: string;
  text: string;
  badgeBg: string;
  accentStrip: string;
}

// ─── Department-keyed "Academic Calm" palette ────────────────────────────────
// Muted, low-saturation tones: distinct per department, never punchy.
const DEPT_PALETTE: Record<string, ColorProfile> = {
  // Electrical Engineering — sage green
  EE:  { bg: '#f4f7f4', border: '#7a9e7e', text: '#3d6b42', badgeBg: '#dceadd', accentStrip: '#7a9e7e' },
  // Computer Science / CL — slate blue
  CS:  { bg: '#f4f5f9', border: '#7986ae', text: '#3a4a77', badgeBg: '#dde1f0', accentStrip: '#7986ae' },
  CL:  { bg: '#f4f5f9', border: '#7986ae', text: '#3a4a77', badgeBg: '#dde1f0', accentStrip: '#7986ae' },
  // Humanities & Social Sciences — dusty rose
  HS:  { bg: '#f9f4f4', border: '#b98080', text: '#7a3f3f', badgeBg: '#eedcdc', accentStrip: '#b98080' },
  // Mathematics — warm sand / ochre
  MA:  { bg: '#f8f6f1', border: '#b5a06a', text: '#735e28', badgeBg: '#ede5cc', accentStrip: '#b5a06a' },
  // Physics — dusty teal
  PH:  { bg: '#f2f7f7', border: '#6a9e9e', text: '#2e6565', badgeBg: '#d5e9e9', accentStrip: '#6a9e9e' },
  // Mechanical Engineering — warm terracotta
  ME:  { bg: '#f8f4f1', border: '#b08060', text: '#7a4a28', badgeBg: '#edddd2', accentStrip: '#b08060' },
  // Chemical Engineering — muted lavender
  CH:  { bg: '#f5f4f8', border: '#9490b8', text: '#4e4878', badgeBg: '#e2e1f0', accentStrip: '#9490b8' },
  // Aerospace — cool steel
  AE:  { bg: '#f3f5f7', border: '#7a95a8', text: '#2e5166', badgeBg: '#d8e4ec', accentStrip: '#7a95a8' },
  // Civil Engineering — muted olive
  CE:  { bg: '#f5f7f2', border: '#8fa86a', text: '#4a6228', badgeBg: '#e3ecda', accentStrip: '#8fa86a' },
  // Management / Entrepreneurship — warm amber-grey
  MG:  { bg: '#f8f6f2', border: '#a89870', text: '#6b5828', badgeBg: '#ece5d4', accentStrip: '#a89870' },
  ENT: { bg: '#f8f6f2', border: '#a89870', text: '#6b5828', badgeBg: '#ece5d4', accentStrip: '#a89870' },
  // Technology, Design — muted mauve
  TD:  { bg: '#f7f4f7', border: '#a888a8', text: '#6a3e6a', badgeBg: '#eadaea', accentStrip: '#a888a8' },
};

// Fallback palette for unrecognised dept prefixes
const FALLBACK_PALETTE: ColorProfile[] = [
  { bg: '#f4f5f9', border: '#7986ae', text: '#3a4a77', badgeBg: '#dde1f0', accentStrip: '#7986ae' },
  { bg: '#f4f7f4', border: '#7a9e7e', text: '#3d6b42', badgeBg: '#dceadd', accentStrip: '#7a9e7e' },
  { bg: '#f9f4f4', border: '#b98080', text: '#7a3f3f', badgeBg: '#eedcdc', accentStrip: '#b98080' },
  { bg: '#f8f6f1', border: '#b5a06a', text: '#735e28', badgeBg: '#ede5cc', accentStrip: '#b5a06a' },
  { bg: '#f2f7f7', border: '#6a9e9e', text: '#2e6565', badgeBg: '#d5e9e9', accentStrip: '#6a9e9e' },
  { bg: '#f8f4f1', border: '#b08060', text: '#7a4a28', badgeBg: '#edddd2', accentStrip: '#b08060' },
  { bg: '#f5f4f8', border: '#9490b8', text: '#4e4878', badgeBg: '#e2e1f0', accentStrip: '#9490b8' },
  { bg: '#f3f5f7', border: '#7a95a8', text: '#2e5166', badgeBg: '#d8e4ec', accentStrip: '#7a95a8' },
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
    '--dept-bg': profile.bg,
    '--dept-border': profile.border,
    '--dept-text': profile.text,
    '--dept-badge-bg': profile.badgeBg,
    '--dept-accent-strip': profile.accentStrip,
  };
}

