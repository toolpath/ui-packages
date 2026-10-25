# Agent instructions and skills

`@toolpath/dev-config` ships one canonical copy of the shared agent guidance, three workflow skills, and a `toolpath-api` skill for repositories that integrate the Toolpath Engine API. `toolpath-dev init` adds them to a repository by default, and `toolpath-dev sync` (or `toolpath-dev agents sync` for these assets alone) keeps them on the installed release without touching the repository's own instructions.

## What a repository receives

| Asset                                   | Where it lives                                                                                                 | Who owns it                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Managed section `toolpath-dev-standard` | Inside the repository's `AGENTS.md`, between `<!-- toolpath-dev:begin … -->` and `<!-- toolpath-dev:end … -->` | The standard owns the section; the repository owns the rest of the file |
| `commit`, `pr`, and `review` skills     | `.claude/skills/<name>/SKILL.md`, or under the directory given by `--skills-dir`                               | Managed whole files                                                     |
| Shared working standard                 | `node_modules/@toolpath/dev-config/assets/agents/AGENTS.md`, linked from the managed section                   | The package                                                             |
| `toolpath-api` skill                    | Beside the other skills, only when the `engine` profile is selected                                            | Managed whole file                                                      |

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
- A skill or file that a release, or the repository's profile selection, no longer includes is removed while it still has the generated text. If you edited it, sync stops with the removal as a patch, so you can delete it or move it to keep your version.
- A second sync with no new release changes nothing.
- A missing or malformed marker, an unsupported receipt, or a missing asset is reported as an error rather than repaired by guessing.

To add instructions of your own, write them outside the managed section. To change the shared guidance for every repository, change it here, in the package.

## The toolpath-api skill

Repositories that select the `engine` profile in `dev.config.mjs` also receive the `toolpath-api` skill: the Engine domain model, how contracts, SDKs, and deployments relate, and the integration patterns for credentials, direct uploads, asynchronous jobs, errors, application-owned data, SDK ownership, and testing. Its description names the code it applies to, so an agent loads it when a task touches the Engine rather than on every task, and the managed section gains one line pointing to it for agents that do not discover skills. Repositories without the profile never see it, and dropping the profile removes it on the next sync.

## Maintaining the assets

- Each asset has one source under `assets/`; there are no per-target copies. Write links relative to the source file inside the package; installation rewrites them.
- Keep the generic guidance and skills free of any one product's domain. Product context belongs in a skill installed with an optional profile, like `toolpath-api` under `assets/engine/skills/`, and repository specifics belong in that repository's `AGENTS.md`.
- When editing a skill, follow the skill-authoring guidance of the agents it targets, and keep its frontmatter to `name` (matching its directory), `description`, and an optional `argument-hint`.
- Check Engine statements against the public contracts the package pins. The tests compare the skill's stated versions with the toolchain's pinned contracts and SDKs, so a pin change without a context update fails.
- `tests/agents/` validates frontmatter, line limits, links after installation into `.claude/skills` and a custom directory, formatting stability under the shared Prettier policy, and that Engine content is installed only with the profile.

## Relationship to agent-config

These assets consolidate the repository-level content of `toolpath/agent-config`: its bootstrap guidance and the three skills, reconciled with the variants repositories had copied. Personal Claude Code configuration, such as its worker subagent and Orchestrator output style, is not a repository standard and stays out of this package. That repository is unchanged by this package. Retiring it — a pointer to this package in its README, then archiving it with its files, history, and links intact — is a separate administrative step, taken only after a published release has been adopted.
