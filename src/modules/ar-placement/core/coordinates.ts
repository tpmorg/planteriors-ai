import type { Pose, Quat, Vec3 } from './types';

const EPS = 1e-9;

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isFiniteVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((component) => isFiniteNumber(component))
  );
}

export function isFiniteQuat(value: unknown): value is Quat {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((component) => isFiniteNumber(component))
  );
}

export function vec3(x: number, y: number, z: number): Vec3 {
  return [x, y, z];
}

export function quat(x: number, y: number, z: number, w: number): Quat {
  return [x, y, z, w];
}

export const IDENTITY_QUAT: Quat = [0, 0, 0, 1];
export const ORIGIN: Vec3 = [0, 0, 0];

export function identityPose(): Pose {
  return { position: ORIGIN, rotation: IDENTITY_QUAT };
}

export function vecAdd(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vecSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vecScale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function vecDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vecLength(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

export function vecNear(a: Vec3, b: Vec3, epsilon = 1e-6): boolean {
  return vecLength(vecSub(a, b)) <= epsilon;
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function quatMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function quatConjugate(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}

export function quatNormalize(q: Quat): Quat {
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  if (len < EPS) return IDENTITY_QUAT;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

export function quatFromAxisAngle(axis: Vec3, radians: number): Quat {
  const len = vecLength(axis);
  if (len < EPS || !Number.isFinite(radians)) return IDENTITY_QUAT;
  const half = radians / 2;
  const s = Math.sin(half) / len;
  return quatNormalize([axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)]);
}

export function quatFromYawRadians(yaw: number): Quat {
  return quatFromAxisAngle([0, 1, 0], yaw);
}

export function yawRadiansFromQuat(q: Quat): number {
  const n = quatNormalize(q);
  return Math.atan2(2 * (n[3] * n[1] + n[0] * n[2]), 1 - 2 * (n[1] * n[1] + n[0] * n[0]));
}

export function quatFromEulerDegreesXYZ(eulerDeg: Vec3): Quat {
  const rx = quatFromAxisAngle([1, 0, 0], (eulerDeg[0] * Math.PI) / 180);
  const ry = quatFromAxisAngle([0, 1, 0], (eulerDeg[1] * Math.PI) / 180);
  const rz = quatFromAxisAngle([0, 0, 1], (eulerDeg[2] * Math.PI) / 180);
  return quatNormalize(quatMul(rz, quatMul(ry, rx)));
}

/** Viro 2.53.1 extracts Euler X-Y-Z with combined rotation R = Rx · Ry · Rz. */
export function quatFromViroEulerDegrees(eulerDeg: Vec3): Quat {
  const rx = quatFromAxisAngle([1, 0, 0], (eulerDeg[0] * Math.PI) / 180);
  const ry = quatFromAxisAngle([0, 1, 0], (eulerDeg[1] * Math.PI) / 180);
  const rz = quatFromAxisAngle([0, 0, 1], (eulerDeg[2] * Math.PI) / 180);
  return quatNormalize(quatMul(rx, quatMul(ry, rz)));
}

export function eulerDegreesXYZFromQuat(q: Quat): Vec3 {
  const n = quatNormalize(q);
  const [x, y, z, w] = n;
  const sinp = 2 * (w * y - z * x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * (Math.PI / 2) : Math.asin(sinp);
  const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
  const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
  return [(roll * 180) / Math.PI, (pitch * 180) / Math.PI, (yaw * 180) / Math.PI];
}

export function rotateVecByQuat(v: Vec3, q: Quat): Vec3 {
  const n = quatNormalize(q);
  const u: Vec3 = [n[0], n[1], n[2]];
  const s = n[3];
  const two = 2;
  const term1 = vecScale(u, two * vecDot(u, v));
  const term2 = vecScale(v, s * s - vecDot(u, u));
  const cross: Vec3 = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const term3 = vecScale(cross, two * s);
  return vecAdd(vecAdd(term1, term2), term3);
}

export function invertPose(pose: Pose): Pose {
  const invRot = quatConjugate(quatNormalize(pose.rotation));
  return {
    rotation: invRot,
    position: vecScale(rotateVecByQuat(pose.position, invRot), -1),
  };
}

export function composePose(parent: Pose, local: Pose): Pose {
  const rotation = quatNormalize(quatMul(parent.rotation, local.rotation));
  const position = vecAdd(parent.position, rotateVecByQuat(local.position, parent.rotation));
  return { position, rotation };
}

export function worldFromAnchor(anchor: Pose, local: Vec3): Vec3 {
  return vecAdd(anchor.position, rotateVecByQuat(local, anchor.rotation));
}

export function anchorFromWorld(anchor: Pose, world: Vec3): Vec3 {
  return rotateVecByQuat(vecSub(world, anchor.position), quatConjugate(quatNormalize(anchor.rotation)));
}

export function poseFromPositionYaw(position: Vec3, yawRadians: number): Pose {
  return { position, rotation: quatFromYawRadians(yawRadians) };
}

export function scaledFloorContactOffset(
  dimensions: { height: number },
  pivot: Vec3,
  scale: number
): Vec3 {
  const s = Number.isFinite(scale) ? scale : 1;
  return [pivot[0] * s, (dimensions.height / 2 - pivot[1]) * s + pivot[1] * s, pivot[2] * s];
}

export function modelCenterAboveContact(
  dimensions: { height: number },
  scale: number
): number {
  const s = Number.isFinite(scale) ? scale : 1;
  return (dimensions.height / 2) * s;
}

export function isValidPose(pose: Pose | null | undefined): pose is Pose {
  return !!pose && isFiniteVec3(pose.position) && isFiniteQuat(pose.rotation);
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
