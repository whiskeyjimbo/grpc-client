---
name: Precision Workbench
description: A well-machined instrument for gRPC exploration and testing.
colors:
  primary: "oklch(76% 0.155 65)"
  on-primary: "oklch(12% 0.05 65)"
  secondary: "oklch(62% 0.085 163)"
  tertiary: "oklch(62% 0.082 76)"
  background: "oklch(22% 0.010 62)"
  surface-dim: "oklch(22% 0.010 62)"
  surface-container: "oklch(31% 0.016 62)"
  on-surface: "oklch(93% 0.012 65)"
  on-surface-variant: "oklch(76% 0.011 65)"
  outline: "oklch(65% 0.011 65)"
  outline-variant: "oklch(42% 0.015 65)"
  success: "oklch(66% 0.125 152)"
  error: "oklch(68% 0.180 25)"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontWeight: 900
    letterSpacing: "-0.02em"
    lineHeight: 1.1
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "11px"
rounded:
  xs: "0.125rem"
  md: "0.25rem"
  lg: "0.5rem"
  xl: "0.75rem"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  input-field:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
---

# Design System: Precision Workbench

## 1. Overview

**Creative North Star: "The Precision Workbench"**

This system is designed to feel like a well-machined instrument—not flashy, corporate, or playful, but calibrated and reliable. It prioritizes information density and execution over decoration, using a "Precision Workbench" aesthetic that favors high-contrast typography and tonal depth.

The interface is built on a warm charcoal base (`oklch(22% 0.010 62)`), providing a comfortable, low-glare environment for technical work. Depth is conveyed through tonal layering rather than shadows, creating a sense of structural permanence. Every interaction should feel tactile and decisive, with motion used strictly to convey state and transition.

**Key Characteristics:**
- **Execution-first**: Primary actions are clearly marked with Signal Amber.
- **Tonal Depth**: Layered surfaces communicate hierarchy without visual noise.
- **Technical Density**: Maximized information density while maintaining scannability.
- **Instrument-grade**: Precise alignment, intentional spacing, and mono-pairing.

## 2. Colors

The palette is restrained and intentional, using warm charcoal neutrals to anchor saturated semantic accents.

### Primary
- **Signal Amber** (oklch(76% 0.155 65)): Used for primary actions (Execute), selection states, and critical focus indicators. Its rarity is its strength.

### Secondary
- **Field Sage** (oklch(62% 0.085 163)): Used for connection states, live streaming indicators, and secondary execution flows.

### Tertiary
- **Ochre Overlays** (oklch(62% 0.082 76)): Used for variable overrides, metadata badges, and client-side streaming indicators.

### Neutral
- **Machined Carbon** (oklch(22% 0.010 62)): The foundation of the system. A warm neutral that avoids the "cool blue" of typical dark modes.
- **On-Surface Wash** (oklch(93% 0.012 65)): A warm off-white for primary text, ensuring high contrast without eye strain.

### Named Rules
**The 10% Rule.** Signal Amber is reserved for the most important actions and states. It should never occupy more than 10% of any screen surface.

## 3. Typography

**Display Font:** Barlow Condensed (with sans-serif fallback)
**Body Font:** Manrope (with system-ui fallback)
**Label/Mono Font:** JetBrains Mono

**Character:** A pairing that balances the high-impact, technical feel of condensed display type with the extreme legibility of a modern humanist sans for labels and data.

### Hierarchy
- **Display** (900, 22px, 1.1): Used for main panel titles and brand headers.
- **Headline** (800, 15px, 1.2): Used for major section groups.
- **Title** (700, 13px, 1.4): Used for field labels and column headers.
- **Body** (400, 13px, 1.5): Used for descriptions and instructional text.
- **Label** (800, 12px, 0.04em, uppercase): Used for button text and CTA labels.
- **Mono** (400, 11px, 1.4): Used for all gRPC data, service paths, and variable interpolation.

### Named Rules
**The Mono-Logic Rule.** Any value that is "machine-readable" or "service-defined" (method names, payload keys, variable names) MUST be rendered in JetBrains Mono.

## 4. Elevation

The Precision Workbench is **Flat & Tonal**. Depth is conveyed through color shifts (`surface-container-low` to `highest`) and subtle border variants (`outline-variant`).

### Shadow Vocabulary
- **Structural Overlay** (0 12px 48px rgba(0,0,0,0.5)): Used only for high-z-index floating elements like the Help Panel and Modals to provide necessary separation from the workbench.

### Named Rules
**The Rested Surface Rule.** Surfaces are flat at rest. Elevation is a response to interaction (hover) or a structural requirement for overlays.

## 5. Components

Interaction should feel tactile, with immediate but subtle feedback.

### Buttons
- **Shape:** Softly squared (0.25rem radius).
- **Primary:** Signal Amber background with dark charcoal text.
- **Hover / Focus:** Subtle scale shift (0.98) and increased brightness.
- **Secondary:** Outlined or low-chroma tinted backgrounds.

### Chips
- **Style:** Compact, mono-forward, with semantic borders.
- **State:** Tiers (ENV, WS, OVR) are color-coded to their respective roles.

### Cards / Containers
- **Corner Style:** 0.5rem radius for major panels, 0.25rem for internal groups.
- **Background:** Steps through the Machined Carbon tonal scale.
- **Border:** 1px `outline-variant/30` as a default structural divider.

### Inputs / Fields
- **Style:** `surface-container-low` background with a subtle inset feel.
- **Focus:** 2px Signal Amber ring with offset.
- **Error:** High-chroma Red border with subtle background tint.

## 6. Do's and Don'ts

### Do:
- **Do** use OKLCH for all color declarations to ensure perceptual uniformity.
- **Do** pair mono and sans carefully: mono for data, sans for labels.
- **Do** respect the 65–75ch line length for instructional content.

### Don't:
- **Don't use "Standard AI Slop"**: Avoid navy + cyan + purple palettes, neon glows, and glassmorphism.
- **Don't use side-stripe borders** for status. Use full-border tints or badges.
- **Don't use display fonts** for body text or button labels.
- **Don't use pure black (#000) or pure white (#fff)**. Every neutral must be tinted toward the primary hue.
