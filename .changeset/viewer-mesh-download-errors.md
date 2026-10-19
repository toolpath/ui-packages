---
'@toolpath/viewer': patch
---

Stop failed mesh downloads from repeatedly restarting under Suspense. Preserve
the failure for the error boundary, allow refreshed signed URLs to retry, and
continue sharing successfully loaded geometry by artifact path.
