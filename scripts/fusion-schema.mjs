/**
 * Reducing Autodesk's tool-library JSON Schema to the part this repository
 * needs, deterministically.
 *
 * `@toolpath/tool-support/export/fusion` writes Fusion tool libraries, so it
 * has to know what each tool type requires and permits. That knowledge is a
 * copy of a third-party document that moves — Autodesk changed the schema
 * between February 2026 and September 2026 — and a copy with nothing watching
 * it is the failure this repository is organised against.
 *
 * The document itself is 2.6 MB, ten times the largest file in the tree, so it
 * is not vendored. What is vendored is the **digest**: for every tool type, the
 * record and geometry keys it requires and permits, plus the library-level
 * rules, the segment shape, the guid pattern and the enums. Around 23 KB.
 * `adopt-fusion-schema.mjs` writes it, `verify-fusion-schema.mjs` proves the
 * checked-in copy is self-consistent, and `check-fusion-schema-upstream.mjs`
 * fetches the live document and fails when it has moved.
 *
 * ## Why the reduction is not a tree walk
 *
 * A type's constraints are spread down a chain of nested `oneOf`s, and the two
 * relationships look identical in the tree while meaning opposite things. A
 * `circle segment barrel` is constrained by the Circle Segment Milling Tool
 * node **and** by the per-shape node under it: both apply, so their
 * requirements union. A `turning threading` matches one of four sibling
 * branches — straight, offset, face, no-holder — and exactly one applies, so
 * unioning them would demand fields no real tool carries.
 *
 * The distinction is which branch a document could actually match. So instead
 * of walking and accumulating, {@link profiles} enumerates every complete way
 * to satisfy the schema, flattening each into one constraint set. Branches down
 * one path merge; sibling alternatives stay separate and are recorded as
 * `variants`. A type with one profile — every type this repository exports —
 * reads as a plain entry.
 */

import { createHash } from 'node:crypto'

/**
 * Where the document actually lives.
 *
 * Not its `$id`, which is `https://cam.autodesk.com/tool-data/RawInputToolLibrary.schema.json`
 * and answers 404 — that string identifies the schema, it does not locate it.
 * This URL is the one Autodesk serves, recorded in the legacy frontend's
 * `packages/tools/utils/types_schemas.generator.ts`.
 */
export const SOURCE_URL =
  'https://cam.autodesk.com/tools/tools/Tooling%20Schema/ToolLibrary.schema.json'

/** Bumped when {@link derive} changes shape, so a stale digest is loud. */
export const DIGEST_VERSION = 1

/** Ceiling on enumerated profiles, so a schema that grows a combinatorial
 *  branch fails here rather than hanging the adopt. */
const PROFILE_LIMIT = 10_000

const sorted = (values) => [...new Set(values)].sort()

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Two constraint sets that both apply, as one.
 *
 * `required` unions. `properties` merges key by key and recurses, because a
 * nested schema — `geometry` is the one that matters — carries its own
 * `required` and `properties` that have to union the same way.
 */
const merge = (left, right) => {
  const properties = { ...left.properties }
  for (const [key, value] of Object.entries(right.properties ?? {})) {
    properties[key] =
      key in properties ? merge(normalize(properties[key]), normalize(value)) : value
  }
  return {
    ...left,
    ...right,
    required: sorted([...(left.required ?? []), ...(right.required ?? [])]),
    properties,
    // Both schemas apply, so the stricter answer is the true one: one branch
    // closing the object closes it however open the other left it. A plain
    // spread would let a later `true` reopen it.
    additionalProperties:
      left.additionalProperties === false || right.additionalProperties === false
        ? false
        : (right.additionalProperties ?? left.additionalProperties),
  }
}

const normalize = (schema) => (isObject(schema) ? schema : { required: [], properties: {} })

/**
 * Every complete way to satisfy `node`, each flattened into one constraint set.
 *
 * A node's own `required` and `properties` apply to all of them; each
 * `oneOf`/`anyOf` multiplies the list by its branches, and `allOf` merges into
 * every one. That is what keeps a conjunction (nested) apart from an
 * alternative (sibling) without having to guess which a given `oneOf` is.
 */
export const profiles = (node) => {
  if (!isObject(node)) return [{ required: [], properties: {} }]

  let result = [{ required: node.required ?? [], properties: node.properties ?? {} }]

  for (const branch of node.allOf ?? []) {
    const merged = []
    for (const base of result) for (const child of profiles(branch)) merged.push(merge(base, child))
    result = merged
  }

  for (const key of ['oneOf', 'anyOf']) {
    const alternatives = node[key]
    if (!Array.isArray(alternatives) || alternatives.length === 0) continue
    const expanded = []
    for (const base of result) {
      for (const branch of alternatives) {
        for (const child of profiles(branch)) expanded.push(merge(base, child))
      }
    }
    if (expanded.length > PROFILE_LIMIT) {
      throw new Error(
        `Autodesk's schema now enumerates more than ${PROFILE_LIMIT} profiles — ` +
          `the reduction in scripts/fusion-schema.mjs needs revisiting rather than raising`,
      )
    }
    result = expanded
  }

  return result
}

/** The `type` values a profile admits, or `[]` where it constrains none. */
const typesOf = (profile) => {
  const type = profile.properties?.type
  return isObject(type) && Array.isArray(type.enum) ? type.enum : []
}

/**
 * One profile as the four lists a consumer asks for.
 *
 * **`allowed` is the declared properties _plus_ the required ones**, which is
 * entailment rather than interpretation: a schema that demands a key permits
 * it. Autodesk relies on that — `circle segment lens` requires `RE` and
 * `lower-radius` in a branch that declares no properties at all, and the outer
 * Circle Segment node that does declare properties does not list `RE`. Reading
 * `allowed` as "declared" alone would make the type's own required geometry
 * illegal to emit.
 *
 * `closed` is the separate question: whether a key in neither list may be
 * written. Most geometry objects leave `additionalProperties` unset and so
 * take anything; some set it to `false`. That is the flag, not the list.
 */
const entryOf = (profile) => {
  const geometry = normalize(profile.properties?.geometry)
  const recordRequired = sorted(profile.required ?? [])
  const geometryRequired = sorted(geometry.required ?? [])
  return {
    recordRequired,
    recordAllowed: sorted([...Object.keys(profile.properties ?? {}), ...recordRequired]),
    recordClosed: profile.additionalProperties === false,
    geometryRequired,
    geometryAllowed: sorted([...Object.keys(geometry.properties ?? {}), ...geometryRequired]),
    geometryClosed: geometry.additionalProperties === false,
  }
}

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

/** Find the first subschema carrying `$id`, depth first. */
const byId = (node, suffix) => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = byId(child, suffix)
      if (found) return found
    }
    return null
  }
  if (!isObject(node)) return null
  if (typeof node.$id === 'string' && node.$id.endsWith(suffix)) return node
  for (const value of Object.values(node)) {
    const found = byId(value, suffix)
    if (found) return found
  }
  return null
}

/** Every `enum` found under a property of this name, unioned. */
const enumFor = (node, property) => {
  const found = []
  const visit = (current) => {
    if (Array.isArray(current)) {
      for (const child of current) visit(child)
      return
    }
    if (!isObject(current)) return
    const candidate = current.properties?.[property]
    if (isObject(candidate) && Array.isArray(candidate.enum)) found.push(...candidate.enum)
    for (const value of Object.values(current)) visit(value)
  }
  visit(node)
  return sorted(found)
}

/**
 * The digest, from the parsed schema.
 *
 * `sha256` is of the **raw bytes** the source served, not of a re-serialization
 * of the parsed object: it is the fact "the document we read is this document",
 * and a re-serialization would answer a different question and drift with
 * Node's key ordering.
 */
export const derive = (schema, { sha256, retrievedAt }) => {
  const items = schema.properties?.data?.items
  if (!isObject(items)) {
    throw new Error("Autodesk's schema has no properties.data.items — the reduction cannot proceed")
  }

  const grouped = new Map()
  for (const profile of profiles(items)) {
    const entry = entryOf(profile)
    for (const name of typesOf(profile)) {
      const existing = grouped.get(name) ?? []
      if (!existing.some((candidate) => same(candidate, entry))) existing.push(entry)
      grouped.set(name, existing)
    }
  }

  const types = {}
  for (const name of [...grouped.keys()].sort()) {
    const variants = grouped.get(name)
    // One way to satisfy the schema is the ordinary case and reads as a plain
    // entry. More than one is a genuine alternative — four shapes of turning
    // threading tool — and collapsing them would demand every branch's fields
    // at once.
    types[name] = variants.length === 1 ? variants[0] : { variants }
  }

  const segment = byId(items, 'ShaftSegment.schema.json')
  const guid = byId(items, 'Guid.schema.json')
  if (!segment || !guid) {
    throw new Error("Autodesk's schema no longer carries a ShaftSegment or Guid subschema")
  }

  return {
    source: {
      url: SOURCE_URL,
      id: schema.$id ?? null,
      sha256,
      retrievedAt,
      digestVersion: DIGEST_VERSION,
    },
    library: {
      required: sorted(schema.required ?? []),
      version: {
        type: schema.properties?.version?.type ?? null,
        minimum: schema.properties?.version?.minimum ?? null,
      },
    },
    entry: { required: sorted(items.required ?? []) },
    guidPattern: guid.pattern ?? null,
    segment: {
      required: sorted(segment.required ?? []),
      allowed: sorted(Object.keys(segment.properties ?? {})),
      additionalProperties: segment.additionalProperties ?? true,
    },
    enums: {
      unit: enumFor(items, 'unit'),
      material: sorted(byId(items, 'Material.schema.json')?.enum ?? []),
      coolant: sorted(byId(items, 'ToolCoolant.schema.json')?.enum ?? []),
    },
    types,
  }
}

/**
 * The digest as it is written to disk.
 *
 * Keys sorted at every level, because the file is compared byte for byte
 * against a fresh derivation and V8's insertion order is not a contract.
 */
export const serialize = (digest) => `${JSON.stringify(digest, orderedKeys, 2)}\n`

const orderedKeys = (_key, value) =>
  isObject(value)
    ? Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, value[key]]),
      )
    : value

export const sha256Of = (bytes) => createHash('sha256').update(bytes).digest('hex')
