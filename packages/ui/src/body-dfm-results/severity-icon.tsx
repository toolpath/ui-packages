import type { FC, ReactElement } from 'react'
import { InfoIcon, WarningIcon } from '@phosphor-icons/react'
import type { DfmSeverity } from '@toolpath/dfm'

/**
 * The mark of a feature that breaks a rule: red where a rule in the critical
 * red is broken, amber for any other, nothing where none is. Sized by its
 * parent (`[&_svg]:size-4`).
 */
export const SeverityIcon: FC<{ severity: DfmSeverity | null | undefined }> = ({
  severity,
}): ReactElement | null =>
  severity === 'critical' ? (
    <WarningIcon weight="fill" className="text-danger" aria-label="Critical flag" />
  ) : severity === 'warning' ? (
    <InfoIcon
      weight="fill"
      className="text-warning-darken dark:text-warning"
      aria-label="Flagged"
    />
  ) : null
