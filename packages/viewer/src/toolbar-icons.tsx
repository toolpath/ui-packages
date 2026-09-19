import type { ReactNode } from 'react'

interface SvgIconProps {
  viewBox?: string
  fill?: string
  children: ReactNode
}

const SvgIcon = ({ viewBox = '0 0 24 24', fill = 'none', children }: SvgIconProps) => (
  <svg
    viewBox={viewBox}
    fill={fill}
    stroke={fill === 'none' ? 'currentColor' : 'none'}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const FitIcon = () => (
  <SvgIcon>
    <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z" />
  </SvgIcon>
)

const ResetIcon = () => (
  <SvgIcon>
    <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />
  </SvgIcon>
)

const TopIcon = () => (
  <SvgIcon>
    <path d="M4 7l8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10" />
  </SvgIcon>
)

const StockIcon = () => (
  <SvgIcon>
    <path d="M3 6l9-4 9 4v12l-9 4-9-4zM3 6l9 4 9-4M12 10v12M7 8v8l5 2 5-2V8" />
  </SvgIcon>
)

const AxesIcon = () => (
  <SvgIcon>
    <path d="M5 19V3m0 16h16M5 19l10-10M2 6l3-3 3 3m10 10 3 3-3 3M11 9h4v4" />
  </SvgIcon>
)

const GridIcon = () => (
  <SvgIcon>
    <path d="M3 8l9-5 9 5-9 5zM3 8v8l9 5 9-5V8M12 13v8M7.5 5.5v8M16.5 5.5v8" />
  </SvgIcon>
)

const BananaIcon = () => (
  <SvgIcon viewBox="0 0 576 512" fill="currentColor">
    <path d="M284.2 245.6c12.99 6.929 25.35 15.14 36.08 25.8L334.5 285.6l65.75-23.47c14.75-5.265 30.18-7.849 45.81-8.389c1.154-10.73 1.764-21.38 1.764-31.87c0-118.5-81.33-221.9-119.7-221.9c-21.01 0-40.91 17.04-40.91 39.25c0 16.18 16.74 41.9 16.74 103C303.1 170.1 300.6 203.1 284.2 245.6zM575.1 389.6c0-3.687-.8637-7.429-2.687-10.93l-15.12-29.11c-21.05-40.53-63.08-64.51-106.9-64.51c-13.43 0-27.02 2.252-40.22 6.969l-84.84 30.27l-28.59-28.41C274.4 270.9 243.7 258.1 212.8 258.1c-23.72 0-47.57 6.97-68.29 21.2L106.3 306.4c-6.732 4.631-10.35 12.07-10.35 19.63c0 14.93 12.7 23.87 24.04 23.87c4.695 0 9.443-1.376 13.61-4.26l38.13-26.23c12.43-8.525 26.71-12.69 40.91-12.69c10.64 0 21.24 2.339 30.97 6.934c-50.62 62.23-128.3 99.85-211.4 99.85C14.42 413.5 0 427.8 0 445.5v31.38c0 17.68 14.66 32.02 32.46 32.02l28.98.0009c14.15 0 34.69 1.098 59.07 1.098c93.51 0 243.4-16.15 304.8-172.4c9.021-3.22 17.95-4.712 26.53-4.712c27.65 0 51.7 15.49 63.7 38.55l15.12 29.11c3.484 6.723 11.74 12.98 21.41 12.98C564.1 413.6 575.1 403.8 575.1 389.6z" />
  </SvgIcon>
)

const DirectionsIcon = () => (
  <SvgIcon>
    <path d="M7 3v18m-4-4 4 4 4-4M17 21V3m-4 4 4-4 4 4" />
  </SvgIcon>
)

const HoverIcon = () => (
  <SvgIcon>
    <path d="M4 4h16v12H9l-5 4zm4 5h8m-8 3h5" />
  </SvgIcon>
)

const FocusIcon = () => (
  <SvgIcon>
    <path d="M4 4h16v16H4zM8 8h8v8H8zM2 12h4m12 0h4M12 2v4m0 12v4" />
  </SvgIcon>
)

const WireframeIcon = () => (
  <SvgIcon>
    <path d="M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10M4 17l8-4 8 4M12 3v10" />
  </SvgIcon>
)

const SectionIcon = () => (
  <SvgIcon>
    <path d="M3 6h9v12H3zM12 3v18M16 6h2m3 3v2m0 3v2m-5 3h-2" />
  </SvgIcon>
)

const MeasureIcon = () => (
  <SvgIcon>
    <path d="M3 16L16 3l5 5L8 21zM8 11l3 3m1-7 3 3m-11 5 3 3" />
  </SvgIcon>
)

export type ToolbarIconName =
  | 'fit'
  | 'reset'
  | 'top'
  | 'stock'
  | 'axes'
  | 'grid'
  | 'banana'
  | 'directions'
  | 'hover'
  | 'focus'
  | 'wireframe'
  | 'section'
  | 'measure'

const ICONS: Record<ToolbarIconName, () => ReactNode> = {
  fit: FitIcon,
  reset: ResetIcon,
  top: TopIcon,
  stock: StockIcon,
  axes: AxesIcon,
  grid: GridIcon,
  banana: BananaIcon,
  directions: DirectionsIcon,
  hover: HoverIcon,
  focus: FocusIcon,
  wireframe: WireframeIcon,
  section: SectionIcon,
  measure: MeasureIcon,
}

export const ToolbarIcon = ({ name }: { name: ToolbarIconName }) => {
  const Icon = ICONS[name]
  return <Icon />
}
