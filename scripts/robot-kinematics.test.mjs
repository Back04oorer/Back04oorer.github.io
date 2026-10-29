import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Quaternion } from '../assets/vendor/three.module.min.js';
import { createArmRig } from '../assets/robot-kinematics.mjs';

function matrixRank(input, tolerance = 1e-7) {
  const matrix = input.map(row => [...row]);
  let rank = 0;
  for (let column = 0; column < matrix[0].length && rank < matrix.length; column++) {
    let pivot = rank;
    for (let row = rank + 1; row < matrix.length; row++) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    }
    if (Math.abs(matrix[pivot][column]) < tolerance) continue;
    [matrix[rank], matrix[pivot]] = [matrix[pivot], matrix[rank]];
    const scale = matrix[rank][column];
    matrix[rank] = matrix[rank].map(value => value / scale);
    for (let row = 0; row < matrix.length; row++) {
      if (row === rank) continue;
      const factor = matrix[row][column];
      matrix[row] = matrix[row].map((value, col) => value - factor * matrix[rank][col]);
    }
    rank++;
  }
  return rank;
}

for (const dof of [6, 7]) {
  test(`${dof}-DoF rig has independently articulated joints and a terminal tool flange`, () => {
    const rig = createArmRig({ dof });
    assert.equal(rig.joints.length, dof);
    assert.equal(rig.joints[0].pivot.parent, rig.root);
    rig.joints.slice(1).forEach((joint, i) => assert.equal(joint.pivot.parent, rig.joints[i].pivot));
    assert.equal(rig.tool.parent, rig.joints.at(-1).pivot);
    for (const [index, joint] of rig.joints.entries()) {
      rig.root.updateMatrixWorld(true);
      const beforePosition = rig.tool.getWorldPosition(new Vector3());
      const beforeRotation = rig.tool.getWorldQuaternion(new Quaternion());
      rig.setJointAngle(index, joint.homeAngle + .13);
      rig.root.updateMatrixWorld(true);
      const positionChange = beforePosition.distanceTo(rig.tool.getWorldPosition(new Vector3()));
      const rotationChange = beforeRotation.angleTo(rig.tool.getWorldQuaternion(new Quaternion()));
      assert.ok(positionChange + rotationChange > .01, `J${index + 1} must affect the tool pose`);
      rig.setJointAngle(index, joint.homeAngle);
    }
  });

  test(`${dof}-DoF reference pose can control all six spatial tool coordinates`, () => {
    const rig = createArmRig({ dof });
    rig.root.updateMatrixWorld(true);
    const tip = rig.tool.getWorldPosition(new Vector3());
    const columns = rig.joints.map(joint => {
      const origin = joint.pivot.getWorldPosition(new Vector3());
      const axis = joint.axis.clone().applyQuaternion(joint.pivot.getWorldQuaternion(new Quaternion()));
      const linear = axis.clone().cross(tip.clone().sub(origin));
      return [...linear.toArray(), ...axis.toArray()];
    });
    const jacobian = Array.from({ length: 6 }, (_, row) => columns.map(column => column[row]));
    assert.equal(matrixRank(jacobian), 6);
  });
}
