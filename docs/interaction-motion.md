# Carsystem Interaction & Motion System

This pass adds a lightweight CSS/React motion layer for the public Carsystem site. It avoids new paid services and heavy animation dependencies.

## Cursor

- `PigmentCursor` is mounted once through `MotionSystem` in `app/layout.tsx`.
- It only runs on desktop fine pointers with hover and `prefers-reduced-motion: no-preference`.
- Mobile, touch, and reduced-motion users keep the native cursor.
- Cursor states can be declared with `data-cursor="text|smalltext|link|button|card|image|process"`.
- Process surfaces can also declare `data-process="prep|primer|paint|clearcoat|polish"`.

## Local Surface Motion

Use `data-motion-surface` with one of these global classes:

- `cs-interactive-surface` for quiet spotlight/border response.
- `cs-magnetic-cta` for primary CTA response.
- `cs-theme-wipe-card` for important CTAs that should wipe into the opposite theme.
- `cs-gloss-card` for product/service/cards.
- `cs-image-surface` for image frames.
- `cs-process-surface` for refinish process phase cards.

The runtime writes `--mx`, `--my`, `--rx`, and `--ry` on the hovered surface via pointer refs, without React re-renders on mouse move.
On pointer leave, the last coordinates are held briefly while the overlay fades, then reset to center. This prevents the visible spotlight jump that happens when `--mx` and `--my` reset too early.

`cs-theme-wipe-card` is intentionally opt-in for high-value CTA cards and buttons. In light mode it wipes toward a graphite surface; in dark mode it wipes toward a warm off-white surface. The wipe starts from the local pointer position and inverts foreground/border color while active.

## Page Transitions

`MotionSystem` intercepts same-origin internal links and applies a theme-aware close/open veil before routing. It skips external links, downloads, `target="_blank"`, modified clicks, and same-document hash links.

The transition uses two curtains that close to the current theme surface, a short blur/fade handoff, and a thin reflective edge. The new page appears while the curtains open. Reduced motion shortens this to a simple opacity handoff.

Transition variants:

- `/` to `/katalog`: paint veil.
- listing/program/brand to product detail: gloss.
- product detail back to non-product pages: blur.
- other public route transitions: gloss veil.

## Catalog Foundation

Catalog result rendering starts with the first 48 filtered products and expands in 48-item steps. `CatalogSkeletonGrid` provides a stable Suspense fallback for catalog loading states.

Product cards use `cs-product-motion-card` with `--product-accent` and `--product-hover-bg`. Hover direction is stored as local `data-*` attributes on the card and cycles top, bottom, side without React grid re-renders.

## Footer

Public footers can use `cs-animated-footer` with a `cs-footer-ambient` child. The layer is a restrained ambient texture that slowly drifts on desktop and freezes for reduced motion. Footer links use `cs-link-reveal` for the line reveal.

## Accessibility And Performance

- Reduced-motion disables the custom cursor, surface transforms, and skeleton shimmer.
- Focus outlines remain native/site-defined.
- Overlay elements use `pointer-events: none`.
- Motion is implemented with CSS variables, RAF, passive pointer listeners, and small client components.
