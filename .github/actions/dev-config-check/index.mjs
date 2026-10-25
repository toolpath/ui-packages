// Entry point only. The logic is @toolpath/dev-config's checked source, resolved
// from this action's own directory: a ui-packages checkout at the pinned SHA.
import { main } from '../../../packages/dev-config/src/ci/actions/check.mjs'

main()
