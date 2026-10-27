import { TrashIcon } from '@phosphor-icons/react'
import type { SectionState } from '@toolpath/viewer'

interface AnalysisOptionsProps {
  sectioning: boolean
  measuring: boolean
  cut: SectionState | null
  offset: number
  onOffsetChange: (offset: number) => void
  onClearCut: () => void
  onClearMeasurements: () => void
}

/** The single options card shared by sectioning and measuring. */
export const AnalysisOptions = ({
  sectioning,
  measuring,
  cut,
  offset,
  onOffsetChange,
  onClearCut,
  onClearMeasurements,
}: AnalysisOptionsProps) => {
  if (!sectioning && !measuring) return null

  return (
    <div
      className="viewer-tool-options analysis-options"
      role="group"
      aria-label="Section and measure options"
    >
      {sectioning ? (
        cut ? (
          <>
            <input
              className="cut-slider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={offset}
              aria-label="Cut depth"
              onChange={(event) => onOffsetChange(Number(event.target.value))}
            />
            <button
              className="tool-icon-button"
              type="button"
              aria-label="Clear cut"
              onClick={onClearCut}
            >
              <TrashIcon className="viewer-tool-icon" size={23} weight="regular" />
            </button>
          </>
        ) : (
          <span className="viewer-hint">Click a face or a plane · Esc clears</span>
        )
      ) : null}
      {sectioning && measuring ? <span className="analysis-divider" aria-hidden="true" /> : null}
      {measuring ? (
        <button
          className="tool-icon-button"
          type="button"
          aria-label="Clear measurements"
          onClick={onClearMeasurements}
        >
          <TrashIcon className="viewer-tool-icon" size={23} weight="regular" />
        </button>
      ) : null}
    </div>
  )
}
