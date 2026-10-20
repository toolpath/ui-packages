/**
 * Whether this renderer draws the section cap.
 *
 * The cap is a stencil technique (see `section-view.tsx`), and every WebGL
 * context the viewer creates on the web has a stencil buffer, so it is always
 * drawn here. It is a constant, behind one module, so a renderer without
 * stencil support can say so in one place.
 */
export const SECTION_CAPS = true
