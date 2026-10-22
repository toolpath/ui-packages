/**
 * What a web-only export does on React Native: says so, rather than drawing
 * nothing. Its stub calls this with the export's name.
 */
export function webOnly(name: string): never {
  throw new Error(`@toolpath/viewer: ${name} is not available on React Native.`)
}
