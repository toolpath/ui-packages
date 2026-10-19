import { OPS, RULE_COLORS, newRuleId, parseRules, quantityUnit, type DfmRule } from './dfm-rules.js'
import {
  MILLING_RULES,
  TYPE_SUBJECT,
  type RuleProcess,
  type RuleVocabulary,
} from './dfm-metrics.js'

/**
 * A set of DFM rules as a file: what Export writes, Import reads, and what
 * an LLM is asked to produce. One JSON object, so a shop can keep a set per
 * customer or material, send one to a colleague, or have one written for
 * them from a conversation.
 *
 * Values are canonical, as the rules are stored: millimetres, square
 * millimetres, degrees, plain ratios. A file says so in `units`, so a reader
 * is never left guessing, and so a later version can accept inches.
 */
export interface RuleSetFile {
  /** What this file is. Always `toolpath-dfm-rules`. */
  kind: typeof FILE_KIND
  /** The file format's version, for a later reader. */
  version: 1
  /**
   * Which rules these are: milled features' or turned ones'. Always written;
   * a file without it was written before turning rules, so it is milling.
   */
  process?: RuleProcess
  /** What the set is for: "Aluminium prototypes", "Acme Corp sheet work". */
  name?: string
  description?: string
  /** The unit every length in `rules` is in. Only millimetres are written or read today. */
  units: 'mm'
  rules: DfmRule[]
}

export const FILE_KIND = 'toolpath-dfm-rules'

/** The rules as a file, pretty-printed, saying which process they are for. */
export const serializeRuleSet = (
  rules: readonly DfmRule[],
  meta: { name?: string; description?: string } = {},
  vocabulary: RuleVocabulary = MILLING_RULES,
): string =>
  JSON.stringify(
    {
      kind: FILE_KIND,
      version: 1,
      process: vocabulary.process,
      ...(meta.name ? { name: meta.name } : {}),
      ...(meta.description ? { description: meta.description } : {}),
      units: 'mm',
      rules: [...rules],
    } satisfies RuleSetFile,
    null,
    2,
  )

const PROCESS_NAMES: Record<RuleProcess, string> = { milling: 'Milling', turning: 'Turning' }

/**
 * Which process a file's rules are for. One that does not say — a bare list,
 * a wrapper with no `process`, or a null one — is milling: every rule set
 * made before turning rules existed is, and the two vocabularies share names
 * that mean different things (a hole's L/D is to the top of the part in
 * milling, and along the turned hole in turning), so an unlabelled list
 * cannot be taken for turning on the strength of its names reading.
 */
const fileProcess = (raw: unknown): unknown => {
  if (Array.isArray(raw) || typeof raw !== 'object' || raw === null) return 'milling'
  const { process } = raw as Record<string, unknown>
  return process === undefined || process === null ? 'milling' : process
}

/**
 * The rules in a file, or the reason it cannot be read. Lenient about the
 * wrapper — a bare array of rules is accepted, and so is an object with a
 * `rules` list and nothing else, since an LLM may well hand back either —
 * strict about every rule, which `parseRules` checks field by field in the
 * vocabulary given. Rules without an id, or whose ids collide, are given
 * fresh ones. A file that says its lengths are in anything but millimetres is
 * refused rather than read as millimetres; one that does not say is read as
 * millimetres. A file of the other process's rules is refused, saying where it
 * belongs, rather than read as rules it is not.
 */
export const parseRuleSetFile = (
  text: string,
  vocabulary: RuleVocabulary = MILLING_RULES,
): { rules: DfmRule[]; skipped: number; name?: string } | { error: string } => {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { error: 'This is not JSON.' }
  }
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null && Array.isArray((raw as RuleSetFile).rules)
      ? (raw as RuleSetFile).rules
      : null
  if (!list) return { error: 'No rules in it: expected an object with a "rules" list.' }
  const units = Array.isArray(raw) ? undefined : (raw as Record<string, unknown>).units
  if (units !== undefined && units !== 'mm')
    return { error: `Its lengths are in ${JSON.stringify(units)}; only "mm" can be read.` }
  const process = fileProcess(raw)
  if (process !== vocabulary.process) {
    return process === 'milling' || process === 'turning'
      ? {
          error: `This is a ${process} rule set — import it in ${PROCESS_NAMES[process]} mode.`,
        }
      : {
          error: `Its process is ${JSON.stringify(process)}; only "milling" or "turning" can be read.`,
        }
  }
  const seen = new Set<string>()
  const withIds = list.map((each: unknown) => {
    if (typeof each !== 'object' || each === null) return each
    const rule = each as Record<string, unknown>
    const id = typeof rule.id === 'string' && !seen.has(rule.id) ? rule.id : newRuleId()
    seen.add(id)
    return { ...rule, id }
  })
  const rules = parseRules(withIds, vocabulary) ?? []
  if (rules.length === 0) return { error: 'None of its rules could be read.' }
  const name =
    typeof raw === 'object' && raw !== null && typeof (raw as RuleSetFile).name === 'string'
      ? (raw as RuleSetFile).name
      : undefined
  return { rules, skipped: list.length - rules.length, ...(name ? { name } : {}) }
}

/* ---------- The LLM prompt ---------- */

const OP_WORDS: Record<string, string> = {
  gte: 'at or above (≥)',
  gt: 'above (>)',
  lte: 'at or below (≤)',
  lt: 'below (<)',
  eq: 'equal, within half a percent (=)',
  ne: 'not equal (≠)',
  between:
    'in a range: `value` ≤ x < `max` by default; `lowOp` (gte|gt) and `highOp` (lt|lte) change the ends',
}

/** What one process's prompt says of its own: who it is for, how the interview runs, and an example. */
interface PromptScript {
  /** The opening line: what the user is setting checks up for. */
  intro: string
  /** How the interview runs, and what not to ask about. */
  opening: string
  /** The interview's rounds, a question to a line. */
  rounds: readonly string[]
  /** Which features a rule fires on. */
  counting: string
  /** One rule of each shape, which the parser reads back. */
  example: readonly DfmRule[]
}

const SCRIPTS: Record<RuleProcess, PromptScript> = {
  milling: {
    intro:
      'You are helping a machinist or designer set up design-for-manufacturing (DFM) checks for CNC-milled parts in the Toolpath CAD viewer. Interview them, then produce ONE JSON document in the format below.',
    opening:
      'Begin the interview in your very first reply — do not summarise this prompt, ask whether to start, or explain the format. Run it in four rounds, in a conversational tone, following up where an answer needs it: an opening round about the shop, then a milling round, then a drilling round, then a closing round. Ask only about things the metrics below can measure from the model geometry: depths, diameters, corner radii, tool sizes, areas, feature kinds. Do not ask about surface finish, tolerances, material hardness, fixturing, quantities or lead time — nothing here measures them.',
    rounds: [
      '### Round 1 — the shop',
      '1. What they make and in what materials. This sets the defaults, not a rule.',
      '2. Examples of features that have challenged them before: a deep pocket that snapped a tool, a hole that needed a special drill, a corner radius that forced a re-quote, an undercut nobody saw until CAM. Ask for the feature and its rough size, then turn each into one rule: a deep pocket is `pocket` with `featureLd` or `depthBelowTop`; a small hole is `hole` with `diameter`; a deep hole is `hole` with `ld`; a tight corner is `milled` with `cornerRadius` or `maxTool`. If no metric below measures the example, say so and move on; never invent a metric.',
      '',
      '### Round 2 — milling (pockets, slots, walls, bosses, profiles, 3D surfaces)',
      '3. The smallest end mill they are happy to run: `milled` with `maxTool` below it, and `milled` with `cornerRadius` below half of it.',
      '4. The depth-to-diameter ratio where milled work starts to cost them, and where it becomes a problem: two or three bands of `milled` with `ld` (warning, caution, critical).',
      "5. The deepest their end mills reach below the top of the part: `milled` with `depthBelowTop`. Whether they also want a feature's own depth capped: `milled` with `featureDepth`.",
      '6. Sharp inside corners: whether every one should be flagged (`milled` with `sharpCorner`), or only on certain feature kinds.',
      '7. Floor fillets: whether a floor fillet larger than their ball or bull-nose tooling should be flagged (`pocket` with `floorFillet` above a radius).',
      '8. Milled features to call out on sight regardless of size: `undercut` with `present`; `contour` with `present` for 3D surfaces; `any` with `tilted` for 5-axis work; `boss` with `present` for thin standing material.',
      '9. Large features that drive cycle time, if they quote: `pocket` with `projectedFloorArea` or `milled` with `surfaceArea` above a size.',
      '',
      '### Round 3 — drilling (holes, threads, countersinks)',
      '10. The smallest drill they stock: `hole` with `diameter` below it. Whether they want holes that have no drill fit, so must be milled, called out: `hole` with `maxDrill` at 0.',
      '11. The depth-to-diameter ratio where holes get hard, and where they need gun drilling or a second setup: two bands of `hole` with `ld`, usually looser than milled work.',
      '12. Threads: the smallest thread they tap (`hole` with `threadDiameter` below it), and whether every threaded hole should be marked (`threadedHole` with `present`).',
      '13. Countersinks and counterbores: whether to call out countersinks (`chamfer` with `countersink`) or counterbored holes (`hole` with `counterbore`).',
      '',
      '### Round 4 — closing',
      '14. Anything they want flagged across every feature, milled or drilled — for example one overall depth below the top of the part their longest tooling cannot reach: `any` with `depthBelowTop`.',
      '15. Which of the rules so far are critical (red), which are cautions (orange) and which are just worth a look (yellow).',
    ],
    counting:
      'A rule only fires on features that have the measurement; a feature that lacks it is not flagged. Only *required* features count — ones that own a face no other feature could machine.',
    example: [
      { id: 'r1', subject: 'hole', metric: 'ld', op: 'gte', value: 8, color: '#ffd60a' },
      {
        id: 'r2',
        subject: 'milled',
        metric: 'featureLd',
        op: 'between',
        value: 4,
        max: 8,
        lowOp: 'gte',
        highOp: 'lt',
        color: '#f76b15',
      },
      { id: 'r3', subject: 'milled', metric: 'sharpCorner', op: 'gte', value: 0, color: '#e5484d' },
      { id: 'r4', subject: 'undercut', metric: 'present', op: 'gte', value: 0, color: '#8e4ec6' },
    ],
  },
  turning: {
    intro:
      'You are helping a machinist or designer set up design-for-manufacturing (DFM) checks for parts turned on a lathe in the Toolpath CAD viewer. Interview them, then produce ONE JSON document in the format below.',
    opening:
      'Begin the interview in your very first reply — do not summarise this prompt, ask whether to start, or explain the format. Run it in three rounds, in a conversational tone, following up where an answer needs it: an opening round about the shop, then a turning round, then a closing round. Ask only about things the metrics below can measure from the model geometry: diameters, lengths, grooves, threads, axial holes, inside corner radii, tolerance, feature kinds. Do not ask about surface finish, material hardness, workholding, quantities or lead time — nothing here measures them.',
    rounds: [
      '### Round 1 — the shop',
      '1. What they make, in what materials, and on what lathes: the largest bar or chuck, and whether they have live tooling. This sets the defaults, not a rule.',
      '2. Examples of turned features that have challenged them before: a narrow groove that broke an insert, a long small bore that chattered, a fine thread, a sharp inside corner no insert could make. Ask for the feature and its rough size, then turn each into one rule: a narrow groove is `groove` with `grooveWidth`; a deep bore is `id` with `ld`; a fine thread is `thread` with `threadPitch`; a small drilled hole is `hole` with `holeDiameter`. If no metric below measures the example, say so and move on; never invent a metric.',
      '',
      '### Round 2 — turning (outside, inside, faces, grooves, threads, axial holes)',
      '3. The largest diameter their lathes take: `any` with `maxDiameter` above it. The longest stretch they turn without support: `od` with `length`.',
      '4. Grooves: the narrowest grooving insert they stock (`groove` with `grooveWidth` below it), and how far they can plunge (`groove` with `grooveDepth`, or `grooveAspect` for depth over width).',
      '5. Boring: the depth-to-diameter ratio where a boring bar starts to chatter, and where it becomes a problem: two bands of `id` with `ld`. The narrowest bore their smallest bar passes: `id` with `entryDiameter` below it.',
      '6. Threads: the finest pitch they cut (`thread` with `threadPitch` below it), and the smallest thread (`thread` with `threadDiameter` below it).',
      '7. Axial holes: the smallest drill they stock (`hole` with `holeDiameter` below it), the deepest they drill (`hole` with `holeDepth`, or `hole` with `ld`), and whether to call out stepped holes (`hole` with `holeSteps`), flat bottoms (`blindHole` with `flatBottom`) or tapped holes (`threadedHole` with `present`).',
      '8. Inside corners: the smallest nose radius they run (`any` with `cornerRadius` below it), and whether every sharp inside corner should be flagged (`any` with `sharpCorner`).',
      '9. Turned features to call out on sight regardless of size: `face` with `axialTool` for work only an axially mounted tool reaches; `type:unknown` with `present` for a stretch the Engine could not name.',
      '',
      '### Round 3 — closing',
      '10. The tightest tolerance they hold without special care: `any` with `tolerance` below it.',
      '11. Which of the rules so far are critical (red), which are cautions (orange) and which are just worth a look (yellow).',
    ],
    counting:
      'A rule only fires on features that have the measurement; a feature that lacks it is not flagged. A stretch both ends of the part reach is one feature, and breaks a rule only if it breaks it from both ends.',
    example: [
      {
        id: 'r1',
        subject: 'groove',
        metric: 'grooveWidth',
        op: 'lte',
        value: 1.5,
        color: '#ffd60a',
      },
      {
        id: 'r2',
        subject: 'id',
        metric: 'ld',
        op: 'between',
        value: 4,
        max: 8,
        lowOp: 'gte',
        highOp: 'lt',
        color: '#f76b15',
      },
      { id: 'r3', subject: 'any', metric: 'sharpCorner', op: 'gte', value: 0, color: '#e5484d' },
      { id: 'r4', subject: 'thread', metric: 'present', op: 'gte', value: 0, color: '#8e4ec6' },
    ],
  },
}

/**
 * A prompt that lets any LLM interview a user and write a rule set this
 * viewer reads, for one process. Built from the vocabulary's metric and
 * subject tables themselves, so it never drifts from what the parser accepts:
 * every subject value, every metric key with its unit and meaning and the
 * kinds of feature that report it, every comparison, and the palette.
 */
export const llmRulePrompt = (
  current: readonly DfmRule[] = [],
  vocabulary: RuleVocabulary = MILLING_RULES,
): string => {
  const script = SCRIPTS[vocabulary.process]
  const groups = vocabulary.subjects.filter((each) => !each.value.startsWith(TYPE_SUBJECT))
  const types = vocabulary.subjects.filter((each) => each.value.startsWith(TYPE_SUBJECT))
  const metricLines = vocabulary.metrics.map((metric) => {
    const unit = quantityUnit(metric.quantity, 'mm')
    const kind =
      metric.quantity === 'flag'
        ? 'yes/no — write `op: "gte"` and `value: 0`; the rule fires whenever it is so'
        : metric.quantity === 'presence'
          ? 'no measurement — write `op: "gte"` and `value: 0`; flags every feature of the subject'
          : `${metric.quantity}${unit ? `, in ${unit}` : ''}; a new rule usually starts around ${metric.start.mm}`
    const kinds = metric.kinds ? ` Only features of kind ${metric.kinds.join('/')} report it.` : ''
    return `- \`${metric.key}\` — "${metric.label}" (${kind}). ${metric.hint}.${kinds}`
  })
  const example = serializeRuleSet(
    script.example,
    { name: 'Example set', description: 'Shows one rule of each shape' },
    vocabulary,
  )
  return [
    '# Write a Toolpath DFM rule set',
    '',
    script.intro,
    '',
    script.opening,
    '',
    'Where the user has current rules (listed at the end), do not ask whether to keep them. Weave each one into the relevant question as a suggested starting point — "your set currently warns at 4×D; where does deep work start to cost you?" — so the user accepts, adjusts or drops it in their own words. The finished set should feel like theirs, not a copy of the old one.',
    '',
    'Each question is tied to the subject and metric it becomes. Skip one when an earlier answer has already settled it, and offer sensible defaults from their answers rather than asking about every metric. Every rule needs an `op` and a `value`, even a yes/no one.',
    '',
    ...script.rounds,
    '',
    'The user may stop at any point — "that\'s enough", "just give me the rules", "generate it" — and you then finish from what you have: rules for every answer so far, their current rules carried over for anything not yet discussed, and sensible defaults from the shop description for the rest. Never insist on completing a round first, and never leave a placeholder for an unanswered question.',
    '',
    'Finishing: when the questions are answered or the user stops, list the rules you intend to write in plain words, one line each with its colour, and ask the user to confirm or change them. Once they confirm, output the JSON in a single ```json code block and nothing after it. The user will paste it into the viewer (DFM Rules → Import), so the block must be the complete file in the format below — no comments, no trailing text, no placeholder values.',
    '',
    '## Format',
    '',
    `Top level: \`{"kind":"toolpath-dfm-rules","version":1,"process":"${vocabulary.process}","name":"…","description":"…","units":"mm","rules":[…]}\`.`,
    'Every length is in millimetres, areas in mm², angles in degrees, ratios plain. Convert from inches yourself (1 in = 25.4 mm).',
    '',
    'Each rule is one sentence — *{subject} with {metric} {op} {value}* — with the fields:',
    '- `id`: a short unique string.',
    '- `subject`: which features (a value from the list below).',
    '- `metric`: what is measured (a key from the list below).',
    '- `op`: one of ' + OPS.map((op) => `\`${op}\``).join(', ') + '.',
    ...OPS.map((op) => `  - \`${op}\`: ${OP_WORDS[op]}`),
    '- `value`: the threshold (canonical units). For `between`, the low end; add `max` for the high end.',
    '- `color`: `#rrggbb`, from the palette: ' +
      RULE_COLORS.map((each) => `${each.name} \`${each.value}\``).join(', ') +
      '. Red for critical, orange for caution, yellow for warning; purple, green and cyan for anything else. Where a feature breaks several rules the part shows the earliest palette colour.',
    '',
    script.counting,
    '',
    '## Subjects (`subject`)',
    '',
    'Broad groups:',
    ...groups.map((each) => `- \`${each.value}\` — ${each.label}`),
    '',
    'One exact Engine feature type:',
    ...types.map((each) => `- \`${each.value}\` — ${each.label}`),
    '',
    '## Metrics (`metric`)',
    '',
    ...metricLines,
    '',
    '## Example',
    '',
    '```json',
    example,
    '```',
    ...(current.length > 0
      ? [
          '',
          "## The user's current rules",
          '',
          'Use these as the suggested starting points in your questions, as described above. Do not ask whether to keep them; do not copy them unchanged unless the user confirms each threshold:',
          '',
          '```json',
          serializeRuleSet(current, {}, vocabulary),
          '```',
        ]
      : []),
    '',
  ].join('\n')
}
