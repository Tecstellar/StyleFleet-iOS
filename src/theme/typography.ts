/**
 * Salon OS Typography Tokens
 * Source of truth: DESIGN_SYSTEM.md and Salon OS.dc.html
 */

export const typography = {
  fontSizes: {
    xs: 11,
    sm: 12.5,
    base: 14,
    md: 15,
    lg: 17,
    xl: 19,
    xxl: 23,
    xxxl: 27,
    display: 35,
  },
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeights: {
    tight: 1.15,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.6,
  },
  letterSpacings: {
    tighter: -0.5,
    tight: -0.2,
    normal: 0,
    wide: 0.5,
    uppercase: 1.1,
  },
};
