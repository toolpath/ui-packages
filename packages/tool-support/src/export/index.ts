/**
 * Writing this domain out into somebody else's format.
 *
 * An exporter reads a {@link CatalogTool} and an `Assembly` and produces a
 * document a CAM system will load. This entry point is what every exporter
 * shares — the input's identity half, and the account of what could not be
 * carried across — and one subpath per format holds the rest:
 * `@toolpath/tool-support/export/fusion` writes an Autodesk Fusion tool
 * library.
 *
 * They are separate entry points so that the vocabulary does not grow by
 * fifteen names every time a format is added, and so that importing one
 * format does not name the others.
 *
 * Nothing here writes a file. An exporter returns a document and the text of
 * it; where that text goes is the caller's, the same split
 * `@toolpath/tool-scraper` keeps between its records and its `node` entry.
 */

export type { CatalogTool } from './catalog.js'
export type { ExportNote, ExportNoteKind, ExportResult } from './report.js'
