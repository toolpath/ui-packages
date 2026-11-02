/**
 * Whether the pointer hovers: rests over the part without pressing.
 *
 * A mouse does, so the part listens for the pointer moving over it and lights
 * the face beneath. Each of those listeners has `@react-three/fiber` raycast
 * the part on every pointer move. It is a constant, behind one module, so a
 * platform with no hover can say so in one place.
 */
export const POINTER_HOVER = true
