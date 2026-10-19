import { useRef, type FC, type ReactElement, type ReactNode } from 'react'
import { CheckIcon, CopyIcon, DownloadSimpleIcon, UploadSimpleIcon } from '@phosphor-icons/react'
import { Button, cn } from '@toolpath/ui'
import type { RuleVocabulary } from '../model/dfm-metrics.js'
import { llmRulePrompt, parseRuleSetFile, serializeRuleSet } from '../model/rule-set-file.js'
import type { DfmRules } from './types.js'
import { useTimedValue } from './use-timed-value.js'

/** How long a word of feedback under the footer stays, ms. */
const NOTE_MS = 4000

/** How long "Copied" stands in for "Copy LLM prompt", ms. */
const COPIED_MS = 2000

/**
 * The footer under the rules: import a set from a file, export this one, and
 * copy a prompt that has an LLM write one, then the app's own buttons. A set
 * is one JSON file (`rule-set-file.ts`), so it can be kept per customer or
 * material and passed around. A set is one process's rules: it is saved
 * under the vocabulary's file name, and one of the other process's is
 * refused on import.
 */
export const RuleSetActions: FC<{
  rules: DfmRules
  actions?: ReactNode
  vocabulary: RuleVocabulary
}> = ({ rules, actions, vocabulary }): ReactElement => {
  const [note, setNote] = useTimedValue<string>(NOTE_MS)
  const [copied, setCopied] = useTimedValue<true>(COPIED_MS)
  const fileInput = useRef<HTMLInputElement>(null)

  const importRules = async (file: File | undefined): Promise<void> => {
    if (!file) return
    let text: string
    try {
      text = await file.text()
    } catch {
      setNote('Could not import: the file could not be read.')
      return
    }
    const read = parseRuleSetFile(text, vocabulary)
    if ('error' in read) {
      setNote(`Could not import: ${read.error}`)
      return
    }
    rules.replace(read.rules)
    setNote(importedNote(read.rules.length, read.skipped, read.name))
  }
  const copyPrompt = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(llmRulePrompt(rules.rules, vocabulary))
    } catch {
      setNote('Could not copy the prompt. Allow clipboard access and try again.')
      return
    }
    setCopied(true)
    setNote('Paste the prompt into an LLM, then import the JSON it writes.')
  }

  return (
    <div className="flex flex-col gap-2 px-4 pt-2 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => fileInput.current?.click()}>
          <ActionLabel icon={<UploadSimpleIcon weight="bold" />}>Import…</ActionLabel>
        </Button>
        <Button variant="secondary" onClick={() => downloadRuleSet(rules, vocabulary)}>
          <ActionLabel icon={<DownloadSimpleIcon weight="bold" />}>Export</ActionLabel>
        </Button>
        <Button
          variant="secondary"
          title="Copies a prompt that walks an LLM through writing a rule set for you"
          onClick={() => void copyPrompt()}
        >
          {/* Both labels hold the same cell, so the button keeps its width as "Copied" shows. */}
          <span className="grid justify-items-center *:col-start-1 *:row-start-1">
            <ActionLabel hidden={copied !== null} icon={<CopyIcon weight="bold" />}>
              Copy LLM prompt
            </ActionLabel>
            <ActionLabel hidden={copied === null} icon={<CheckIcon weight="bold" />}>
              Copied
            </ActionLabel>
          </span>
        </Button>
        {actions}
        <input
          ref={fileInput}
          type="file"
          aria-label="Rule set file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            void importRules(event.currentTarget.files?.[0])
            event.currentTarget.value = ''
          }}
        />
      </div>
      {note ? (
        <p className="text-xs text-gray-500 dark:text-zinc-400" role="status">
          {note}
        </p>
      ) : null}
    </div>
  )
}

interface ActionLabelProps {
  icon: ReactNode
  children: ReactNode
  /** Kept in the layout, unseen and unread: the other label of the same button is showing. */
  hidden?: boolean
}

/** A footer button's icon and words, side by side. */
const ActionLabel: FC<ActionLabelProps> = ({ icon, children, hidden = false }): ReactElement => (
  <span
    aria-hidden={hidden || undefined}
    className={cn('flex items-center gap-1.5 [&>svg]:size-3.5', hidden && 'invisible')}
  >
    {icon}
    {children}
  </span>
)

/** Saves the rules as a rule-set file, through the browser's download, under the vocabulary's file name. */
const downloadRuleSet = (rules: DfmRules, vocabulary: RuleVocabulary): void => {
  const url = URL.createObjectURL(
    new Blob([serializeRuleSet(rules.rules, {}, vocabulary)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = vocabulary.fileName
  link.click()
  URL.revokeObjectURL(url)
}

const importedNote = (count: number, skipped: number, name: string | undefined): string => {
  const rulesRead = `Imported ${count} rule${count === 1 ? '' : 's'}`
  const named = name ? ` (${name})` : ''
  const skippedSome = skipped > 0 ? `, ${skipped} skipped` : ''
  return `${rulesRead}${named}${skippedSome}`
}
