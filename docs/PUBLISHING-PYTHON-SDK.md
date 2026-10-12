# Publishing the Python SDK to PyPI

The Python SDK (`toolpath`, in `packages/sdk-python/`) publishes to PyPI from the
`python-sdk-publish` job in `.github/workflows/release.yml`. The wheel carries `@toolpath/api`'s
version. After every release run with no release PR pending, `scripts/check-pypi-release.mjs`
asks PyPI for that version, and the job publishes it when PyPI does not have it. So a release
publishes both SDKs, and a manual **Run workflow** of "Release public packages" publishes a version
npm already has but PyPI does not. It uses PyPI trusted publishing (GitHub Actions OIDC). Do not
add a PyPI token to the workflow.

## One-time setup

PyPI, unlike npm, accepts a trusted publisher for a project that does not exist yet (a "pending
publisher"). The first CI publish then creates the project, so there is no manual first upload.

1. Sign in to pypi.org with the Toolpath account that should own the project.
2. Open **Your account → Publishing → Add a new pending publisher → GitHub**, and enter:
   - PyPI project name: `toolpath`
   - Owner: `toolpath`
   - Repository name: `ui-packages`
   - Workflow name: `release.yml`
   - Environment name: `pypi`
3. In GitHub, open **toolpath/ui-packages → Settings → Environments** and create `pypi`. Add
   required reviewers there if a person should approve each PyPI publish.

The trust is bound to the workflow file name and the environment. A job in another file, or
without `environment: pypi`, cannot publish.

A pending publisher does not reserve the name; the first publish does. Once the setup is done, run
"Release public packages" from the Actions tab, on `main`. Only `main` publishes to PyPI.

## If a publish fails

Re-run the failed `python-sdk-publish` job, or run the workflow again. `uv publish --check-url` skips a version PyPI already
has, so a re-run never tries to overwrite a published file. PyPI never accepts a second upload of
a version, even a deleted one.
