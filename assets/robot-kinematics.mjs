import * as THREE from './vendor/three.module.min.js';

// Generic illustrative serial arms. Joint counts exclude the gripper / hand.
// All offsets and rotation axes are expressed in the preceding joint's frame.
export function createArmRig({ dof = 6, pose = 'forward' } = {}) {
  if (dof !== 6 && dof !== 7) throw new RangeError('An arm must have 6 or 7 revolute joints.');
  const sixAngles = pose === 'high'
    ? [0, .22, -1.20, .14, -2.05, .10]
    : [0, .38, -1.50, .12, -2.02, .12];
  const definitions = dof === 6 ? [
    { name: 'base yaw', axis: [0, 1, 0], offset: [0, .46, 0] },
    { name: 'shoulder pitch', axis: [0, 0, 1], offset: [0, .20, 0] },
    { name: 'elbow pitch', axis: [0, 0, 1], offset: [0, 1.08, 0] },
    { name: 'forearm roll', axis: [0, 1, 0], offset: [0, 1.10, 0] },
    { name: 'wrist pitch', axis: [0, 0, 1], offset: [0, .24, 0] },
    { name: 'tool roll', axis: [0, 1, 0], offset: [0, .25, 0] },
  ] : [
    { name: 'base yaw', axis: [0, 1, 0], offset: [0, .46, 0] },
    { name: 'shoulder pitch', axis: [0, 0, 1], offset: [0, .22, 0] },
    { name: 'upper-arm roll', axis: [0, 1, 0], offset: [0, .48, 0] },
    { name: 'elbow pitch', axis: [0, 0, 1], offset: [0, .62, 0] },
    { name: 'forearm roll', axis: [0, 1, 0], offset: [0, .52, 0] },
    { name: 'wrist pitch', axis: [0, 0, 1], offset: [0, .40, 0] },
    { name: 'tool roll', axis: [0, 1, 0], offset: [0, .24, 0] },
  ];
  const homeAngles = dof === 6 ? sixAngles : [0, .30, -.25, -1.65, .20, 1.22, .15];
  const root = new THREE.Group();
  root.name = `${dof}-DoF serial arm`;
  let parent = root;
  const joints = definitions.map((definition, index) => {
    const pivot = new THREE.Group();
    pivot.name = `J${index + 1}: ${definition.name}`;
    pivot.position.fromArray(definition.offset);
    const axis = new THREE.Vector3(...definition.axis).normalize();
    pivot.quaternion.setFromAxisAngle(axis, homeAngles[index]);
    parent.add(pivot);
    parent = pivot;
    return { pivot, axis, name: definition.name, offset: [...definition.offset], homeAngle: homeAngles[index], angle: homeAngles[index] };
  });
  const tool = new THREE.Group();
  tool.name = 'End-effector mounting flange';
  tool.position.set(0, .20, 0);
  parent.add(tool);

  function setJointAngle(index, angle) {
    const joint = joints[index];
    if (!joint || !Number.isFinite(angle)) throw new RangeError('Invalid revolute joint or angle.');
    joint.angle = angle;
    joint.pivot.quaternion.setFromAxisAngle(joint.axis, angle);
  }
  return { root, joints, tool, dof, setJointAngle };
}
