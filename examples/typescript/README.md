# TypeScript part analysis

This command uses the local `@toolpath/api` workspace package to create a part, upload a STEP file,
start analysis, listen until the report is ready, fetch feature datasheets, and print the complete
report as JSON. `waitForJob` follows the job's event stream for progress rather than polling.

Run `pnpm install --frozen-lockfile` from the repository root first. Then replace the example API key
and file path below with your own values.

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

The final output is the complete report returned by the API:

```text
Analysis started as job 0195f02d-...
Analyzing geometry...
{
  "partId": "0195f02c-...",
  "jobId": "0195f02d-...",
  "features": []
}
```
