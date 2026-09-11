import {
  isCoarsePointer as _isCoarsePointer,
  useDefaultLayout as _useDefaultLayout,
  useGroupCallbackRef as _useGroupCallbackRef,
  useGroupRef as _useGroupRef,
  usePanelCallbackRef as _usePanelCallbackRef,
  usePanelRef as _usePanelRef,
} from 'react-resizable-panels'
import type {
  GroupImperativeHandle as _GroupImperativeHandle,
  GroupProps as _GroupProps,
  Layout as _Layout,
  LayoutStorage as _LayoutStorage,
  OnGroupLayoutChange as _OnGroupLayoutChange,
  OnPanelResize as _OnPanelResize,
  Orientation as _Orientation,
  PanelImperativeHandle as _PanelImperativeHandle,
  PanelProps as _PanelProps,
  PanelSize as _PanelSize,
  SeparatorProps as _SeparatorProps,
  SizeUnit as _SizeUnit,
} from 'react-resizable-panels'
import { Collapsed as _Collapsed } from './collapsed'
import type { CollapsedProps as _CollapsedProps } from './collapsed'
import { useOrientation as _useOrientation } from './orientation-context'
import { Group as _Group } from './group'
import { Panel as _Panel } from './panel'
import { Separator as _Separator } from './separator'

export namespace Panels {
  export const Group = _Group
  export const Panel = _Panel
  export const Separator = _Separator
  export const Collapsed = _Collapsed
  export const isCoarsePointer = _isCoarsePointer
  export const useDefaultLayout = _useDefaultLayout
  export const useGroupCallbackRef = _useGroupCallbackRef
  export const useGroupRef = _useGroupRef
  export const usePanelCallbackRef = _usePanelCallbackRef
  export const useOrientation = _useOrientation
  export const usePanelRef = _usePanelRef

  export type GroupImperativeHandle = _GroupImperativeHandle
  export type GroupProps = _GroupProps
  export type Layout = _Layout
  export type LayoutStorage = _LayoutStorage
  export type OnGroupLayoutChange = _OnGroupLayoutChange
  export type OnPanelResize = _OnPanelResize
  export type Orientation = _Orientation
  export type PanelImperativeHandle = _PanelImperativeHandle
  export type PanelProps = _PanelProps
  export type PanelSize = _PanelSize
  export type SeparatorProps = _SeparatorProps
  export type SizeUnit = _SizeUnit
  export type CollapsedProps = _CollapsedProps
}
