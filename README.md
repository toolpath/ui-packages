# Toolpath

The source for the published Toolpath packages: open-source SDKs and UI packages for building
applications with the [Toolpath API](https://developers.toolpath.com).

Toolpath analyzes a CAD part so you can understand whether it fits your shop, how it can be
machined, and what it may cost.

## Packages

| I want to…                     | Use                             | Documentation                                                      |
| ------------------------------ | ------------------------------- | ------------------------------------------------------------------ |
| Call Toolpath from JavaScript  | `@toolpath/api`                 | [TypeScript SDK](packages/sdk-typescript)                          |
| Call Toolpath from Python      | `toolpath`                      | [Python SDK](packages/sdk-python)                                  |
| Show a part in a React app     | `@toolpath/viewer`              | [Viewer](packages/viewer)                                          |
| Build UI, DFM views included   | `@toolpath/ui`                  | [UI kit](packages/ui)                                              |
| Collect vendor tool data       | `@toolpath/tool-scraper`        | [Tool scraper](packages/tool-scraper)                              |
| Draw a tool and its holder     | `@toolpath/tool-drawing`        | [Tool drawing](packages/tool-drawing)                              |
| Check parts for DFM rules      | `@toolpath/dfm`                 | [DFM](packages/dfm)                                                |
| Build plan mode (pins, setups) | `@toolpath/plan`                | [Plan](packages/plan)                                              |
| Share quote flow rules         | `@toolpath/quoting`             | [Quoting](packages/quoting)                                        |
| Share the cutting-tool domain  | `@toolpath/tool-support`        | [Tool support](packages/tool-support)                              |
| Share application logic        | `@toolpath/app-support`         | [App support](packages/app-support)                                |
| Share lint and format config   | `@toolpath/dev-config`          | [Dev config](packages/dev-config)                                  |
| Start a customer application   | Part Viewer template            | [toolpath-template](https://github.com/toolpath/toolpath-template) |
| Call the API without an SDK    | HTTP, cURL, or another language | [API documentation](https://developers.toolpath.com)               |

Each package's README is its full documentation. The npm packages install from npm as usual. The
Python SDK is not on PyPI: each version ships as a wheel on the GitHub release
`python-sdk-v<version>`; its [README](packages/sdk-python) shows how to install one.

Both SDKs are generated from one OpenAPI document,
[`packages/sdk-typescript/openapi/openapi.json`](packages/sdk-typescript/openapi/openapi.json), so
their request and response types match the public API contract. For guides, authentication and the
HTTP API, read the [developer documentation](https://developers.toolpath.com); for a working
application to start from, use [toolpath-template](https://github.com/toolpath/toolpath-template).

## Generated from a private monorepo

The packages are developed in a private monorepo, and `packages/` here is generated from it. Issues
are welcome. Pull requests from forks are closed automatically, because they cannot be merged here;
please open an issue describing the change instead.

## Building from source

You need [Node.js 24.18+](https://nodejs.org/en/download) with Corepack, and
[uv](https://docs.astral.sh/uv/getting-started/installation/) for the Python SDK.

```bash
git clone https://github.com/toolpath/ui-packages.git
cd ui-packages
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

`pnpm build` and `pnpm test` build and test every package; `pnpm --filter @toolpath/sdk-python
package` builds the Python wheel. These tools are for building this repository: a package installed from npm
needs neither Corepack nor pnpm, and runs on Node.js 20 or newer.

## License

This project is licensed under the [MIT License](LICENSE).
