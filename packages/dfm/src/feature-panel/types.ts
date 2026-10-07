import type { ComponentType, ReactElement, ReactNode } from 'react'
import type { DfmFeature } from '../model/geometry.js'

/** What the panel needs to name a feature: its tag, its type, and the way it is machined from. */
export type FeatureIdentity = Pick<DfmFeature, 'tag' | 'featureType' | 'machiningDirection'>

/**
 * Something the app reads for the panel, and how far it has got: the panel
 * says what it is waiting on, or what went wrong, in place of the section.
 */
export type Loadable<T> =
  | { readonly status: 'loading' }
  | {
      readonly status: 'error'
      /** In the app's own words: the API's answer, or that it asked to wait. */
      readonly message: string
      /** Reads it again; left out, there is no Retry. */
      readonly retry?: () => void
      /** No Retry before this, in `Date.now()` milliseconds: what a 429's `Retry-After` asks. */
      readonly retryAt?: number
    }
  | { readonly status: 'ready'; readonly value: T }

/** Which of a feature's sections pops out into a window of its own. */
export type PopOutId = 'reach' | 'datasheet' | 'raw'

/**
 * The app's window for a section popped out of the panel. The panel decides
 * when one is open and what is in it; the app draws the frame — moved and
 * sized as its page allows — and calls `onClose`. Define it once, at module
 * level: one written inline remounts the window on every render. Render it
 * through a portal to the page's body: the panel blurs what is behind it,
 * which makes the panel the box a `fixed` window inside it is placed in.
 */
export interface PopOutWindowProps {
  id: PopOutId
  title: string
  /** Under the title: the feature it is of. */
  subtitle: ReactNode
  icon: ReactElement
  /** In the header, before the close button: a copy button, say. */
  action?: ReactNode
  onClose: () => void
  children: ReactNode
}

export type PopOutWindow = ComponentType<PopOutWindowProps>
