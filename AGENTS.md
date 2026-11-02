# Toolpath UI packages

This repository publishes Toolpath's open-source npm packages (`@toolpath/api`, `@toolpath/ui`,
`@toolpath/viewer` and the rest, under `packages/`) and the Python SDK (`packages/sdk-python`).
Each package's README documents its use; to build an application with them, start from
[developers.toolpath.com](https://developers.toolpath.com) and
[toolpath-template](https://github.com/toolpath/toolpath-template).

## Generated from a private monorepo

`packages/` and `pnpm-lock.yaml` are generated from a private monorepo where the packages are
developed, versioned and reviewed; the root files are maintained here by repository members,
through pull requests from branches in this repository. Pull requests from forks are closed
automatically, whatever they change, and `packages/` cannot be changed here at all: report a
problem or propose a change in an issue instead. Do not edit package versions or changelogs here.

Releases publish from a `release-*` tag the monorepo pushes for each release, never from a push to
`main` (`.github/workflows/release.yml`).

## Build and test

Use the toolchain pinned in `.tool-versions` and `package.json`: Node 24, pnpm 10, and uv for the
Python SDK. Published packages declare their own runtime floors, below the contributor toolchain.

| Purpose              | Command                                                           |
| -------------------- | ----------------------------------------------------------------- |
| Install              | `pnpm install --frozen-lockfile`                                  |
| One package          | `pnpm --filter @toolpath/viewer test` (or `build`, `check-types`) |
| Everything           | `pnpm build && pnpm test`                                         |
| Python wheel         | `pnpm --filter @toolpath/sdk-python package`                      |
| Release scripts      | `node --test 'scripts/*.test.mjs'`                                |

A release builds and tests every package and builds the Python wheel. Report checks as passed, failed or skipped with a reason; a missing
prerequisite such as uv is a failure to set up, never a pass.

## The API contract

`packages/sdk-typescript/openapi/openapi.json` is the pinned Engine API contract both SDKs are
generated from; `openapi.sha256` and `release.json` beside it record its bytes and provenance. The
generated code (`packages/sdk-typescript/src/generated/`, `packages/sdk-python/toolpath/generated/`)
is never edited by hand. Stable SDKs follow the healthy production API; `@toolpath/api@staging`
prereleases follow staging. A deployed server's `/v1/openapi.json` is the authority for what it
serves: an SDK version, the API version it records and a deployment are separate things.

Keep API keys server-side and out of code, logs and fixtures, and never send one to a presigned
upload URL.
