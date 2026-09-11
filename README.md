# Toolpath

Official open-source SDKs, UI primitives, and examples for building applications with the
[Toolpath API](https://developers.toolpath.com).

Toolpath analyzes a CAD part so you can understand whether it fits your shop, how it can be
machined, and what it may cost.

## Where to start

| I want to…                    | Use                             | Documentation                                                      |
| ----------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| Call Toolpath from JavaScript | `@toolpath/api`                 | [TypeScript SDK](packages/sdk-typescript)                          |
| Call Toolpath from Python     | `toolpath`                      | [Python SDK](packages/sdk-python)                                  |
| Show a part in a React app    | `@toolpath/viewer`              | [Viewer](packages/viewer)                                          |
| Build Toolpath-styled UI      | `@toolpath/ui`                  | [UI kit](packages/ui)                                              |
| Collect vendor tool data      | `@toolpath/tool-scraper`        | [Tool scraper](packages/tool-scraper)                              |
| Draw a tool and its holder    | `@toolpath/tool-drawing`        | [Tool drawing](packages/tool-drawing)                              |
| Share the cutting-tool domain | `@toolpath/tool-support`        | [Tool support](packages/tool-support)                              |
| Share application logic       | `@toolpath/app-support`         | [App support](packages/app-support)                                |
| See usage examples            | TypeScript, Python, or React    | [Examples](#examples)                                              |
| Start a customer application  | Part Viewer template            | [toolpath-template](https://github.com/toolpath/toolpath-template) |
| Call the API without an SDK   | HTTP, cURL, or another language | [API documentation](https://developers.toolpath.com)               |

The SDKs are generated from the same OpenAPI document, so their request and response types match the
public API contract retained in this repository. They also provide a focused helper for directly
uploading to the presigned URL returned by the create-part operation.

## Before you begin

To analyze a part, you need:

1. A Toolpath account and API key. [Create a key in your Toolpath account](https://portal.toolpath.com/api-keys).
2. A STEP CAD file to upload.
3. One supported programming environment:
   - TypeScript/JavaScript: [Node.js 24](https://nodejs.org/en/download)
   - Python: [Python 3.11 or newer](https://www.python.org/downloads/)

## Examples

The TypeScript and Python examples create a part and upload its STEP file; your application controls
analysis and report retrieval through the generated API bindings:

- [TypeScript example](examples/typescript/README.md)
- [Python example](examples/python/README.md)

The React example renders a finished part with `@toolpath/viewer` instead of uploading one:

- [React viewer example](examples/react-viewer/README.md)

## Run the examples from source

### 1. Install the development tools

| Tool                                                          | What it does                                                   | Required for                    |
| ------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------- |
| [Git](https://git-scm.com/downloads)                          | Downloads the repository and tracks source changes             | All source workflows            |
| [Node.js 24.18+](https://nodejs.org/en/download)              | Runs the JavaScript tools; its installer also provides `npm`   | All source workflows            |
| Corepack                                                      | Activates the exact `pnpm` version declared by this repository | All source workflows            |
| pnpm                                                          | Installs and runs this repository's JavaScript dependencies    | All source workflows            |
| [Docker](https://www.docker.com/products/docker-desktop/)     | Runs the pinned TypeScript OpenAPI generator image             | SDK generation and `pnpm check` |
| [Python 3.11+](https://www.python.org/downloads/)             | Runs the Python SDK and example                                | Python only                     |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | Creates the Python environment and installs its dependencies   | Python only                     |

These are development tools for this repository, and so is the Node.js 24.18+ floor above. A
package installed from npm needs neither Corepack nor pnpm, and runs on Node.js 20 or newer.

Verify that Git and Node.js are available:

```bash
git --version
node --version
```

The Node.js version must be `v24.18.0` or newer within the `v24` release line.

### 2. Download and prepare the repository

Open PowerShell, Command Prompt, Terminal, or your editor's terminal, then run:

```bash
git clone https://github.com/toolpath/ui-packages.git
cd ui-packages
corepack enable pnpm
pnpm install --frozen-lockfile
```

### 3. Run the TypeScript part analysis example

Replace the sample key and file path with your own values.

Windows PowerShell:

```powershell
$env:TOOLPATH_API_KEY = "your-api-key"
pnpm --filter @toolpath/example-typescript analyze -- "C:\path\to\part.step"
```

Windows Command Prompt:

```batch
set TOOLPATH_API_KEY=your-api-key
pnpm --filter @toolpath/example-typescript analyze -- "C:\path\to\part.step"
```

macOS or Linux:

```bash
TOOLPATH_API_KEY="your-api-key" pnpm --filter @toolpath/example-typescript analyze -- "/path/to/part.step"
```

The command prints the complete analysis report after the report is ready.

### 4. Run the Python part analysis example

Install `uv` using its [platform-specific instructions](https://docs.astral.sh/uv/getting-started/installation/),
then set `TOOLPATH_API_KEY` as shown above.

Windows:

```powershell
uv run --project examples/python python examples/python/src/analyze_part.py "C:\path\to\part.step"
```

macOS or Linux:

```bash
uv run --project examples/python python examples/python/src/analyze_part.py "/path/to/part.step"
```

## Contributing

Agent and contributor instructions live in [AGENTS.md](AGENTS.md); it is the fuller guide, and this
section is the short version.

`pnpm check` is the gate. It runs `openapi:verify`, `generate:check`, `lint`, `build`,
`check-types`, and `test`, in that order. While implementing, run the narrowest thing instead —
`pnpm --filter @toolpath/viewer test` for one package — and save the full gate for the end.

**Docker must be running for `pnpm check`.** Its second step regenerates both SDKs in a pinned
`openapi-generator` container and compares the result against what is checked in, so a stopped
Docker daemon fails the gate before it ever reaches lint.

**A consumer-visible change to a public package needs a Changeset in the same pull request.** CI
enforces this and will fail the pull request without one. Add it with `pnpm changeset`, naming
every package the change affects, and see AGENTS.md for which paths belong to which package and
which bump to use. Never edit a package version or changelog by hand: the release workflow
generates both.

## Publishing a new npm package

New packages need a one-time bootstrap publish before npm trusted publishing can take over. See
[Bootstrapping npm packages](docs/BOOTSTRAPPING-NPM-PACKAGES.md).

## License

This project is licensed under the [MIT License](LICENSE).
