import React, { ReactNode, SVGProps } from 'react'
import { cn } from './cn'

interface Props extends SVGProps<SVGSVGElement> {
  className?: string
  children: ReactNode
}

function Svg({ children, className = '', ...props }: Props) {
  return (
    <svg className={cn('pointer-events-none fill-current', className)} {...props}>
      {children}
    </svg>
  )
}

export default Svg
