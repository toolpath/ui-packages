---
name: pr
description: Prepares GitHub pull requests, including descriptions, publication, CI fixes, and review feedback. Use when asked to create, update, or finish a PR; follow the requested scope.
---

# Prepare a pull request

Follow the requested scope: for a title/body-only update, use steps 1 and 3. Full PR preparation includes scoped commits and pushing the branch. Preserve unrelated work, use the [commit skill](../commit/SKILL.md), and never force-push or merge without authorization. Keep a draft when the user requests one.

1. **Establish the change.** Inspect repo instructions, working tree, branch, remotes, and PR state with `git` and `gh`. Use the supplied PR or the current branch's PR; reuse it rather than opening a duplicate. Resolve the actual base and head SHAs and read `git diff <base-sha>...<head-sha>` plus pending local changes. Do not assume `main`. Stop if the requested PR is already merged or closed.
2. **Prepare and publish.** Run relevant local checks, inspect the diff, and follow the repo's release policy. Commit only scoped changes and push the intended branch. Create or update the PR; use a draft while work remains.
3. **Describe the result.** Follow the repo's template and title rules. Lead with the concrete problem and resulting behavior; usually one or two sentences plus actual validation suffice. Link known issues. Omit session history, invented tickets, empty sections, and unverified claims. Pass multiline descriptions through `gh pr create --body-file <file>` or `gh pr edit --body-file <file>`. Finish here for metadata-only requests.
4. **Resolve CI and conflicts.** Inspect checks and failed logs with `gh pr checks` and `gh run view <run-id> --log-failed`. Diagnose failures before changing code or rerunning jobs. Fix demonstrated regressions, validate locally, commit, and push; never weaken tests or bypass checks. If conflicted, fetch and merge the actual base, preserve both changes' intent, and validate. Recheck unknown mergeability. A green, conflict-free PR needs no extra synchronization merely because its base advanced.
5. **Review independently.** Give a fresh subagent the [review skill](../review/SKILL.md), requirements, base/head SHAs, and relevant context. Select model and effort for the task. Validate findings against the code before fixing them; explain rejected findings with evidence. After a new commit, refresh the diff and revalidate affected findings and checks.
6. **Finish against the latest head.** Confirm required checks and repo-required workflows pass, review findings are addressed, and GitHub reports no conflicts. Report absent or unavailable checks accurately. Back off while waiting on unchanged runs. Stop for missing access, an external blocker, a merged/closed PR, or a decision requiring the user. Mark a completed draft ready unless the user requested a draft. Report the PR URL, checked head, validation, and remaining limitations.
