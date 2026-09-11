#!/usr/bin/env node
/**
 * The executable. Nothing but the shebang and the call.
 *
 * Separate from `cli.ts` because that module is also imported —
 * `@toolpath/tool-scraper/node` re-exports `run` so a consumer can drive a
 * command without a subprocess, and a top-level "if this is the entry point"
 * guard in an imported module is both fragile and a side effect. It was fragile
 * here in exactly the way that matters: run through the `bin` symlink,
 * `process.argv[1]` is the symlink's name and the guard never matched, so the
 * installed command printed nothing and exited 0.
 */

import { main } from './cli.js'

process.exitCode = await main()
