# Agent instructions and skills

`@toolpath/dev-config` ships one canonical copy of the shared agent guidance and three workflow skills. `toolpath-dev init` adds them to a repository by default, and `toolpath-dev sync` (or `toolpath-dev agents sync` for these assets alone) keeps them on the installed release without touching the repository's own instructions.

## What a repository receives

| Asset                                   | Where it lives                                                                                                        | Who owns it                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Managed section `toolpath-dev-standard` | Inside the repository's `AGENTS.md`, between `<!-- toolpath-dev:begin … -->` and `<!-- toolpath-dev:end … -->`        | The standard owns the section; the repository owns the rest of the file |
| `commit`, `pr`, and `review` skills     | `.claude/skills/<name>/SKILL.md`, or under the directory given by `--skills-dir`                                      | Managed whole files                                                     |
| Shared working standard                 | `node_modules/@toolpath/dev-config/assets/agents/AGENTS.md`, linked from the managed section                          | The package                                                             |
| Engine integration context              | `node_modules/@toolpath/dev-config/assets/engine/agents/AGENTS.md`, linked only when the `engine` profile is selected | The package                                                             |
| Optional Claude worker and output style | Your Claude configuration directory, only when you run the installer yourself                                         | You                                                                     |

The managed section is short on purpose. It states the rules an agent must not miss — how to run checks, that formatting is automatic, that lint and type policy is fixed except through declared exceptions, that suites must run real tests, and how to report verification — and links to the full guidance instead of copying it into every repository. The shared working standard stays under 80 lines.

Skills are installed only into the repository. The default is the Claude Code convention `.claude/skills`. For another agent that reads skills from a different repository directory, pass a repository-relative path:

```sh
npx toolpath-dev init --skills-dir tools/agents/skills
```

`dev.config.mjs` records the choice as `agents: { skillsDir: 'tools/agents/skills' }`, so later synchronization installs to the same place. Nothing is written to a personal or global configuration directory.

Every relative link in an installed file is rewritten for its new location: links between skills stay sibling links, and links to package documentation point into `node_modules/@toolpath/dev-config/`. They resolve after a normal npm or pnpm install.

## How synchronization preserves local instructions

- Only the text between the section's markers is ever rewritten. Headings, paragraphs, and their order elsewhere in `AGENTS.md` stay byte for byte; nothing is replaced by searching for a heading.
- `.toolpath/dev-config.json` records the bytes last generated for each managed section and skill. When you edit one, the next sync merges your edit with the new release's text against that base: changes to different lines are both kept.
- When your edit and the release change the same lines, sync stops before writing any managed file and prints the proposed patch, so you can merge by hand and run it again.
- A second sync with no new release changes nothing.
- A missing or malformed marker, an unsupported receipt, or a missing asset is reported as an error rather than repaired by guessing.

To add instructions of your own, write them outside the managed section. To change the shared guidance for every repository, change it here, in the package.

## The Engine context

Repositories that select the `engine` profile in `dev.config.mjs` get one more line in the managed section, linking the Engine integration context: the Engine domain model, how contracts, SDKs, and deployments relate, and the integration patterns for credentials, direct uploads, asynchronous jobs, errors, application-owned data, and SDK ownership. Repositories without the profile never see it.

## Optional Claude Code orchestration

Two optional files support running Claude Code as an orchestrator that delegates to a single worker: `assets/claude-code/agents/worker.md` (a `worker` subagent defaulting to Opus at high effort) and `assets/claude-code/output-styles/orchestrator.md` (the `Orchestrator` output style, which picks each worker's model and effort for the task, preferring performance and throughput over cost). Nothing in the package requires them, and `init` never installs them.

To install them into your own Claude configuration directory (`CLAUDE_CONFIG_DIR`, or `~/.claude` when it is unset):

```sh
bash node_modules/@toolpath/dev-config/assets/claude-code/install.sh
```

The installer copies only those two files. It checks both targets before writing anything, keeps a file that is already identical, and stops without changing anything when a file with the same name differs, so you can merge it yourself. It never edits settings and never copies the skills or guidance. It finishes by printing the launch command:

```sh
claude --model opus --effort xhigh --settings '{"outputStyle":"Orchestrator"}'
```

The orchestrator sets `model` and `effort` on each delegated task, which needs Claude Code v2.1.292 or later. Return to the default style with `/output-style default`; the model and effort of the main session come from the launch command.

## Maintaining the assets

- Each asset has one source under `assets/`; there are no per-target copies. Write links relative to the source file inside the package; installation rewrites them.
- Keep the generic guidance and skills free of any one product's domain. Product context belongs in an optional profile, like the Engine context, and repository specifics belong in that repository's `AGENTS.md`.
- When editing a skill, follow the skill-authoring guidance of the agents it targets, and keep its frontmatter to `name` (matching its directory), `description`, and an optional `argument-hint`.
- Check Engine statements against the public contracts the package pins. The tests compare the context's stated versions with the toolchain's pinned contracts and SDKs, so a pin change without a context update fails.
- `tests/agents/` validates frontmatter, line limits, links after installation into `.claude/skills` and a custom directory, formatting stability under the shared Prettier policy, the Engine-only content, and the installer in disposable configuration directories.

## Relationship to agent-config

These assets consolidate the `toolpath/agent-config` content repository: its bootstrap guidance, the three skills, and the optional Claude files, reconciled with the variants repositories had copied. That repository is unchanged by this package. Retiring it — a pointer to this package in its README, then archiving it with its files, history, and links intact — is a separate administrative step, taken only after a published release has been adopted.
