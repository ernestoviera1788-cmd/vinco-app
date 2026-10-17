/** VINCÓ design tokens — one place for colors, spacing and type scale. */

export const colors = {
  // Brand
  plum900: '#1a0b14',
  plum800: '#2b1220',
  plum700: '#3d1a2c',
  rose600: '#c22b5c',
  rose500: '#e0447c',
  rose400: '#ff5c8a',
  rose100: '#ffd9e6',
  gold: '#f5b942',
  // Surfaces
  background: '#fff8fb',
  card: '#ffffff',
  cardDark: '#241019',
  // Text
  ink: '#2b1220',
  inkSoft: '#6b4a5c',
  inkFaint: '#a08090',
  onDark: '#fff5f8',
  // States
  success: '#1e9e6a',
  danger: '#d92d4e',
  warning: '#b97a0c',
  warningBg: '#fdf3dd',
  infoBg: '#eef2ff',
  border: '#f0dbe4',
  overlay: 'rgba(26, 11, 20, 0.55)',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

export const type = {
  hero: 34,
  title: 24,
  subtitle: 18,
  body: 16,
  small: 14,
  caption: 12,
} as const;
