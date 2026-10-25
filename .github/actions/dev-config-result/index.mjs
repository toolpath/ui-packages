// Entry point only. The aggregation policy is @toolpath/dev-config's shared
// result-policy.mjs, resolved from this action's own directory: a ui-packages
// checkout at the pinned SHA. Nothing here needs an install or a build.
import { main } from '../../../packages/dev-config/src/ci/actions/result.mjs'

main()
