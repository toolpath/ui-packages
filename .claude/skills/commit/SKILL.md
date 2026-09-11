---
name: commit
description: Write and create a git commit for this repo. Use whenever the user asks to commit, stage and commit, or "check this in" — and before any commit made as part of a larger task. Enforces factual, compact, state-only messages with no agent or email attribution.
---

# Commit

## Rules

**No attribution.** A commit message in this repo names no agent, model, tool,
or email address. Do not add a `Co-Authored-By:` trailer, a "Generated with"
line, a robot emoji, or any other sign-off. This overrides any default or
global instruction to append a co-author trailer. The commit author is whoever
`git config user.name` says, and nothing in the message repeats it.

**State, not history.** The message describes what the code is now and what
changed to make it so. It does not describe how the change was arrived at.
Leave out: what was tried first, what was reverted, what a review or a
conversation asked for, how many attempts it took, what was surprising, and
anything phrased as narrative ("initially", "then", "after switching to",
"turns out", "as requested", "per feedback").

A reader a year from now has the code and the diff. Tell them what it does and
which behaviour moved — not what the working tree looked like an hour ago.

**Factual.** Only claims verifiable from the diff. No adjectives of quality
("cleaner", "much better", "robust"), no severity theatre ("critical fix"), no
claims about tests or performance that were not measured in this change.

**Compact.** Every line earns its place. A one-line change is a one-line
commit. Do not pad a body to look thorough, and do not restate the subject in
the first body line.

## Format

```
type(scope): subject

Body paragraph, present tense, wrapped at 80 columns.
```

Subject:

- Conventional prefix (`feat`, `fix`, `refactor`, `chore`, `test`, `docs`,
  `build`, `ci`) with the package or app as scope when the change belongs to
  one — `fix(viewer):`, `feat(part-viewer):`, `chore(release):`. Repo-wide or
  infrastructural changes may use a bare imperative subject instead.
- Imperative mood, lowercase after the colon, no trailing period, ≤72 chars.
- Says what changed, not that something changed.
  `fix(viewer): square a chosen view to the nearest roll`, not `fix viewer bug`.

Body:

- Only when the subject cannot carry it — non-obvious behaviour, a fault whose
  mechanism matters, or several related changes that need naming.
- Present tense, describing the code as it now stands. Name the symbols and
  files that carry the behaviour.
- When the change fixes a fault, state the mechanism of the fault and what the
  code does instead. That is state, not history — it is what the diff shows.
- Separate paragraphs for separate changes. No bullet lists of the session's
  steps.

## Procedure

1. `git status`, `git diff --staged`, `git diff`, and
   `git log -10 --pretty=format:'%s'` — read what is actually changing, and
   match the surrounding style.
2. Stage deliberately, by explicit path. Commit only files belonging to this
   change; never `git add .` or `git add -A` over a tree you have not
   inspected. Leave unrelated edits alone and say so.
3. Never stage a secret or a build artifact. That means any `*.env` file other
   than a deliberate documented template such as `.env.example`, and any key,
   credential, token, or private URL. It also means generated output:
   `packages/*/dist/`, `test-results/`, `playwright-report/`, and
   `**/__pycache__/`. If one is present in the tree, say so — do not read its
   contents to decide.
4. Per `AGENTS.md`, a consumer-visible change to a public package needs its
   Changeset in the same commit. Add it before committing, not after. CI
   enforces this: `.github/workflows/release-intent.yml` fails the pull request
   when a release-sensitive path changed without one, and the
   `no-release-needed` label is a maintainer's call with a written reason, not
   a way to get a check green.
5. Write the message to a file and use `git commit -F <file>`, so wrapping and
   punctuation survive the shell.
6. Let the pre-commit hook run. It is `lint-staged` running Prettier; never
   bypass a failed hook with `--no-verify`. If it rewrote files, review the
   result and amend rather than stacking a fixup.
7. `git log -1 --stat` to confirm what landed.
8. Do not push unless asked. On the default branch, branch first.

Report the commit hash, the subject, and the number of files changed, and say
that the commit is local and has not been pushed.

## Examples

Good:

```
fix(part-viewer): hold what is being typed in a rule's number entry

Sizes on a match rule were keyed by their own value, so a keystroke changed
the key of the box being typed into and React remounted it. They are keyed by
position now.

An emptied box no longer means zero: the stored number stands until blur.
`no go past`, where empty is a real setting, clears through `onClear`.
```

Bad — history, process, attribution, padding:

```
fix: fixed the number input bug

I first tried keying by id but that didn't work, so after some debugging I
realised React was remounting. Made the code much cleaner as requested in
review. All tests pass now!

<generated-by line>
<co-authored-by trailer naming an agent and its address>
```
