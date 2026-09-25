/**
 * Salon OS Design System Color Tokens
 * Source of truth: Salon OS.dc.html and DESIGN_SYSTEM.md
 */

export const DEFAULT_ACCENT = '#D9A441';

export const ACCENT_SWATCHES = [
  '#D9A441',
  '#E0C068',
  '#B8863B',
  '#8C6239',
] as const;

export type AccentColor = (typeof ACCENT_SWATCHES)[number] | string;

export interface ColorPalette {
  bg: string;
  surface: string;
  divider: string;
  text: string;
  textMuted: string;
  textDim: string;
  textSubtle: string;
  accent: string;
  accent100: string;
  accent200: string;
  accent300: string;
  accent600: string;
  accent700: string;
  accent800: string;
  accent900: string;
  neutral200: string;
  neutral400: string;
  neutral600: string;
  neutral700: string;
  neutral800: string;
  neutral900: string;
  error: string;
  success: string;
}

/**
 * Mix two hex colors by percentage (0 to 1)
 */
function mixColors(color1: string, color2: string, weight: number): string {
  const c1 = color1.replace('#', '');
  const c2 = color2.replace('#', '');

  const r1 = parseInt(c1.substring(0, 2), 16);
  const g1 = parseInt(c1.substring(2, 4), 16);
  const b1 = parseInt(c1.substring(4, 6), 16);

  const r2 = parseInt(c2.substring(0, 2), 16);
  const g2 = parseInt(c2.substring(2, 4), 16);
  const b2 = parseInt(c2.substring(4, 6), 16);

  const r = Math.round(r1 * weight + r2 * (1 - weight));
  const g = Math.round(g1 * weight + g2 * (1 - weight));
  const b = Math.round(b1 * weight + b2 * (1 - weight));

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function buildPalette(accent: string = DEFAULT_ACCENT): ColorPalette {
  const normAccent = accent.startsWith('#') ? accent : `#${accent}`;

  return {
    bg: '#161826',
    surface: '#1E2136',
    divider: '#2D3154',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.68)',
    textDim: 'rgba(255, 255, 255, 0.50)',
    textSubtle: 'rgba(255, 255, 255, 0.38)',
    accent: normAccent,
    // Accent tints mixed with #F6F5FF
    accent100: mixColors(normAccent, '#F6F5FF', 0.22),
    accent200: mixColors(normAccent, '#F6F5FF', 0.45),
    accent300: mixColors(normAccent, '#F6F5FF', 0.72),
    // Accent shades mixed with #161826
    accent600: mixColors(normAccent, '#161826', 0.80),
    accent700: mixColors(normAccent, '#161826', 0.62),
    accent800: mixColors(normAccent, '#161826', 0.38),
    accent900: mixColors(normAccent, '#161826', 0.20),
    // Neutrals
    neutral200: '#E2E8F0',
    neutral400: '#94A3B8',
    neutral600: '#475569',
    neutral700: '#334155',
    neutral800: '#1E293B',
    neutral900: '#0F172A',
    error: '#EF4444',
    success: '#10B981',
  };
}
