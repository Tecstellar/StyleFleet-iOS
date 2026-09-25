import { buildPalette, DEFAULT_ACCENT, ACCENT_SWATCHES } from '../src/theme/colors';

describe('Theme and Accent Color Calculations', () => {
  it('generates the default Nocturne palette matching design system', () => {
    const palette = buildPalette(DEFAULT_ACCENT);

    expect(palette.bg).toBe('#161826');
    expect(palette.surface).toBe('#1E2136');
    expect(palette.divider).toBe('#2D3154');
    expect(palette.text).toBe('#FFFFFF');
    expect(palette.accent.toUpperCase()).toBe('#D9A441');
    expect(palette.accent100).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(palette.accent800).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('generates customized palettes for all prototype accent swatches', () => {
    ACCENT_SWATCHES.forEach((swatch) => {
      const palette = buildPalette(swatch);
      expect(palette.accent.toUpperCase()).toBe(swatch.toUpperCase());
      expect(palette.accent100).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(palette.accent200).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(palette.accent700).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(palette.accent800).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(palette.accent900).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});
