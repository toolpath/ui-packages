/**
 * `@toolpath/plan/clicks` — what a click on the part means: the features a click on a face can be
 * read as (`readingsFor`), and what a click does while Ignore is open (`ignoreClick`,
 * `ignoreSelection`). The page itself is `planPage`.
 */
export {
  featuresAt,
  ignoreClick,
  type IgnoredAs,
  type IgnoreMode,
  ignoreSelection,
} from '../ignore'
export {
  faceRegions,
  type ReadingAt,
  type ReadingContext,
  type ReadingScope,
  readingsFor,
  type SplitRegion,
} from '../readings'
