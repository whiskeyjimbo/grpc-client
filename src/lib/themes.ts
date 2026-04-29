/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Palette {
  id: string;
  name: string;
  shortName: string;
  swatch: string;
  vars: Record<string, string>;
}

export const PALETTES: Palette[] = [
  {
    id: 'amber', name: 'Amber', shortName: 'AMB', swatch: 'oklch(76% 0.155 65)',
    vars: {
      '--color-background': 'oklch(22% 0.010 62)', '--color-surface-dim': 'oklch(22% 0.010 62)',
      '--color-surface-bright': 'oklch(46% 0.022 62)', '--color-surface-container-lowest': 'oklch(18% 0.008 62)',
      '--color-surface-container-low': 'oklch(27% 0.014 62)', '--color-surface-container': 'oklch(31% 0.016 62)',
      '--color-surface-container-high': 'oklch(35% 0.018 62)', '--color-surface-container-highest': 'oklch(40% 0.020 62)',
      '--color-on-surface': 'oklch(93% 0.012 65)', '--color-on-surface-variant': 'oklch(76% 0.011 65)',
      '--color-inverse-surface': 'oklch(93% 0.012 65)', '--color-inverse-on-surface': 'oklch(28% 0.012 65)',
      '--color-outline': 'oklch(58% 0.015 65)', '--color-outline-variant': 'oklch(42% 0.015 65)',
      '--color-primary': 'oklch(76% 0.155 65)', '--color-on-primary': 'oklch(12% 0.05 65)',
      '--color-primary-container': 'oklch(52% 0.14 65)', '--color-on-primary-container': 'oklch(10% 0.04 65)',
      '--color-secondary': 'oklch(62% 0.085 163)', '--color-on-secondary': 'oklch(12% 0.04 163)',
      '--color-secondary-container': 'oklch(43% 0.070 163)', '--color-on-secondary-container': 'oklch(10% 0.03 163)',
      '--color-tertiary': 'oklch(62% 0.082 76)', '--color-on-tertiary': 'oklch(12% 0.04 76)',
      '--color-success': 'oklch(66% 0.125 152)', '--color-warning': 'oklch(82% 0.140 88)',
      '--color-error': 'oklch(68% 0.180 25)', '--color-error-container': 'oklch(26% 0.090 25)',
    },
  },
  {
    id: 'phosphor', name: 'Phosphor', shortName: 'PHO', swatch: 'oklch(70% 0.185 142)',
    vars: {
      '--color-background': 'oklch(17% 0.012 142)', '--color-surface-dim': 'oklch(17% 0.012 142)',
      '--color-surface-bright': 'oklch(44% 0.025 142)', '--color-surface-container-lowest': 'oklch(13% 0.008 142)',
      '--color-surface-container-low': 'oklch(22% 0.016 142)', '--color-surface-container': 'oklch(26% 0.018 142)',
      '--color-surface-container-high': 'oklch(30% 0.020 142)', '--color-surface-container-highest': 'oklch(35% 0.023 142)',
      '--color-on-surface': 'oklch(90% 0.020 142)', '--color-on-surface-variant': 'oklch(72% 0.018 142)',
      '--color-inverse-surface': 'oklch(90% 0.020 142)', '--color-inverse-on-surface': 'oklch(22% 0.016 142)',
      '--color-outline': 'oklch(50% 0.022 142)', '--color-outline-variant': 'oklch(36% 0.022 142)',
      '--color-primary': 'oklch(70% 0.185 142)', '--color-on-primary': 'oklch(10% 0.04 142)',
      '--color-primary-container': 'oklch(46% 0.160 142)', '--color-on-primary-container': 'oklch(10% 0.03 142)',
      '--color-secondary': 'oklch(58% 0.070 188)', '--color-on-secondary': 'oklch(10% 0.03 188)',
      '--color-secondary-container': 'oklch(38% 0.058 188)', '--color-on-secondary-container': 'oklch(10% 0.02 188)',
      '--color-tertiary': 'oklch(60% 0.080 76)', '--color-on-tertiary': 'oklch(10% 0.04 76)',
      '--color-success': 'oklch(64% 0.120 195)', '--color-warning': 'oklch(82% 0.140 80)',
      '--color-error': 'oklch(68% 0.180 25)', '--color-error-container': 'oklch(22% 0.090 25)',
    },
  },
  {
    id: 'steel', name: 'Steel', shortName: 'STL', swatch: 'oklch(72% 0.128 252)',
    vars: {
      '--color-background': 'oklch(19% 0.014 250)', '--color-surface-dim': 'oklch(19% 0.014 250)',
      '--color-surface-bright': 'oklch(44% 0.026 250)', '--color-surface-container-lowest': 'oklch(15% 0.010 250)',
      '--color-surface-container-low': 'oklch(24% 0.017 250)', '--color-surface-container': 'oklch(28% 0.019 250)',
      '--color-surface-container-high': 'oklch(32% 0.021 250)', '--color-surface-container-highest': 'oklch(37% 0.023 250)',
      '--color-on-surface': 'oklch(92% 0.010 252)', '--color-on-surface-variant': 'oklch(74% 0.010 252)',
      '--color-inverse-surface': 'oklch(92% 0.010 252)', '--color-inverse-on-surface': 'oklch(24% 0.014 252)',
      '--color-outline': 'oklch(54% 0.016 252)', '--color-outline-variant': 'oklch(40% 0.016 252)',
      '--color-primary': 'oklch(72% 0.128 252)', '--color-on-primary': 'oklch(12% 0.05 252)',
      '--color-primary-container': 'oklch(48% 0.108 252)', '--color-on-primary-container': 'oklch(10% 0.04 252)',
      '--color-secondary': 'oklch(60% 0.082 290)', '--color-on-secondary': 'oklch(12% 0.04 290)',
      '--color-secondary-container': 'oklch(40% 0.066 290)', '--color-on-secondary-container': 'oklch(10% 0.03 290)',
      '--color-tertiary': 'oklch(62% 0.082 76)', '--color-on-tertiary': 'oklch(12% 0.04 76)',
      '--color-success': 'oklch(66% 0.125 152)', '--color-warning': 'oklch(82% 0.140 88)',
      '--color-error': 'oklch(68% 0.180 25)', '--color-error-container': 'oklch(26% 0.090 25)',
    },
  },
  {
    id: 'oxide', name: 'Oxide', shortName: 'OXD', swatch: 'oklch(68% 0.138 42)',
    vars: {
      '--color-background': 'oklch(19% 0.012 190)', '--color-surface-dim': 'oklch(19% 0.012 190)',
      '--color-surface-bright': 'oklch(44% 0.022 190)', '--color-surface-container-lowest': 'oklch(15% 0.008 190)',
      '--color-surface-container-low': 'oklch(24% 0.015 190)', '--color-surface-container': 'oklch(28% 0.017 190)',
      '--color-surface-container-high': 'oklch(32% 0.019 190)', '--color-surface-container-highest': 'oklch(37% 0.021 190)',
      '--color-on-surface': 'oklch(92% 0.010 55)', '--color-on-surface-variant': 'oklch(74% 0.010 55)',
      '--color-inverse-surface': 'oklch(92% 0.010 55)', '--color-inverse-on-surface': 'oklch(24% 0.012 55)',
      '--color-outline': 'oklch(54% 0.014 55)', '--color-outline-variant': 'oklch(38% 0.014 55)',
      '--color-primary': 'oklch(68% 0.138 42)', '--color-on-primary': 'oklch(12% 0.05 42)',
      '--color-primary-container': 'oklch(46% 0.115 42)', '--color-on-primary-container': 'oklch(10% 0.04 42)',
      '--color-secondary': 'oklch(60% 0.075 163)', '--color-on-secondary': 'oklch(12% 0.04 163)',
      '--color-secondary-container': 'oklch(40% 0.060 163)', '--color-on-secondary-container': 'oklch(10% 0.03 163)',
      '--color-tertiary': 'oklch(62% 0.082 76)', '--color-on-tertiary': 'oklch(12% 0.04 76)',
      '--color-success': 'oklch(66% 0.125 152)', '--color-warning': 'oklch(82% 0.140 88)',
      '--color-error': 'oklch(68% 0.180 25)', '--color-error-container': 'oklch(26% 0.090 25)',
    },
  },
  {
    id: 'null', name: 'Null', shortName: 'NUL', swatch: 'oklch(83% 0.008 258)',
    vars: {
      '--color-background': 'oklch(18% 0.005 258)', '--color-surface-dim': 'oklch(18% 0.005 258)',
      '--color-surface-bright': 'oklch(44% 0.008 258)', '--color-surface-container-lowest': 'oklch(14% 0.003 258)',
      '--color-surface-container-low': 'oklch(23% 0.006 258)', '--color-surface-container': 'oklch(27% 0.007 258)',
      '--color-surface-container-high': 'oklch(31% 0.008 258)', '--color-surface-container-highest': 'oklch(36% 0.009 258)',
      '--color-on-surface': 'oklch(93% 0.005 258)', '--color-on-surface-variant': 'oklch(74% 0.005 258)',
      '--color-inverse-surface': 'oklch(93% 0.005 258)', '--color-inverse-on-surface': 'oklch(26% 0.005 258)',
      '--color-outline': 'oklch(56% 0.010 258)', '--color-outline-variant': 'oklch(40% 0.008 258)',
      '--color-primary': 'oklch(83% 0.008 258)', '--color-on-primary': 'oklch(12% 0.003 258)',
      '--color-primary-container': 'oklch(56% 0.008 258)', '--color-on-primary-container': 'oklch(10% 0.003 258)',
      '--color-secondary': 'oklch(60% 0.060 200)', '--color-on-secondary': 'oklch(10% 0.03 200)',
      '--color-secondary-container': 'oklch(40% 0.048 200)', '--color-on-secondary-container': 'oklch(10% 0.02 200)',
      '--color-tertiary': 'oklch(58% 0.040 120)', '--color-on-tertiary': 'oklch(10% 0.03 120)',
      '--color-success': 'oklch(66% 0.125 152)', '--color-warning': 'oklch(82% 0.140 88)',
      '--color-error': 'oklch(68% 0.180 25)', '--color-error-container': 'oklch(26% 0.090 25)',
    },
  },
  {
    id: 'day', name: 'Day', shortName: 'DAY', swatch: 'oklch(52% 0.148 65)',
    vars: {
      '--color-background': 'oklch(97% 0.008 65)', '--color-surface-dim': 'oklch(94% 0.010 65)',
      '--color-surface-bright': 'oklch(100% 0.002 65)', '--color-surface-container-lowest': 'oklch(99% 0.004 65)',
      '--color-surface-container-low': 'oklch(95% 0.009 65)', '--color-surface-container': 'oklch(92% 0.011 65)',
      '--color-surface-container-high': 'oklch(88% 0.013 65)', '--color-surface-container-highest': 'oklch(84% 0.015 65)',
      '--color-on-surface': 'oklch(16% 0.015 65)', '--color-on-surface-variant': 'oklch(36% 0.010 65)',
      '--color-inverse-surface': 'oklch(16% 0.015 65)', '--color-inverse-on-surface': 'oklch(94% 0.008 65)',
      '--color-outline': 'oklch(44% 0.012 65)', '--color-outline-variant': 'oklch(74% 0.007 65)',
      '--color-primary': 'oklch(52% 0.148 65)', '--color-on-primary': 'oklch(98% 0.004 65)',
      '--color-primary-container': 'oklch(86% 0.085 65)', '--color-on-primary-container': 'oklch(22% 0.080 65)',
      '--color-secondary': 'oklch(40% 0.080 163)', '--color-on-secondary': 'oklch(98% 0.004 163)',
      '--color-secondary-container': 'oklch(84% 0.055 163)', '--color-on-secondary-container': 'oklch(20% 0.045 163)',
      '--color-tertiary': 'oklch(44% 0.078 76)', '--color-on-tertiary': 'oklch(98% 0.004 76)',
      '--color-success': 'oklch(40% 0.115 152)', '--color-warning': 'oklch(50% 0.120 80)',
      '--color-error': 'oklch(50% 0.175 25)', '--color-error-container': 'oklch(92% 0.055 25)',
    },
  },
  {
    id: 'oscilloscope', name: 'Oscilloscope', shortName: 'OSC', swatch: 'oklch(82% 0.28 175)',
    vars: {
      '--color-background': 'oklch(10% 0.03 175)', '--color-surface-dim': 'oklch(10% 0.03 175)',
      '--color-surface-bright': 'oklch(35% 0.08 175)', '--color-surface-container-lowest': 'oklch(8% 0.02 175)',
      '--color-surface-container-low': 'oklch(14% 0.05 175)', '--color-surface-container': 'oklch(18% 0.06 175)',
      '--color-surface-container-high': 'oklch(22% 0.07 175)', '--color-surface-container-highest': 'oklch(28% 0.08 175)',
      '--color-on-surface': 'oklch(95% 0.05 175)', '--color-on-surface-variant': 'oklch(80% 0.08 175)',
      '--color-inverse-surface': 'oklch(95% 0.05 175)', '--color-inverse-on-surface': 'oklch(14% 0.05 175)',
      '--color-outline': 'oklch(45% 0.12 175)', '--color-outline-variant': 'oklch(30% 0.08 175)',
      '--color-primary': 'oklch(82% 0.28 175)', '--color-on-primary': 'oklch(10% 0.1 175)',
      '--color-primary-container': 'oklch(40% 0.18 175)', '--color-on-primary-container': 'oklch(10% 0.05 175)',
      '--color-secondary': 'oklch(75% 0.22 210)', '--color-on-secondary': 'oklch(10% 0.08 210)',
      '--color-secondary-container': 'oklch(35% 0.15 210)', '--color-on-secondary-container': 'oklch(10% 0.04 210)',
      '--color-tertiary': 'oklch(85% 0.25 120)', '--color-on-tertiary': 'oklch(10% 0.1 120)',
      '--color-success': 'oklch(80% 0.25 150)', '--color-warning': 'oklch(88% 0.2 90)',
      '--color-error': 'oklch(70% 0.25 25)', '--color-error-container': 'oklch(25% 0.12 25)',
    },
  },
];
