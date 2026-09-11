import React, {
  AnchorHTMLAttributes,
  ComponentType,
  createContext,
  ReactNode,
  Ref,
  useContext,
} from 'react'

export type LinkComponentProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref?: Ref<HTMLAnchorElement>
}

type LinkContextValue = {
  LinkComponent: ComponentType<LinkComponentProps>
}

const LinkContext = createContext<LinkContextValue | null>(null)

export const useLinkContext = () => {
  return useContext(LinkContext)
}

export type LinkProviderProps = {
  children: ReactNode
  component: ComponentType<LinkComponentProps>
}

export const LinkProvider = ({ children, component }: LinkProviderProps) => {
  return (
    <LinkContext.Provider value={{ LinkComponent: component }}>{children}</LinkContext.Provider>
  )
}
