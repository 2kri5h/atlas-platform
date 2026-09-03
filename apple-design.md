---
version: "superdesign-alpha"
name: "Product-tile whiteout"
description: "Light-mode-default retail system built on flat off-white panels, edge-to-edge product renders, and a single rationed blue lifted only for links and pill CTAs."
colors:
  background: "#F5F5F7"
  surface: "#FFFFFF"
  surface-dark: "#000000"
  text-primary: "#1D1D1F"
  text-secondary: "#2997FF"
  accent: "#0071E3"
  link: "#0066CC"
typography:
  display-lg:
    fontFamily: "SF Pro Text"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: "1.47"
    letterSpacing: "-0.4px"
  headline-md:
    fontFamily: "SF Pro Display"
    fontSize: "56px"
    fontWeight: 600
    lineHeight: "1.07"
    letterSpacing: "-0.3px"
  body-md:
    fontFamily: "SF Pro Display"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: "1.14"
  label-md:
    fontFamily: "SF Pro Display"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: "1.1"
  body-lg:
    fontFamily: "SF Pro Display"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: "1.14"
  accent-condensed:
    fontFamily: "Arial"
    fontWeight: 700
    role: "distressed-stencil display wordmark inside media tiles"
spacing:
  base: "8px"
  gap: "12px"
  section-padding: "44px"
rounded:
  control: "980px"
  card: "8px"
  pill: "9999px"
components:
  button-primary-hero:
    background: "#0071E3"
    text-color: "#FFFFFF"
    radius: "980px"
    height: "44px"
    padding: "11px 21px"
    border: "1px solid rgba(0,0,0,0)"
    hover-background: "#0076DF"
  button-primary-midpage:
    background: "#0071E3"
    text-color: "#FFFFFF"
    radius: "980px"
    height: "36px"
    padding: "8px 15px"
    border: "1px solid rgba(0,0,0,0)"
    hover-background: "#0076DF"
  button-outline:
    background: "transparent"
    text-color: "#0071E3"
    radius: "980px"
    height: "44px"
    padding: "11px 21px"
    border: "1px solid #0071E3"
  button-secondary-light:
    background: "#F5F5F7"
    text-color: "#000000"
    radius: "980px"
    height: "44px"
    padding: "11px 21px"
    border: "1px solid rgba(0,0,0,0)"
    hover-background: "#FFFFFF"
  navbar:
    background: "rgba(245, 245, 247, 0.8)"
    backdrop-filter: "saturate(1.8) blur(20px)"
    height: "44px"
  card-panel:
    background: "#F5F5F7"
    radius: "0px"
    padding: "53px 0px 60px"
  card-panel-dark:
    background: "#000000"
    radius: "0px"
    padding: "56px 0px 63px"
  card-bleed:
    background: "transparent"
    radius: "0px"
    padding: "0px"
  footer:
    background: "#F5F5F7"
---
# Product-tile whiteout
Source: https://www.apple.com/

## Overview
This is a light-mode-default retail system: flat off-white (`#F5F5F7`) and pure white (`#FFFFFF`) panels stacked edge-to-edge, each holding one oversized product render with almost no chrome around it. The aesthetic is minimalism at industrial scale — no cards in the conventional sense (radius is `0px` throughout), no drop shadows on content panels, no gradients as backgrounds. Structure comes entirely from alternating flat-color bands and from type weight, not from borders. Color is rationed hard: one blue (`#0071E3`/`#0066CC`) carries every actionable element — pill buttons and text links — while everything else sits in near-black ink (`#1D1D1F`) on near-white ground, occasionally reversing to a true-black panel (`#000000`) for contrast breaks.

## Composition
The first screen opens on a centered, symmetrical stack: a one-word headline, a one-line subhead, a two-button row (solid + outline pill), then a large multi-device product render bleeding out of frame below. This is a deliberate "headline-then-hero-object" composition rather than a split hero with copy on one side and image on the other — it rejects asymmetric hero layouts entirely in favor of centered, self-contained product statements repeated section after section. Below the fold, the page becomes a rhythm of full-width promotional bands (each its own flat-color panel, headline + subhead + button pair + product image), then breaks into a 2×2 bento block partway down, then into a horizontal scrolling rail of media tiles for entertainment content, and closes with a dense multi-column footer. Density is low in the hero (huge whitespace, one focal object) and increases steadily band by band until the footer, which is the single most information-dense region on the page.

## Colors
`#F5F5F7` is the dominant background (~72% of rendered pixels per the pixel field, plus another ~4% pure white `#FFFFFF` for alternating panels) — this is the page's true resting surface, not any gradient. `#000000` occupies roughly 7% of pixels as full-bleed dark panels (a product band, video-tile letterboxing) — a deliberate tonal break, not the base. A pale cyan-tinted panel (`#D8F0F0`-family, ~6%) appears as a light gradient wash behind at least one product tile. `#1D1D1F` is the text-ink role for all headlines and body copy on light panels; on dark panels text inverts to white. `#0071E3`/`#0066CC` is the single accent — used exclusively for solid pill fills, pill outlines, and inline links (`#2997FF` appears as a lighter link/secondary-tone variant, likely for hover or dark-panel links). No warm hues, no purple, no green appear as system color — any saturated color in the composition (orange desert tones, red-lit portrait, pink/gold device finishes) belongs to embedded photography and product renders, not to the design system's palette.

## Typography
SF Pro Display carries every headline role at large sizes with tight leading: a 56px/600 headline at `lh 1.07 / ls -0.3px` for primary section titles, and a 40px/600 label size for slightly smaller section heads. SF Pro Text handles both a 34px/600 secondary display role (`lh 1.47 / ls -0.4px`) and the 17px/400 body-copy role that carries all paragraph and legal text in `#1D1D1F`. A 28px/400 SF Pro Display size serves as a mid-weight subheadline under big headlines. One observed signature move: an italic-weight, distressed condensed sans (Arial-based, bold, stencil/worn-texture treatment) appears once as a large wordmark inside a single dark media tile — a one-off display accent confined to that one card, not a running type role.

## Layout
Content is capped by a 1024px max-width container, though full-bleed color panels and images extend beyond it edge-to-edge. Section padding runs around 44px vertically, with an internal grid gap of 12px used consistently. Mid-page promotional content organizes as a 2-column bento grid: row one is a 49/49 split (two half-width panels), and this 49/49 rhythm repeats for three rows in one section (6 items total), while another section runs full-width panels stacked 100/100/100 (three consecutive full-bleed bands, each with its own dark or light or gradient-washed fill). The entertainment band is a horizontal scrolling rail: one oversized featured tile flanked by partial-width neighbor tiles peeking at the edges, with a second row of five smaller uniform tiles beneath it — a scrolling-rail-over-uniform-row composition, not a fixed grid. Card "surfaces" have zero radius and zero applied padding at the outer container level; internal padding lives inside each panel's content stack instead (53–60px top/bottom for standard bands, 56–63px for dark bands).

## Components
- **Navbar**: fixed/sticky, 44px tall, fill `rgba(245, 245, 247, 0.8)` with `backdrop-filter: saturate(1.8) blur(20px)` — a glass strip. Contains a centered row of ~13 flat text nav items plus a leading mark-only logo glyph and two trailing icon-only utility buttons (search, bag). No visible CTA button sits in the navbar itself; below it, a slim secondary utility strip (white background, single centered link with blue text) sits underneath as a persistent announcement row.
- **Button — hero primary**: the solid `#0071E3` pill under the first headline, white text, height 44px, radius 980px (full pill), padding `11px 21px`, hover → `#0076DF`. This is the single most emphasized control on the first screen.
- **Button — hero outline**: paired beside the primary, transparent fill, `#0071E3` text and 1px `#0071E3` border, same 44px/980px pill geometry — secondary action beside the primary.
- **Button — mid-page primary**: same `#0071E3`/white pair but scaled down to 36px height, padding `8px 15px`, repeated once per promotional band beside a matching outline pill.
- **Button — light/secondary pill**: `#F5F5F7` fill, black text, 980px radius, seen in two heights (44px and 36px) near the page end as a paired alternate to the blue solid button on dark-panel bands, hover → `#FFFFFF`.
- **Full-width promo panel** (×3, hero-scale): flat color fill (light gray, ice-blue gradient wash, or pure black), padding `56px 0px 63px`, rows stacked 100/100/100. Anatomy top-to-bottom: centered heading (with an italic single-word color accent seen once), one-line subhead, a solid+outline button pair, then a large centered product render bleeding to the panel's lower edge.
- **Bento promo panel** (×2, half-scale, ×6 items across 3 rows at 49/49): fill `#F5F5F7` or black, padding `53px 0px 60px`. Anatomy: centered heading + subhead, button pair, product render sized to half the panel width, one panel additionally carrying a 3-photo collage strip beneath its copy instead of a single product shot.
- **Media/collage band** (transparent, edge-to-edge, no padding): a 3-up row of cut-out photographic figures each holding an angled screen graphic — pure imagery, no card chrome, sitting directly on the page background.
- **Entertainment rail** (transparent tiles, no radius, no padding): one oversized featured tile with a bottom-left title lockup, small pill CTA, and one-line descriptor caption over a photographic/color-graded backdrop; a second row of five uniform smaller tiles, each carrying a small logo mark, a pill CTA, and a one-line label, cropped edge-to-edge with no visible gaps beyond the 12px grid gutter.
- **List/copy panel** (×2, transparent, padding `0px 44px 0px 0px`): heading + list + body-text only, no imagery — used for feature-explanation content, right-padded to keep text off the panel edge.
- **Footer**: fill `#F5F5F7`, ~78 links across five labeled columns, preceded by dense unstyled legal paragraph text and a horizontal divider; closes with a copyright line and a slim secondary link row.

## Graphics & Effects
Two measured gradients exist and each is confined to a single element, not a page background: `radial-gradient(100% 33% at 0% 100%, rgba(0, 0, 0, 0.5) 0%, rgba(255, 255, 255, 0))` sits as a corner-anchored dark-to-transparent scrim on one panel (roughly 7% of total page area), and `linear-gradient(rgba(29, 29, 31, 0.4) 0%, rgba(29, 29, 31, 0) 70px, rgba(29, 29, 31, 0) calc(100% - 70px), rgba(29, 29, 31, 0.4) 100%)` is a top/bottom vignette used to fade media-tile edges into the surrounding panel (~1% of page area) — treat both as small element-local effects, never as full-hero washes. Live video exists in at least one media tile; substitute a static color-graded still as its stand-in. Glass appears only on the sticky navbar via `backdrop-filter: saturate(1.8) blur(20px)` (and a plain `blur(20px)` variant elsewhere). One soft elevation shadow, `rgba(0, 0, 0, 0.22) 3px 5px 30px 0px`, is available for any floating/overlay element but panels themselves are flat and shadowless.

## Motion
Interactions are fast and understated: color transitions run at `color 0.32s cubic-bezier(0.4, 0, 0.6, 1)`, and enter/exit opacity-transform pairs run at `0.22s`, `0.24s`, and `0.32s ease` depending on context — no spring/overshoot easing anywhere. Navbar flyout panels use directional slide keyframes (`globalnav-flyout-slide-forward-next/previous`, `globalnav-flyout-slide-back-previous/next`) plus a small chevron slide-in/out pair on hover — all short, linear-feeling directional swaps rather than bouncy reveals. The overall motion language is utilitarian and quick, never decorative.

## Guardrails
- Never apply the two measured gradients as full-bleed hero backgrounds — they are scrim/vignette treatments on single elements only.
- Keep all card/panel radius at `0px`; do not round promotional panels or media tiles to soften this system.
- Ration `#0071E3`/`#0066CC` to buttons and inline links only — do not tint headlines, backgrounds, or icons with it.
- Do not substitute the light secondary pill (`#F5F5F7`/black) for the blue primary pill, or vice versa — they alternate by panel background (dark panel → light pill, light panel → blue pill).
- Preserve the flat, shadowless panel language; reserve the one soft shadow token strictly for floating/overlay UI, not content bands.
- Keep the italic accent-word treatment to a single word per headline occurrence — it is a rare punctuation mark, not a running style.