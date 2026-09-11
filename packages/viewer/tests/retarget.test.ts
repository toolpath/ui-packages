import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { retargetPose } from '../src/render/retarget.js'

const CAMERA = { x: 100, y: -120, z: 180 }
const TARGET = { x: 25, y: 25, z: 25 }

/** Camera minus target: the viewing direction and the distance along it. */
function offset(pose: { position: { x: number; y: number; z: number } }, target: typeof TARGET) {
  return new Vector3(
    pose.position.x - target.x,
    pose.position.y - target.y,
    pose.position.z - target.z,
  )
}

describe('retargetPose', () => {
  it('puts the orbit target on the clicked point', () => {
    const hit = { x: 40, y: 0, z: 12 }

    expect(retargetPose(CAMERA, TARGET, hit).target).toEqual(hit)
  })

  it('carries the camera along, so the part is the same size from the same angle', () => {
    const hit = { x: 40, y: 0, z: 12 }
    const pose = retargetPose(CAMERA, TARGET, hit)

    // The whole point: only the pivot moved. Had the target moved alone, this
    // offset would be a different direction and a different length, and the
    // part would appear to swing.
    const before = new Vector3(CAMERA.x - TARGET.x, CAMERA.y - TARGET.y, CAMERA.z - TARGET.z)
    expect(offset(pose, hit).toArray()).toEqual(before.toArray())
  })

  it('moves the camera by exactly what the target moved by', () => {
    const hit = { x: 40, y: 0, z: 12 }
    const pose = retargetPose(CAMERA, TARGET, hit)

    expect(pose.position).toEqual({
      x: CAMERA.x + (hit.x - TARGET.x),
      y: CAMERA.y + (hit.y - TARGET.y),
      z: CAMERA.z + (hit.z - TARGET.z),
    })
  })

  it('stands still for a click on what is already the pivot', () => {
    const pose = retargetPose(CAMERA, TARGET, TARGET)

    expect(pose.position).toEqual(CAMERA)
    expect(pose.target).toEqual(TARGET)
  })

  it('leaves the camera where it is when it sits on its own target', () => {
    // Degenerate but reachable: a fully dollied-in perspective camera. There is
    // no direction to preserve, and the pose that comes back is still the one
    // that puts the pivot on the click.
    const pose = retargetPose(TARGET, TARGET, { x: 40, y: 0, z: 12 })

    expect(pose.position).toEqual({ x: 40, y: 0, z: 12 })
    expect(pose.target).toEqual({ x: 40, y: 0, z: 12 })
  })

  it('reads its inputs rather than holding them', () => {
    // The call site hands it a live `Vector3` out of a raycast hit, which three
    // reuses. Holding a reference would re-aim the orbit at whatever that
    // vector became next.
    const hit = new Vector3(40, 0, 12)
    const pose = retargetPose(CAMERA, TARGET, hit)
    hit.set(0, 0, 0)

    expect(pose.target).toEqual({ x: 40, y: 0, z: 12 })
  })
})
