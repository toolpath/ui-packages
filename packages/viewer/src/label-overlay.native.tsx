import { useState, useSyncExternalStore } from 'react'
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import { AXIS_COLORS } from './render/measure.js'
import { type ProjectedLabel, labelHitSlop } from './render/label-store.js'
import { type ViewerTheme, cssHex } from './render/theme.js'
import type { LabelOverlayProps } from './label-overlay.js'

export type { LabelOverlayProps } from './label-overlay.js'

type LabelTheme = NonNullable<ViewerTheme['labels']>

/** `theme.labels` when a theme leaves it out: the measure tool's look on the web. */
const DEFAULT_LABELS: LabelTheme = {
  text: '#1f2330',
  background: 'rgba(255,255,255,0.92)',
  border: '#4f8ef7',
  axis: { x: cssHex(AXIS_COLORS.x), y: cssHex(AXIS_COLORS.y), z: cssHex(AXIS_COLORS.z) },
  fontSize: 12,
}

/**
 * Every visible label in the store, as a view over the canvas, centred on its
 * point. It fills the canvas and takes no touches itself (`box-none`), so the
 * canvas under it keeps every gesture a label does not answer.
 */
export const LabelOverlay = ({ store, theme }: LabelOverlayProps) => {
  const labels = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const resolved = theme ?? DEFAULT_LABELS

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {labels.map((label) =>
        label.visible ? <Label key={label.id} label={label} theme={resolved} /> : null,
      )}
    </View>
  )
}

const Label = ({ label, theme }: { label: ProjectedLabel; theme: LabelTheme }) => {
  // Centred on its point once its own size is known; until then it is laid out
  // but not shown, so it never flashes at its corner.
  const [size, setSize] = useState({ width: 0, height: 0 })
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (width !== size.width || height !== size.height) setSize({ width, height })
  }

  const border = label.color ?? (label.axis ? theme.axis[label.axis] : theme.border)
  const style = [
    styles.label,
    {
      backgroundColor: theme.background,
      borderColor: border,
      opacity: size.width > 0 ? 1 : 0,
      transform: [
        { translateX: label.x - size.width / 2 },
        { translateY: label.y - size.height / 2 },
      ],
    },
  ]
  const text = (
    <Text style={{ color: theme.text, fontSize: theme.fontSize }}>
      {label.note ? `${label.text} ${label.note}` : label.text}
    </Text>
  )

  // Found by its kind in an app's tests, as a web label is by `data-measure-label`.
  const testID = `scene-label-${label.kind}`
  return label.onPress ? (
    <Pressable
      onPress={label.onPress}
      onLayout={onLayout}
      hitSlop={labelHitSlop(size)}
      style={style}
      testID={testID}
      accessibilityRole="button"
    >
      {text}
    </Pressable>
  ) : (
    <View onLayout={onLayout} style={style} pointerEvents="none" testID={testID}>
      {text}
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
})
