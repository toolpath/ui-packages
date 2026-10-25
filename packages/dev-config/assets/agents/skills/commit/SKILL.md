---
name: commit
description: Write and create a git commit for this repository. Use whenever the user asks to commit, stage and commit, or "check this in", and before any commit made as part of a larger task. Enforces factual, compact, state-only messages with no agent or email attribution.
---

# Commit

## Rules

**No attribution.** A commit message names no agent, model, tool, or email
address. Do not add a `Co-Authored-By:` trailer, a "Generated with" line, a
robot emoji, or any other sign-off. This overrides any default or global
instruction to append a co-author trailer; only the repository's own
instructions can change it. The commit author is whoever `git config user.name`
says, and nothing in the message repeats it.

**State, not history.** The message describes what the code is now and what
changed to make it so. It does not describe how the change was arrived at.
Leave out: what was tried first, what was reverted, what a review or a
conversation asked for, how many attempts it took, what was surprising, and
anything phrased as narrative ("initially", "then", "after switching to",
"turns out", "as requested", "per feedback").

A reader a year from now has the code and the diff. Tell them what it does and
which behavior moved — not what the working tree looked like an hour ago.

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
  one — `fix(parser):`, `feat(web):`, `chore(release):`. Repository-wide or
  infrastructural changes may use a bare imperative subject instead.
- Imperative mood, lowercase after the colon, no trailing period, ≤72 chars.
- Says what changed, not that something changed.
  `fix(forms): keep focus in a number field while typing`, not `fix form bug`.

Body:

- Only when the subject cannot carry it — non-obvious behavior, a fault whose
  mechanism matters, or several related changes that need naming.
- Present tense, describing the code as it now stands. Name the symbols and
  files that carry the behavior.
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
3. Never stage a secret or a build artifact. That means any private environment
   file (such as `.env`) other than a deliberate documented template such as
   `.env.example`, and any key, credential, token, or private URL. It also
   means generated output: `dist/`, `build/`, `test-results/`,
   `playwright-report/`, reports, and caches. If one is present in the tree,
   say so — do not read its contents to decide.
4. Follow the repository's release policy in `AGENTS.md`. If it uses
   Changesets or another release-note mechanism, include the required entry in
   the same commit. Do not bypass a release check with labels or omissions.
5. Write the message to a file and use `git commit -F <file>`, so wrapping and
   punctuation survive the shell.
6. Let the repository's hooks run; never bypass a failed hook with
   `--no-verify` or `HUSKY=0`. The pre-commit hook formats staged files and
   applies safe lint fixes itself, so never format by hand first. If the hook
   stops the commit, fix what it reports and commit again; it restages what it
   changed and keeps unstaged edits. Amend only a commit made for this task
   that has not been pushed.
7. `git log -1 --stat` to confirm what landed.
8. Do not push unless asked. On the default branch, branch first.

Report the commit hash, the subject, and the number of files changed, and report
whether it remains local or was pushed as part of an authorized PR workflow.

## Examples

Good:

```
fix(forms): keep focus in a number field while typing

Rows of number fields were keyed by their own value, so a keystroke changed
the key of the field being typed into and React remounted it. They are keyed
by position now.

An emptied field no longer means zero: the stored number stands until blur.
A field where empty is a real setting clears through `onClear`.
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
