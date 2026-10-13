# Python SDK releases

The Python SDK (`toolpath`, in `packages/sdk-python/`) is not on PyPI. Each version ships as a
wheel on a GitHub release of this repository, tagged `python-sdk-v<version>`, and installs from
that URL:

```sh
uv add "toolpath @ https://github.com/toolpath/ui-packages/releases/download/python-sdk-v0.8.1/toolpath-0.8.1-py3-none-any.whl"
# or
pip install https://github.com/toolpath/ui-packages/releases/download/python-sdk-v0.8.1/toolpath-0.8.1-py3-none-any.whl
```

The repository is public, so the download needs no sign-in.

## How a release happens

The wheel carries `@toolpath/api`'s version. After every release run on `main` with no release PR
pending, `scripts/check-python-sdk-release.mjs` looks for the `python-sdk-v<version>` release. When
it is missing, the `python-sdk-release` job in `.github/workflows/release.yml` builds the wheel
from the commit that run released, installs it in a clean environment, and creates the release
with the wheel attached. So a release ships both SDKs, and a manual **Run workflow** of "Release
public packages" on `main` creates a Python release that is missing. There is no setup and no
token beyond the workflow's own.

## If a release fails

Re-run the failed `python-sdk-release` job, or run the workflow again on `main`. The job skips a
release that already exists. If the job stopped while uploading, a draft release may be left
behind; delete it (`gh release delete python-sdk-v<version> --yes`) before the re-run. Do not replace the wheel on an existing release: anyone who installed
that version expects the same file.
