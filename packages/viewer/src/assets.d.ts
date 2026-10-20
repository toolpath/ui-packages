// A bundled model, as Metro hands it to the React Native build: an asset id
// for `expo-asset` to resolve.
declare module '*.glb' {
  const asset: number
  export default asset
}
