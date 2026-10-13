# Toolpath Python SDK

`toolpath` provides generated Python bindings and a presigned-upload helper for the Toolpath Engine API.

Each version is a wheel on a GitHub release of this repository, tagged `python-sdk-v<version>`.
Install it from that release's URL:

```bash
uv add "toolpath @ https://github.com/toolpath/ui-packages/releases/download/python-sdk-v0.8.1/toolpath-0.8.1-py3-none-any.whl"
# or
pip install https://github.com/toolpath/ui-packages/releases/download/python-sdk-v0.8.1/toolpath-0.8.1-py3-none-any.whl
```

Its version matches the `@toolpath/api` TypeScript SDK built from the same API contract. See the
[releases](https://github.com/toolpath/ui-packages/releases) for the newest `python-sdk-v` tag.

Create an API key in the [Toolpath portal](https://portal.toolpath.com/api-keys). See the
[Python example](../../examples/python) and [API documentation](https://developers.toolpath.com) for a
complete part-analysis flow.

## License

MIT
