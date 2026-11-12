import { assemblySignedOff } from './assembly-state'
import type { PartState } from './part-state'

/*
  Which of a quote's parts the quote itself offers. A part set to No quote is on the quote's list
  but not on the offer; of the rest, only those signed off — moved into Quote — are priced on it.
  The documents offer assemblies: a part counted 0 is no part of the offer, and an assembly is on it
  whole, once every part of it made is signed off, or not at all.
*/

/** What these rules read of a part. */
export interface QuotePart {
  /** Left off the offer: neither priced nor named as missing. */
  noQuote: boolean
  state: PartState
}

/** What the documents read of a part: its name, its assembly and its count in it. */
export interface DocumentPart extends QuotePart {
  name: string
  assemblyId: string
  assemblyName: string
  /** Its count per assembly (`countPerAssembly`); 0 is a part not made. */
  count: number
}

/** The parts on the quote: every one but those set to No quote. */
export const quotedParts = <Part extends Pick<QuotePart, 'noQuote'>>(
  parts: ReadonlyArray<Part>,
): Array<Part> => parts.filter((part) => !part.noQuote)

/** The parts grouped by assembly, each assembly where its first part is listed. */
export const partsByAssembly = <Part extends Pick<DocumentPart, 'assemblyId'>>(
  parts: ReadonlyArray<Part>,
): Array<Array<Part>> => {
  const groups = new Map<string, Array<Part>>()
  for (const part of parts) {
    const group = groups.get(part.assemblyId)
    if (group) {
      group.push(part)
    } else {
      groups.set(part.assemblyId, [part])
    }
  }
  return [...groups.values()]
}

/** Whether an assembly's parts made are one part, once per assembly: it reads as that part. */
export const isSinglePart = (parts: ReadonlyArray<Pick<DocumentPart, 'count'>>): boolean =>
  parts.length === 1 && parts[0]?.count === 1

/**
 * What the documents call an assembly, from its parts made: its one part's name where it is that
 * part ×1, as a part alone always was; the assembly's otherwise.
 */
export const documentName = (
  parts: ReadonlyArray<Pick<DocumentPart, 'name' | 'assemblyName' | 'count'>>,
): string => {
  const [first] = parts
  return first && isSinglePart(parts) ? first.name : (first?.assemblyName ?? '')
}

/**
 * What the quote page prices, and what it names as left out, as the server's draft PDF and email
 * do (`buildQuotePresentation`): the parts made of each quoted assembly signed off — every part of
 * it made moved into Quote — and the names (`documentName`) of the assemblies still waiting on one.
 * A part counted 0 is neither, and holds nothing back. A part set to No quote is neither, and it
 * cannot be moved into Quote to stop holding the quote back.
 */
export const documentParts = <Part extends DocumentPart>(
  parts: ReadonlyArray<Part>,
): { inQuote: Array<Part>; waiting: Array<string> } => {
  const assemblies = partsByAssembly(quotedParts(parts).filter((part) => part.count > 0))
  return {
    inQuote: assemblies.filter((made) => assemblySignedOff(made)).flat(),
    waiting: assemblies.filter((made) => !assemblySignedOff(made)).map(documentName),
  }
}
