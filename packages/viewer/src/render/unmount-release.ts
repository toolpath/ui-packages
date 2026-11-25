/**
 * When something a component holds is freed after it has gone: on the next task.
 *
 * React's StrictMode runs an effect's cleanup and then its setup again on a
 * component that stays — on mount, and when a `<Suspense>` shows its content.
 * Freed in the cleanup itself, what is still drawn would be freed under it;
 * `mounted` cancels what `unmounted` set off.
 */
export const createUnmountRelease = (release: { gone(): void }) => {
  let pending: ReturnType<typeof setTimeout> | undefined
  return {
    mounted: (): void => {
      clearTimeout(pending)
      pending = undefined
    },
    unmounted: (): void => {
      pending = setTimeout(() => release.gone(), 0)
    },
  }
}
