/**
 * React Native's `render/section-cap-support.ts`. expo-gl's contexts have a
 * stencil buffer (8 bits on both an iPhone and the Android emulator), and the
 * cap draws there as it does on the web, so it is on here too.
 */
export const SECTION_CAPS = true
