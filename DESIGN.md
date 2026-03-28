# The Midnight Atelier: Design System Specification

## 1. Overview & Creative North Star
**Creative North Star: The Nocturnal Artisan**

This design system moves beyond the "app as a tool" and treats the digital interface as a high-end concierge. Inspired by the quiet luxury of a private club at midnight, the aesthetic centers on **The Nocturnal Artisan**. This direction rejects the flat, bright "tech" look in favor of atmospheric depth, high-contrast editorial layouts, and intentional asymmetry.

To break the "template" feel, layouts should utilize **asymmetric negative space** (e.g., staggering cards rather than a perfect grid) and **overlapping elements** (e.g., service titles bleeding slightly over high-fashion photography). This creates a sense of bespoke craftsmanship rather than industrial repetition.

---

## 2. Colors & Surface Architecture

### The Palette (Material Design Mapping)
- **Primary:** `#f2ca4f` (Illumination)
- **Primary Container:** `#d4af35` (Burnished Gold)
- **Surface:** `#131313` (Carbon)
- **Surface Container Highest:** `#353534` (Deep Stone)
- **On-Surface:** `#e5e2e1` (Silk White)
- **Outline Variant:** `#4d4635` (Muted Bronze)

### The "No-Line" Rule
Standard UI relies on borders to separate content. This system prohibits 1px solid borders for sectioning. Boundaries must be defined solely through **Background Color Shifts**. For example, a `surface-container-low` list should sit directly on a `surface` background. The eye should perceive the edge through the shift in value, not a stroke.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of luxury materials. 
*   **Level 0 (Base):** `surface` (#131313)
*   **Level 1 (Sections):** `surface-container-low` (#1c1b1b)
*   **Level 2 (Interactive Cards):** `surface-container` (#201f1f)
*   **Level 3 (Pop-overs/Modals):** `surface-container-high` (#2a2a2a)

### Signature Textures: The Golden Glow
To prevent the dark UI from feeling "dead," use a subtle radial gradient behind primary CTAs. Transition from `primary` (#f2ca4f) to `primary-container` (#d4af35) with a 20% opacity blur behind the button to simulate a soft "halo" of light on a dark marble countertop.

---

## 3. Typography: Editorial Authority

We use **Manrope** for its technical precision and modern luxury feel.

*   **Display-LG (3.5rem):** Use for "Hero" moments only. Kern tightly (-2%) to create a sense of high-fashion weight.
*   **Headline-MD (1.75rem):** For service categories (e.g., "The Signature Cut"). Always Pure White (#FFFFFF).
*   **Title-SM (1rem):** For navigation and card titles. Use `primary-fixed-dim` (#e9c347) for active states.
*   **Body-MD (0.875rem):** For descriptions. Use `on-secondary-container` (#b7b5b4) to ensure readability without competing with headlines.

**Hierarchy Note:** Always pair a `Display` headline with a significantly smaller `Label-MD` to create "Editorial Tension"—the vast difference in scale conveys premium intentionality.

---

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved by "stacking" the surface-container tiers. Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft, natural "recessed" look without the need for artificial shadows.

### Ambient Shadows
Avoid heavy black drop shadows. If an element must float (like a bottom sheet), use an extra-diffused shadow:
*   **Blur:** 40px–60px
*   **Opacity:** 8%
*   **Color:** `#000000`

### The "Ghost Border" Fallback
If accessibility requires a container edge, use a **Ghost Border**: `outline-variant` (#4d4635) at **15% opacity**. This provides a hint of structure without breaking the seamless nocturnal aesthetic.

---

## 5. Components

### Buttons (The Interaction Signature)
*   **Primary:** Solid `primary-container` (#d4af35). Text is `on-primary` (#3c2f00). Roundedness: `md` (0.75rem).
*   **Secondary:** Ghost style. No background, `outline` (#99907b) at 20% opacity.
*   **States:** On hover, the primary button should emit a 12px `primary` glow (glow token).

### Cards & Lists
*   **Rule:** Forbid divider lines.
*   **Separation:** Use `Spacing-6` (2rem) of vertical white space or a subtle background shift between `surface` and `surface-container`.
*   **Active State:** When a card (like a barber profile) is selected, apply a 1px solid `primary` (#f2ca4f) border. This is the **only** time a 100% opaque border is permitted.

### Input Fields
*   **Style:** Minimalist underline or "In-set" container. 
*   **Background:** `surface-container-highest` (#353534) at 40% opacity.
*   **Focus:** The underline transitions to `primary` gold.

### The "Atelier" Carousel
A custom component for showcasing barber portfolios. Use a non-linear scaling effect: the center image is large, while side images are 70% scale and 40% opacity, creating a "spotlight" focus on the artisan's work.

---

## 6. Do’s and Don’ts

### Do
*   **Use High-Contrast Images:** Only use photography with deep shadows and warm highlights to match the `#0D0D0D` background.
*   **Embrace Negative Space:** Allow headlines to breathe. Use `Spacing-12` (4rem) between major sections.
*   **Use "Glass" for Overlays:** Use `surface-bright` with a 20px backdrop-blur for top navigation bars to maintain the sense of depth.

### Don't
*   **Don't use Pure Black (#000000):** It feels "cheap" and digital. Stick to the `surface` carbon (#131313).
*   **Don't use Gradients in Text:** This degrades the luxury editorial feel. Keep text solid for crisp readability.
*   **Don't use Default Icons:** Use ultra-thin (1pt or 1.5pt) outline icons. Avoid filled icons unless it is an active state.