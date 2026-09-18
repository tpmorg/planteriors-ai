import {
  IDENTITY_QUAT,
  anchorFromWorld,
  composePose,
  modelCenterAboveContact,
  quatFromViroEulerDegrees,
  quatFromYawRadians,
  rotateVecByQuat,
  vecNear,
  worldFromAnchor,
} from '../core/coordinates';

describe('coordinates', () => {
  it('rotates +X by +90° yaw about +Y onto -Z', () => {
    const rotated = rotateVecByQuat([1, 0, 0], quatFromYawRadians(Math.PI / 2));
    expect(vecNear(rotated, [0, 0, -1], 1e-8)).toBe(true);
  });

  it('round-trips a non-origin, rotated and scaled local offset through an anchor pose', () => {
    const anchor = {
      position: [1.25, 0.4, -2.5] as const,
      rotation: quatFromYawRadians(0.7),
    };
    const local = [0.15, 0.2, -0.05] as const;
    const world = worldFromAnchor(anchor, local);
    const back = anchorFromWorld(anchor, world);
    expect(vecNear(back, local, 1e-8)).toBe(true);
    expect(vecNear(world, [1.25, 0.4, -2.5], 1e-3)).toBe(false);
  });

  it('composes yaw then translation without treating [0,0,0] as a tap location', () => {
    const parent = { position: [2, 0, 1] as const, rotation: IDENTITY_QUAT };
    const local = { position: [0.3, 0, -0.2] as const, rotation: quatFromYawRadians(0.4) };
    const composed = composePose(parent, local);
    expect(vecNear(composed.position, [2.3, 0, 0.8], 1e-8)).toBe(true);
  });

  it('keeps scaled floor contact at half height for a centered model', () => {
    expect(modelCenterAboveContact({ height: 0.4 }, 1)).toBeCloseTo(0.2);
    expect(modelCenterAboveContact({ height: 0.4 }, 2)).toBeCloseTo(0.4);
    expect(modelCenterAboveContact({ height: 0.4 }, 0.5)).toBeCloseTo(0.1);
  });

  it('matches Viro world-to-local for a non-origin rotated plane', () => {
    const anchorPosition = [1.1, -0.2, 2.4] as const;
    const rotationDeg = [12, -35, 8] as const;
    const world = [1.4, 0.1, 2.1] as const;
    const pose = { position: anchorPosition, rotation: quatFromViroEulerDegrees(rotationDeg) };
    const local = anchorFromWorld(pose, world);

    const toRad = Math.PI / 180;
    const c1 = Math.cos(rotationDeg[0] * toRad);
    const s1 = Math.sin(rotationDeg[0] * toRad);
    const c2 = Math.cos(rotationDeg[1] * toRad);
    const s2 = Math.sin(rotationDeg[1] * toRad);
    const c3 = Math.cos(rotationDeg[2] * toRad);
    const s3 = Math.sin(rotationDeg[2] * toRad);
    const dx = world[0] - anchorPosition[0];
    const dy = world[1] - anchorPosition[1];
    const dz = world[2] - anchorPosition[2];
    const expected = [
      c2 * c3 * dx + (s1 * s2 * c3 + c1 * s3) * dy + (-c1 * s2 * c3 + s1 * s3) * dz,
      -c2 * s3 * dx + (-s1 * s2 * s3 + c1 * c3) * dy + (c1 * s2 * s3 + s1 * c3) * dz,
      s2 * dx + -s1 * c2 * dy + c1 * c2 * dz,
    ] as const;
    expect(vecNear(local, expected, 1e-6)).toBe(true);
  });
});
