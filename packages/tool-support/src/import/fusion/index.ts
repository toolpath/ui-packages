/**
 * Reading an Autodesk Fusion tool library: the inverse of `./export/fusion`,
 * into the shared record rather than the ISO-coded model it writes from.
 *
 * ```ts
 * const assemblies = readFusionLibrary(JSON.parse(readFileSync('shop.json', 'utf8')))
 * ```
 *
 * One result per `data[]` entry, index-aligned; an entry it does not model
 * reads as `null`, and nothing throws on library data.
 */

export { readFusionEntry, readFusionLibrary } from './library.js'
