export interface ColorProfile {
  bg: string;
  border: string;
  text: string;
  badgeBg: string;
  accentStrip: string;
  sub: string;
}

export interface PastelColor {
  bg: string;
  text: string;
  sub: string;
  border?: string;
}

// ─── Varied, Curated Soft Pastel Palette for Light Mode (18 aesthetic shades) ───
// Soft pastel backgrounds with dark charcoal primary text and muted secondary text.
export const LIGHT_PASTEL_PALETTE: PastelColor[] = [
  { bg: '#E6F7ED', text: '#111827', sub: '#4B5563' }, // Soft Mint
  { bg: '#FFEBEA', text: '#111827', sub: '#4B5563' }, // Soft Peach / Blush
  { bg: '#E8ECFE', text: '#111827', sub: '#4B5563' }, // Soft Periwinkle
  { bg: '#FFF0D9', text: '#111827', sub: '#4B5563' }, // Soft Apricot
  { bg: '#E0F2FE', text: '#111827', sub: '#4B5563' }, // Soft Powder Blue
  { bg: '#F3E8FF', text: '#111827', sub: '#4B5563' }, // Soft Lilac
  { bg: '#FEF9C3', text: '#111827', sub: '#4B5563' }, // Soft Buttercream
  { bg: '#CCFBF1', text: '#111827', sub: '#4B5563' }, // Soft Teal
  { bg: '#FCE7F3', text: '#111827', sub: '#4B5563' }, // Soft Rose
  { bg: '#EDE9FE', text: '#111827', sub: '#4B5563' }, // Soft Lavender
  { bg: '#FFEDD5', text: '#111827', sub: '#4B5563' }, // Soft Warm Tangerine
  { bg: '#DCFCE7', text: '#111827', sub: '#4B5563' }, // Soft Sage
  { bg: '#FEE2E2', text: '#111827', sub: '#4B5563' }, // Soft Coral
  { bg: '#E0E7FF', text: '#111827', sub: '#4B5563' }, // Soft Indigo
  { bg: '#FEF3C7', text: '#111827', sub: '#4B5563' }, // Soft Warm Amber
  { bg: '#D1FAE5', text: '#111827', sub: '#4B5563' }, // Soft Celadon
  { bg: '#CFFAFE', text: '#111827', sub: '#4B5563' }, // Soft Cyan / Ice Blue
  { bg: '#F5E6FF', text: '#111827', sub: '#4B5563' }, // Soft Mauve
];

// ─── Luminous Translucent Palette for Dark Mode (18 aesthetic glass tints) ───
// High-contrast, glowing jewel tones that harmonize seamlessly with obsidian surfaces.
export const DARK_PASTEL_PALETTE: PastelColor[] = [
  { bg: 'rgba(16, 185, 129, 0.22)', text: '#6ee7b7', sub: '#a7f3d0', border: 'rgba(110, 231, 183, 0.35)' }, // Soft Mint
  { bg: 'rgba(244, 63, 94, 0.22)', text: '#fda4af', sub: '#fecdd3', border: 'rgba(253, 164, 175, 0.35)' },  // Soft Peach / Blush
  { bg: 'rgba(99, 102, 241, 0.24)', text: '#a5b4fc', sub: '#c7d2fe', border: 'rgba(165, 180, 252, 0.35)' }, // Soft Periwinkle
  { bg: 'rgba(249, 115, 22, 0.22)', text: '#fdba74', sub: '#fed7aa', border: 'rgba(253, 186, 116, 0.35)' }, // Soft Apricot
  { bg: 'rgba(14, 165, 233, 0.22)', text: '#7dd3fc', sub: '#bae6fd', border: 'rgba(125, 211, 252, 0.35)' }, // Soft Powder Blue
  { bg: 'rgba(168, 85, 247, 0.24)', text: '#d8b4fe', sub: '#e9d5ff', border: 'rgba(216, 180, 254, 0.35)' }, // Soft Lilac
  { bg: 'rgba(245, 158, 11, 0.22)', text: '#fcd34d', sub: '#fde68a', border: 'rgba(252, 211, 77, 0.35)' },  // Soft Buttercream
  { bg: 'rgba(20, 184, 166, 0.22)', text: '#5eead4', sub: '#99f6e4', border: 'rgba(94, 234, 212, 0.35)' },  // Soft Teal
  { bg: 'rgba(236, 72, 153, 0.22)', text: '#f472b6', sub: '#fbcfe8', border: 'rgba(244, 114, 182, 0.35)' }, // Soft Rose
  { bg: 'rgba(139, 92, 246, 0.24)', text: '#c4b5fd', sub: '#ddd6fe', border: 'rgba(196, 181, 253, 0.35)' }, // Soft Lavender
  { bg: 'rgba(234, 88, 12, 0.22)', text: '#fdba74', sub: '#fed7aa', border: 'rgba(253, 186, 116, 0.35)' },  // Soft Tangerine
  { bg: 'rgba(34, 197, 94, 0.22)', text: '#86efac', sub: '#bbf7d0', border: 'rgba(134, 239, 172, 0.35)' },  // Soft Sage
  { bg: 'rgba(239, 68, 68, 0.22)', text: '#fca5a5', sub: '#fecaca', border: 'rgba(252, 165, 165, 0.35)' },  // Soft Coral
  { bg: 'rgba(79, 70, 229, 0.26)', text: '#c7d2fe', sub: '#e0e7ff', border: 'rgba(199, 210, 254, 0.35)' }, // Soft Indigo
  { bg: 'rgba(217, 119, 6, 0.22)', text: '#fde68a', sub: '#fef3c7', border: 'rgba(253, 230, 138, 0.35)' }, // Soft Warm Amber
  { bg: 'rgba(5, 150, 105, 0.22)', text: '#a7f3d0', sub: '#d1fae5', border: 'rgba(167, 243, 208, 0.35)' },  // Soft Celadon
  { bg: 'rgba(6, 182, 212, 0.22)', text: '#67e8f9', sub: '#a5f3fc', border: 'rgba(103, 232, 249, 0.35)' },  // Soft Cyan
  { bg: 'rgba(192, 38, 211, 0.22)', text: '#f0abfc', sub: '#fae8ff', border: 'rgba(240, 171, 252, 0.35)' }, // Soft Mauve
];

// Backwards compatibility
export const PASTEL_PALETTE = LIGHT_PASTEL_PALETTE;

/**
 * Checks whether dark mode is currently active in the DOM or localStorage.
 */
export function isDarkMode(): boolean {
  if (typeof document !== 'undefined') {
    return (
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.documentElement.classList.contains('dark') ||
      localStorage.getItem('atlas_theme') === 'dark'
    );
  }
  return false;
}

/**
 * Extracts a standard course code (e.g. "EE325", "HS109") or uses the cleaned formatted title.
 */
export function getCourseCode(title: string): string {
  if (!title) return '';
  const match = title.toUpperCase().match(/[A-Z]{2,5}\s*\d{2,4}[A-Z]?/);
  if (match) {
    return match[0].replace(/\s+/g, '');
  }
  if (title.includes('|')) {
    return title.split('|')[0].trim();
  }
  const clean = title.trim();
  if (clean.length > 14) {
    return clean.slice(0, 12) + '…';
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
  const match = title.toUpperCase().match(/[A-Z]{2,5}\s*\d{2,4}[A-Z]?/);
  if (match) {
    return match[0].replace(/\s+/g, '');
  }
  if (title.includes('|')) {
    return title.split('|')[0].trim();
  }
  const clean = title.trim();
  return clean.length > 14 ? clean.slice(0, 12) + '…' : clean;
}

/**
 * FNV-1a hash function for stable hashing.
 */
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

/**
 * Dynamically assigns each distinct lecture/course its own soft pastel or luminous dark tint
 * from timetable data. Keeps the same color for every occurrence of the same
 * course across reloads and navigation.
 *
 * If `isDark` is provided (e.g. from React useTheme), it uses that. Otherwise
 * checks the active DOM theme dynamically.
 */
export function getPastelColor(
  title: string,
  courseRegistry?: string[],
  isDark?: boolean
): PastelColor {
  const dark = isDark !== undefined ? isDark : isDarkMode();
  const palette = dark ? DARK_PASTEL_PALETTE : LIGHT_PASTEL_PALETTE;
  const code = (getCourseCode(title) || title || 'CLASS').trim().toUpperCase();

  if (courseRegistry && courseRegistry.length > 0) {
    // Sort unique courses to ensure 100% deterministic, collision-free ordering
    const unique = Array.from(new Set(courseRegistry.map(c => (getCourseCode(c) || c).trim().toUpperCase()))).sort();
    const idx = unique.indexOf(code);
    if (idx !== -1) {
      if (idx < palette.length) {
        return palette[idx];
      }
      // Expand palette dynamically when courses exceed the curated list
      const hue = Math.round((idx * 137.5) % 360);
      if (dark) {
        return {
          bg: `hsla(${hue}, 70%, 50%, 0.22)`,
          text: `hsl(${hue}, 85%, 80%)`,
          sub: `hsl(${hue}, 75%, 88%)`,
          border: `hsla(${hue}, 75%, 70%, 0.35)`,
        };
      }
      return {
        bg: `hsl(${hue}, 75%, 93%)`,
        text: '#111827',
        sub: '#4B5563',
        border: 'rgba(0,0,0,0.04)',
      };
    }
  }

  // Stable hash fallback when registry is not available
  const hash = hashString(code);
  return palette[hash % palette.length];
}

/**
 * Legacy ColorProfile bridge for components needing ColorProfile shape.
 * Completely removes vertical accent strips and harsh borders.
 */
export function getDeterministicColor(
  title: string,
  courseRegistry?: string[],
  isDark?: boolean
): ColorProfile {
  const pastel = getPastelColor(title, courseRegistry, isDark);
  return {
    bg: pastel.bg,
    border: pastel.border || 'transparent',
    text: pastel.text,
    badgeBg: pastel.bg,
    accentStrip: 'transparent',
    sub: pastel.sub,
  };
}

/**
 * Returns React inline CSS properties defining CSS variables.
 */
export function getDepartmentColor(title: string, isDark?: boolean): Record<string, string> {
  const pastel = getPastelColor(title, undefined, isDark);
  return {
    '--dept-bg': pastel.bg,
    '--dept-border': pastel.border || 'transparent',
    '--dept-text': pastel.text,
    '--dept-badge-bg': pastel.bg,
    '--dept-badge-text': pastel.text,
    '--dept-accent-strip': 'transparent',
  };
}
