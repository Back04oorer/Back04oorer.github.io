import * as THREE from './vendor/three.module.min.js';
import { createArmRig } from './robot-kinematics.mjs';

const projects = [
  { short: 'Touch Where It Matters', title: 'Touch Where It Matters: Learning Local Tactile Policies for Fine-Grained Gripper Control', configuration: '6-DoF arm · tactile gripper', topic: 'Local tactile control', date: 'October 2026', paper: 'https://arxiv.org/abs/2610.24485', description: 'Local tactile policies regulate the gripper during contact-rich manipulation, while a visual policy controls arm motion. Touch and force feedback guide fine-grained adjustments.', position: [-4.2, 0, 2.25] },
  { short: 'CoRE', title: 'CoRE: Learning Collaboration-Role Experts for Decentralized Collaborative Manipulation with One Policy', configuration: 'Two 6-DoF arms', topic: 'Multi-robot collaboration', date: 'October 2026', paper: 'https://arxiv.org/abs/2610.07752', project: 'https://aus.bot/research/core/', description: 'One shared policy learns complementary collaboration roles. Each robot acts from its own visual observations and proprioception, without inter-robot messages or role labels.', position: [3.9, 0, 2.3] },
  { short: 'NestDex', title: 'NestDex: Nested Policy Learning with Copilot Assisted Teleoperation for Dexterous Manipulation', configuration: '7-DoF arm + dexterous hand', topic: 'Dexterous manipulation', date: 'August 2026', paper: 'https://arxiv.org/abs/2608.13362', project: 'https://aus.bot/research/nestdex/', description: 'Learned hand skills assist the collection of dexterous demonstrations. An outer visuomotor policy then learns to perform the task autonomously.', position: [-3.4, 0, -3.3] },
  { short: 'Tri-Manual', title: 'Tri-Manual Visuomotor Imitation Learning of Robot Policies', configuration: 'Three 6-DoF arms', topic: 'Three-arm coordination', date: 'July 2026', paper: 'https://arxiv.org/abs/2607.25731', project: 'https://aus.bot/research/trimanpolicy/', description: 'One operator demonstrates behaviours for three robotic arms. Dependency-aware scheduling retimes the demonstrations before training a synchronized policy.', position: [3.4, 0, -3.5] },
];

// Task settings follow the experimental figures, while retaining the user's
// requested illustrative 6-DoF arms and NestDex's 7-DoF arm-hand embodiment.
const taskScenes = [
  { name: 'Cup Separation', action: 'Lift the nested cups, leaving one on the table.', source: 'https://arxiv.org/html/2610.24485v1#S3.F6', figure: 'Fig. 6b', targetY: 1.3, angle: -.12 },
  { name: 'Pan Transport', action: 'Two arms carry one pan onto a pair of supports.', source: 'https://arxiv.org/html/2610.07752v1#S4.F7', figure: 'Fig. 7', targetY: 1.3, angle: .14 },
  { name: 'Tongs Transfer', action: 'Use the tongs to transfer a wooden carrot into the pan.', source: 'https://arxiv.org/html/2608.13362v1#S4.F6', figure: 'Fig. 6a', targetY: 1.5, angle: .12 },
  { name: 'TowelHang', action: 'One arm steadies the wooden hanger; the other two feed a folded towel through it.', source: 'https://arxiv.org/pdf/2607.25731v4#page=1', figure: 'Fig. 1 · A3', targetY: 1.75, angle: .60 },
];

const host = document.querySelector('#world');
const status = document.querySelector('#scene-status');
const detail = document.querySelector('#project-detail');
const buttons = [...document.querySelectorAll('[data-project]')];
const labels = [...document.querySelectorAll('.scene-label')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let selectView = () => {};
let resetScene = () => {};
let inspectGripper = () => {};
const sensorInspectButton = document.querySelector('#inspect-sensors');
sensorInspectButton.addEventListener('click', () => inspectGripper());

function showProject(index) {
  const project = projects[index];
  buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.project) === index)));
  document.querySelector('#detail-title').textContent = project.title;
  document.querySelector('#detail-kicker').textContent = `${String(index + 1).padStart(2, '0')} / ${project.topic} · ${project.date}`;
  document.querySelector('#detail-description').textContent = project.description;
  document.querySelector('#detail-paper').href = project.paper;
  const projectLink = document.querySelector('#detail-project');
  projectLink.hidden = !project.project;
  if (project.project) projectLink.href = project.project;
  else projectLink.removeAttribute('href');
  detail.hidden = false;
  document.querySelector('#selection-number').textContent = `Selected study / ${String(index + 1).padStart(2, '0')}`;
  document.querySelector('#selection-title').textContent = project.short;
  document.querySelector('#selection-topic').textContent = project.topic;
  document.querySelector('#selection-configuration').textContent = project.configuration;
  document.querySelector('#selection-task').textContent = taskScenes[index].name;
  document.querySelector('#selection-action').textContent = taskScenes[index].action;
  const taskSource = document.querySelector('#selection-source');
  taskSource.href = taskScenes[index].source;
  taskSource.textContent = `Task in ${taskScenes[index].figure} ↗`;
  document.querySelector('#selection-paper').href = project.paper;
  document.querySelector('#scene-selection').hidden = false;
  document.querySelector('.space-note').hidden = true;
  document.querySelector('#sensor-detail').hidden = index !== 0;
  selectView(index);
}

buttons.forEach(button => button.addEventListener('click', () => showProject(Number(button.dataset.project))));
document.querySelector('#reset-view').addEventListener('click', () => {
  buttons.forEach(button => button.setAttribute('aria-pressed', 'false'));
  detail.hidden = true;
  document.querySelector('#scene-selection').hidden = true;
  document.querySelector('.space-note').hidden = false;
  document.querySelector('#sensor-detail').hidden = true;
  resetScene();
});

function startScene() {
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.Fog('#55657f', 38, 70);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive 3D landscape with four robot research stations');
  canvas.setAttribute('aria-describedby', 'drag-instructions keyboard-instructions');
  host.append(canvas);

  scene.add(new THREE.HemisphereLight('#e8eff2', '#7f789c', 1.4));
  const sun = new THREE.DirectionalLight('#fff1ce', 1.65);
  sun.position.set(-7, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 13, bottom: -13, near: .5, far: 45 });
  sun.shadow.bias = -.0003;
  sun.shadow.normalBias = .035;
  sun.shadow.radius = 1.5;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#c5d5e4', .4);
  fill.position.set(5, 6, -9);
  scene.add(fill);

  let seed = 3129;
  function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

  // Surface marks live in object UVs, so they stay on the robots as the camera moves.
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = paperCanvas.height = 256;
  const paper = paperCanvas.getContext('2d');
  paper.fillStyle = '#f7f3e8';
  paper.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 7500; i++) {
    paper.fillStyle = `rgba(53,48,65,${random() * .25})`;
    paper.fillRect(random() * 256, random() * 256, 1 + random() * 1.2, 1);
  }
  paper.strokeStyle = 'rgba(48,54,76,.32)';
  paper.lineWidth = 1;
  for (let i = 0; i < 105; i++) {
    const x = random() * 256, y = random() * 256, length = 3 + random() * 6;
    paper.beginPath(); paper.moveTo(x, y); paper.lineTo(x + length * .4, y - length); paper.stroke();
  }
  const paperTexture = new THREE.CanvasTexture(paperCanvas);
  paperTexture.colorSpace = THREE.SRGBColorSpace;
  const ramp = new THREE.DataTexture(new Uint8Array([135, 135, 135, 255, 200, 200, 200, 255, 255, 255, 255, 255]), 3, 1);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  const palette = { green: '#829fa8', sage: '#9991ad', navy: '#68748e', cream: '#c4dade', clay: '#d4a3a0', brass: '#ded29c', dark: '#4a4d66', floor: '#eee7d4', sensor: '#e7a6a0', sensorLight: '#f6cdb4', blue: '#718eb4', copper: '#d69a70', leaf: '#889c79', cloth: '#c3aaa8', wood: '#c5a784' };
  const materials = Object.fromEntries(Object.entries(palette).map(([key, color]) => {
    const material = new THREE.MeshToonMaterial({ color, gradientMap: ramp, map: paperTexture });
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 vInkPosition;\nvarying vec3 vInkNormal;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvInkPosition = position;\nvInkNormal = normalize(mat3(modelMatrix) * normal);');
      shader.fragmentShader = 'varying vec3 vInkPosition;\nvarying vec3 vInkNormal;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float baseLuma = max(dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)), .001);
        float illumination = dot(outgoingLight, vec3(.2126, .7152, .0722)) / baseLuma;
        float shade = step(.24, dot(normalize(vInkNormal), normalize(vec3(-.5, .75, .4)))) * step(.58, illumination);
        // Two pigment values replace the continuous, rounded lighting of a model.
        outgoingLight = diffuseColor.rgb * mix(.64, 1.12, shade);
        float hatchPhase = (vInkPosition.x + vInkPosition.y * 1.5 + vInkPosition.z * .6) * 125.0;
        float wave = abs(sin(hatchPhase + sin(vInkPosition.y * 37.0) * .23));
        float hatch = 1.0 - smoothstep(.14, .14 + max(fwidth(wave), .08), wave);
        outgoingLight *= 1.0 - hatch * (1.0 - shade) * .38;
        #include <opaque_fragment>
      `);
    };
    material.customProgramCacheKey = () => 'paper-ink-shading-v1';
    return [key, material];
  }));
  const outlineMaterial = new THREE.LineBasicMaterial({ color: '#24283c', transparent: true, opacity: .92 });
  const silhouetteMaterial = new THREE.MeshBasicMaterial({ color: '#24283c', side: THREE.BackSide });
  silhouetteMaterial.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float inkWobble = sin(position.x * 71.0 + position.y * 39.0 + position.z * 53.0);
      transformed += normal * (.009 + inkWobble * .0035);
    `);
  };
  silhouetteMaterial.customProgramCacheKey = () => 'paper-ink-contour-v1';
  const pathMaterial = new THREE.LineBasicMaterial({ color: '#586078', transparent: true, opacity: .55 });

  function sketchEdges(geometry) {
    const edges = new THREE.EdgesGeometry(geometry, 35);
    const vertices = edges.getAttribute('position');
    const points = [];
    for (let i = 0; i < vertices.count; i += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(vertices, i);
      const b = new THREE.Vector3().fromBufferAttribute(vertices, i + 1);
      const steps = Math.min(60, Math.max(3, Math.ceil(a.distanceTo(b) / .065)));
      const phase = i * 1.71;
      let previous = a;
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const point = a.clone().lerp(b, t);
        const fade = Math.sin(t * Math.PI);
        point.x += Math.sin(step * 1.7 + phase) * .006 * fade;
        point.y += Math.cos(step * 2.3 + phase) * .005 * fade;
        point.z += Math.sin(step * 2.1 - phase) * .006 * fade;
        points.push(...previous.toArray(), ...point.toArray());
        previous = point;
      }
    }
    edges.dispose();
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  }

  function mesh(geometry, material, parent, position = [0, 0, 0], outline = false) {
    const item = new THREE.Mesh(geometry, typeof material === 'string' ? materials[material] : material);
    item.position.set(...position);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    if (typeof material === 'string' && geometry.type !== 'TubeGeometry' && !(geometry.type === 'SphereGeometry' && geometry.parameters.radius < .08)) {
      const silhouette = new THREE.Mesh(geometry, silhouetteMaterial);
      silhouette.scale.setScalar(1.012);
      silhouette.raycast = () => {};
      item.add(silhouette);
      if (outline || geometry.type === 'CylinderGeometry') item.add(new THREE.LineSegments(sketchEdges(geometry), outlineMaterial));
    }
    return item;
  }
  function box(parent, size, position, material, outline = true) {
    return mesh(new THREE.BoxGeometry(...size), material, parent, position, outline);
  }
  function cylinder(parent, radius, height, position, material, topRadius = radius, segments = 48) {
    return mesh(new THREE.CylinderGeometry(topRadius, radius, height, segments), material, parent, position);
  }
  function sphere(parent, radius, position, material) {
    return mesh(new THREE.SphereGeometry(radius, 24, 16), material, parent, position);
  }
  function link(parent, a, b, width, material) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const item = mesh(new THREE.CylinderGeometry(width * .88, width, direction.length(), 16), material, parent);
    item.position.copy(start).add(end).multiplyScalar(.5);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    const hatch = [];
    const length = start.distanceTo(end);
    for (let i = 0; i < 10; i++) {
      const y = -length * .34 + i * length * .044;
      const radius = width * (.96 - i * .003);
      hatch.push(Math.cos(1.95) * radius, y, Math.sin(1.95) * radius,
        Math.cos(2.4) * radius, y + .035, Math.sin(2.4) * radius);
    }
    const hatchGeometry = new THREE.BufferGeometry();
    hatchGeometry.setAttribute('position', new THREE.Float32BufferAttribute(hatch, 3));
    item.add(new THREE.LineSegments(hatchGeometry, outlineMaterial));
    return item;
  }
  function tube(parent, points, material, radius = .025) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 30, radius, 6, false), material, parent);
  }
  const water = mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: '#55657f' }), scene, [0, -.32, 0]);
  water.rotation.x = -Math.PI / 2;
  water.castShadow = false;
  const ground = mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: '#252d43', opacity: .3 }), scene, [0, -.3, 0]);
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  const landscape = new THREE.Group();
  scene.add(landscape);
  const waterMarks = new THREE.Group();
  landscape.add(waterMarks);
  ['#a8c5cf', '#e4d8a8', '#caa5ad', '#303b55'].forEach((color, colorIndex) => {
    const positions = [];
    for (let i = 0; i < (colorIndex === 0 ? 170 : 50); i++) {
      const x = (random() - .5) * 52, z = (random() - .5) * 40;
      const length = .1 + random() * (colorIndex === 0 ? 1.15 : .5);
      positions.push(x, -.27, z, x + length * .7, -.27, z - length);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    waterMarks.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: colorIndex === 3 ? .3 : .4 })));
  });

  const stations = [];
  const animatedParts = [];
  const selectable = [];
  const benchTop = .8;
  function workbench(group, width = 4.4, depth = 3.3) {
    // An ordinary lab work surface, with no island, disc, or circular rim.
    box(group, [width, .12, depth], [0, benchTop - .06, 0], 'floor');
    box(group, [width - .16, .12, .10], [0, benchTop - .18, depth / 2 - .13], 'wood');
    for (const x of [-width / 2 + .22, width / 2 - .22]) {
      for (const z of [-depth / 2 + .22, depth / 2 - .22]) {
        box(group, [.11, .96, .11], [x, .22, z], 'cream');
        box(group, [.16, .06, .16], [x, -.27, z], 'dark');
      }
      box(group, [.07, .07, depth - .38], [x, -.08, 0], 'sage');
    }
    // Sparse pen strokes along the edge of the wood surface.
    const marks = [];
    for (let i = 0; i < 40; i++) {
      const x = -width / 2 + .08 + i * (width - .16) / 40;
      marks.push(x, benchTop - .105, depth / 2 + .002, x + .05, benchTop - .02, depth / 2 + .002);
    }
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(marks, 3)), pathMaterial));
  }
  projects.forEach((project, index) => {
    const group = new THREE.Group();
    group.position.set(...project.position);
    group.userData.project = index;
    landscape.add(group);
    workbench(group, index === 3 ? 4.8 : 4.4, index === 3 ? 3.6 : 3.3);
    stations.push({ group, anchor: new THREE.Vector3(0, .18, 1.9), projected: new THREE.Vector3(), index });
    selectable.push(group);
  });

  function robotArm(parent, { position = [0, .36, 0], rotation = 0, scale = 1, color = 'navy', pose = 'forward', tactile = false, dof = 6, endEffector = 'gripper' } = {}) {
    const arm = new THREE.Group();
    parent.add(arm);
    arm.position.set(...position);
    arm.rotation.y = rotation;
    arm.scale.setScalar(scale);
    box(arm, [.68, .1, .62], [0, .05, 0], 'dark');
    for (const x of [-.25, .25]) for (const z of [-.22, .22]) cylinder(arm, .025, .015, [x, .11, z], 'brass', .025, 10);
    cylinder(arm, .31, .36, [0, .28, 0], 'cream');
    const rig = createArmRig({ dof, pose });
    arm.add(rig.root);
    rig.joints.forEach((joint, i) => {
      const radius = i < 3 ? [.28, .25, .23][i] : i < dof - 2 ? .20 : i === dof - 2 ? .18 : .15;
      const length = joint.axis.z ? .34 : .17;
      const housing = new THREE.Group();
      housing.name = `J${i + 1} actuator housing`;
      housing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), joint.axis);
      joint.pivot.add(housing);
      cylinder(housing, radius, length, [0, 0, 0], color);
      cylinder(housing, radius * .66, length + .016, [0, 0, 0], 'cream');
      cylinder(housing, radius * .22, length + .025, [0, 0, 0], 'brass', radius * .22, 16);
      if (i > 0) {
        const previous = rig.joints[i - 1].pivot;
        const offset = joint.offset;
        link(previous, [0, 0, 0], offset, i < 4 ? .16 : .12, 'cream');
        if (new THREE.Vector3(...offset).length() > .35) {
          tube(previous, [[0, .10, -.19], [-.06, offset[1] * .5, -.23], [0, offset[1] - .1, -.19]], 'dark', .025);
        }
      }
    });
    link(rig.joints.at(-1).pivot, [0, 0, 0], rig.tool.position.toArray(), .11, 'cream');
    cylinder(rig.tool, .16, .085, [0, 0, 0], 'dark');
    let fingers = [];
    if (endEffector === 'hand') {
      const hand = dexterousHand(rig.tool);
      hand.scale.setScalar(.58);
      hand.rotation.y = -.22;
      arm.userData.hand = hand;
    } else {
      const adapter = new THREE.Group();
      adapter.rotation.z = Math.PI;
      rig.tool.add(adapter);
      const result = parallelGripper(adapter, { tactile, color });
      fingers = result.fingers;
      arm.userData.gripper = result.gripper;
      arm.userData.gripperFingers = fingers;
    }
    animatedParts.push({ kind: 'arm', rig, fingers, tactile, phase: animatedParts.length * 1.7 });
    arm.userData.rig = rig;
    arm.name = `${dof}-DoF arm with ${endEffector === 'hand' ? 'dexterous hand' : 'parallel gripper'}`;
    return arm;
  }

  function parallelGripper(parent, { tactile, color }) {
    const gripper = new THREE.Group();
    if (tactile) gripper.rotation.y = -.55;
    parent.add(gripper);
    box(gripper, tactile ? [.76, .23, .43] : [.4, .18, .32], [0, 0, 0], color);
    if (tactile) box(gripper, [.55, .09, .45], [0, .16, 0], 'cream');
    const fingers = [];
    [-1, 1].forEach(side => {
      const finger = new THREE.Group();
      const gap = tactile ? .31 : .17;
      finger.position.x = side * gap;
      gripper.add(finger);
      box(finger, tactile ? [.11, .63, .34] : [.075, .32, .16], [0, tactile ? -.35 : -.19, 0], 'cream');
      box(finger, tactile ? [.15, .09, .35] : [.12, .1, .18], [-side * .025, tactile ? -.64 : -.33, 0], 'dark');
      if (tactile) {
        // Each sensing face is mounted on the inward-facing X side of its own finger.
        const housing = box(finger, [.06, .49, .30], [-side * .08, -.35, 0], 'dark');
        housing.name = side < 0 ? 'Left inner tactile sensor housing' : 'Right inner tactile sensor housing';
        const pad = box(finger, [.025, .39, .24], [-side * .123, -.35, 0], 'sensor');
        pad.name = side < 0 ? 'Left inward tactile sensing surface' : 'Right inward tactile sensing surface';
        const markers = new THREE.InstancedMesh(new THREE.SphereGeometry(.008, 8, 6), materials.dark, 24);
        const markerMatrix = new THREE.Matrix4();
        let markerIndex = 0;
        for (let row = 0; row < 6; row++) for (let column = 0; column < 4; column++) {
          markerMatrix.makeTranslation(-side * .14, -.49 + row * .056, -.081 + column * .054);
          markers.setMatrixAt(markerIndex++, markerMatrix);
        }
        markers.name = 'Illustrative optical marker pattern';
        finger.add(markers);
        for (const y of [-.56, -.14]) for (const z of [-.125, .125]) {
          const fastener = cylinder(finger, .014, .008, [-side * .113, y, z], 'brass', .014, 12);
          fastener.rotation.z = Math.PI / 2;
        }
        tube(finger, [[side * .07, -.27, -.1], [side * .11, -.05, -.17], [side * .08, .09, -.16]], 'dark', .015);
      }
      fingers.push({ object: finger, side, gap });
    });
    return { gripper, fingers };
  }

  // Stage a real serial chain at a contact pose. The planar IK aligns the flange
  // to the task instead of letting independent idle motion slide through props.
  function stageArm(arm, target, pitch = -Math.PI, roll = 0) {
    const rig = arm.userData.rig;
    const scale = arm.scale.x;
    const dx = target[0] - arm.position.x, dz = target[2] - arm.position.z;
    arm.rotation.y = -Math.atan2(dz, dx);
    const [upper, forearm, wrist, base] = rig.dof === 6 ? [1.08, 1.34, .45, .66] : [1.10, .92, .44, .68];
    const x = Math.hypot(dx, dz) / scale + wrist * Math.sin(pitch);
    const y = (target[1] - arm.position.y) / scale - base - wrist * Math.cos(pitch);
    const cosine = (x * x + y * y - upper * upper - forearm * forearm) / (2 * upper * forearm);
    if (Math.abs(cosine) > 1) throw new RangeError('Task contact pose is beyond the illustrated arm reach.');
    const elbow = -Math.acos(cosine);
    const shoulder = Math.atan2(-x, y) - Math.atan2(forearm * Math.sin(elbow), upper + forearm * Math.cos(elbow));
    const angles = rig.dof === 6 ? [0, shoulder, elbow, 0, pitch - shoulder - elbow, roll] : [0, shoulder, 0, elbow, 0, pitch - shoulder - elbow, roll];
    angles.forEach((angle, index) => { rig.setJointAngle(index, angle); rig.joints[index].homeAngle = angle; });
    const motion = animatedParts.find(part => part.rig === rig);
    motion.staged = true;
    return arm;
  }

  function pointInStation(station, object, point) {
    scene.updateMatrixWorld(true);
    return station.worldToLocal(object.localToWorld(new THREE.Vector3(...point)));
  }

  function rim(parent, radius, y, material = 'cream', thickness = .018) {
    const ring = mesh(new THREE.TorusGeometry(radius, thickness, 6, 48), material, parent, [0, y, 0]);
    ring.rotation.x = Math.PI / 2;
    return ring;
  }

  function invertedCup(parent, position, count = 1) {
    const cups = new THREE.Group(); cups.position.set(...position); parent.add(cups);
    const lift = (count - 1) * .065;
    cylinder(cups, .195, .43 + lift, [0, (.43 + lift) / 2, 0], 'blue', .13, 32);
    for (let i = 0; i < count; i++) rim(cups, .197 - i * .004, .025 + i * .065, 'cream', .012);
    for (let i = 0; i < 4; i++) rim(cups, .14 + i * .004, .35 + lift - i * .025, 'blue', .006);
    cylinder(cups, .123, .012, [0, .435 + lift, 0], 'blue', .123, 32);
    return cups;
  }

  function pan(parent, position, { radius = .66, handles = false } = {}) {
    const pot = new THREE.Group(); parent.add(pot); pot.position.set(...position);
    const profile = [[0, 0], [radius * .8, 0], [radius, .19], [radius - .045, .19], [radius * .77, .045], [0, .045]].map(p => new THREE.Vector2(...p));
    mesh(new THREE.LatheGeometry(profile, 48), 'dark', pot);
    rim(pot, radius - .02, .19, 'cream', .018);
    if (handles) {
      for (const side of [-1, 1]) {
        tube(pot, [[side * radius * .91, .15, -.15], [side * (radius + .27), .16, -.15], [side * (radius + .30), .16, .15], [side * radius * .91, .15, .15]], 'dark', .045);
      }
    } else {
      box(pot, [.14, .08, .67], [0, .15, -radius - .25], 'dark');
      cylinder(pot, .04, .09, [0, .15, -radius - .52], 'cream', .04, 12);
    }
    return pot;
  }

  // Touch, Fig. 6b: an inverted cup stack is lifted clear of one retained cup.
  const touch = stations[0].group;
  const touchArm = stageArm(robotArm(touch, { position: [-1.25, benchTop, -.35], scale: .9, color: 'navy', tactile: true }), [.30, 2.12, .25]);
  const cupContact = pointInStation(touch, touchArm.userData.gripper, [0, -.35, 0]);
  const touchPayload = invertedCup(touch, [cupContact.x, cupContact.y - .49, cupContact.z], 4);
  invertedCup(touch, [cupContact.x, benchTop, cupContact.z]);
  // A small tray of spare cups makes the tabletop experiment readable at a glance.
  box(touch, [.75, .045, .75], [1.35, benchTop + .025, -.65], 'cream');
  invertedCup(touch, [1.35, benchTop + .055, -.65], 2);

  // CoRE, Fig. 7: the shared pan is suspended above two coloured supports.
  const core = stations[1].group;
  for (const side of [-1, 1]) {
    stageArm(robotArm(core, { position: [side * 1.65, benchTop, -.35], scale: .86, color: side < 0 ? 'green' : 'navy' }), [side * .86, 1.93, .45], -Math.PI, Math.PI / 2);
    box(core, [.38, .15, .72], [side * .44, benchTop + .075, .45], 'clay');
    box(core, [.38, .08, .72], [side * .44, benchTop + .19, .45], 'brass');
  }
  pan(core, [0, 1.57, .45], { handles: true });

  // The hand is a separate end effector attached downstream of all seven arm joints.
  function dexterousHand(parent) {
    const hand = new THREE.Group();
    hand.name = 'Dexterous hand attached to J7 tool flange';
    parent.add(hand);
    cylinder(hand, .28, .5, [0, .24, 0], 'cream');
    box(hand, [.86, .92, .38], [0, .96, 0], 'green');
    box(hand, [.64, .66, .07], [0, .99, .225], 'cream');
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Group();
      finger.position.set(-.33 + i * .22, 1.39, 0);
      finger.rotation.z = (.5 - i / 3) * .2;
      hand.add(finger);
      const length = [.39, .49, .46, .35][i];
      let pivot = finger;
      for (let j = 0; j < 3; j++) {
        sphere(pivot, .1, [0, 0, 0], 'brass');
        box(pivot, [.16, length * .86, .18], [0, length / 2, 0], j === 2 ? 'sage' : 'cream');
        const next = new THREE.Group();
        next.position.y = length;
        pivot.add(next);
        next.rotation.x = .68 + j * .12;
        pivot = next;
      }
    }
    const thumb = new THREE.Group();
    thumb.position.set(-.43, .72, .07);
    thumb.rotation.z = .95;
    hand.add(thumb);
    link(thumb, [0, 0, 0], [0, .48, 0], .13, 'cream');
    sphere(thumb, .13, [0, .48, 0], 'brass');
    link(thumb, [0, .48, 0], [.08, .86, .13], .1, 'cream');
    return hand;
  }

  // NestDex, Fig. 6a: a seven-joint arm and curled hand hold kitchen tongs.
  const handStation = stations[2].group;
  const nestArm = stageArm(robotArm(handStation, { position: [-1.35, benchTop, -.65], scale: .9, color: 'green', dof: 7, endEffector: 'hand' }), [-.40, 2.2, -.3], -2.0, -.2);
  const tongGrip = pointInStation(handStation, nestArm.userData.hand, [0, 1.78, .48]);
  const tongs = new THREE.Group(); handStation.add(tongs); tongs.position.copy(tongGrip);
  tongs.name = 'Tongs grasped by the dexterous hand';
  sphere(tongs, .075, [0, .12, 0], 'dark');
  for (const side of [-1, 1]) {
    link(tongs, [0, .12, 0], [side * .15, -.70, .12], .026, 'cream');
    const tip = box(tongs, [.065, .19, .16], [side * .15, -.73, .12], 'dark');
    tip.rotation.z = side * -.14;
  }
  const carrot = new THREE.Group(); tongs.add(carrot); carrot.position.set(0, -.77, .12); carrot.rotation.z = Math.PI / 2;
  cylinder(carrot, .105, .43, [0, 0, 0], 'copper', .02, 20);
  for (let i = 0; i < 3; i++) {
    const leaf = mesh(new THREE.SphereGeometry(.095, 10, 8), 'leaf', carrot, [(i - 1) * .07, -.26 - Math.abs(i - 1) * .035, 0]);
    leaf.scale.set(.45, 1.3, .35); leaf.rotation.z = (i - 1) * .55;
  }
  pan(handStation, [tongGrip.x, benchTop + .02, tongGrip.z + .12], { radius: .58 });
  // The perforated utensil holder seen in the paper is behind the transfer area.
  const holder = new THREE.Group(); handStation.add(holder); holder.position.set(1.32, benchTop, -.65);
  const holderProfile = [[0, 0], [.27, 0], [.27, .64], [.24, .64], [.24, .035], [0, .035]].map(p => new THREE.Vector2(...p));
  mesh(new THREE.LatheGeometry(holderProfile, 36), 'cream', holder);
  rim(holder, .26, .64, 'dark', .012);
  const holes = new THREE.InstancedMesh(new THREE.SphereGeometry(.021, 6, 4), materials.dark, 90);
  const holeTransform = new THREE.Matrix4(); let holeIndex = 0;
  for (let row = 0; row < 6; row++) for (let col = 0; col < 15; col++) {
    const angle = col / 15 * Math.PI * 2;
    holeTransform.makeTranslation(Math.sin(angle) * .268, .10 + row * .085, Math.cos(angle) * .268);
    holes.setMatrixAt(holeIndex++, holeTransform);
  }
  holder.add(holes);

  // TriManPolicy, Fig. 1 A3: O grips the wooden shoulder below the exposed
  // hook. R works above/behind the bar, L below/in front, on a narrow folded
  // towel. These are three different approaches, not a top-corner spread.
  const tri = stations[3].group;
  const towelTask = new THREE.Group(); tri.add(towelTask);
  towelTask.position.set(0, 2.24, 0);
  towelTask.rotation.set(0, -.20, -.07);

  function stageOrientedPinch(arm, localContact, localApproach, localJaw, thickness) {
    const contact = new THREE.Vector3(...localContact).applyQuaternion(towelTask.quaternion).add(towelTask.position);
    const approach = new THREE.Vector3(...localApproach).normalize().applyQuaternion(towelTask.quaternion);
    const jaw = new THREE.Vector3(...localJaw).normalize().applyQuaternion(towelTask.quaternion);
    const toolX = jaw.clone().negate();
    const toolZ = new THREE.Vector3().crossVectors(toolX, approach).normalize();
    const toolOrientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(toolX, approach, toolZ));
    const scale = arm.scale.x, rig = arm.userData.rig;
    // Finger contact is .33 past the flange; the wrist contributes another .45.
    const wrist = contact.clone().addScaledVector(approach, -.78 * scale).sub(arm.position);
    arm.rotation.y = -Math.atan2(wrist.z, wrist.x);
    const x = Math.hypot(wrist.x, wrist.z) / scale;
    const y = wrist.y / scale - .66;
    const cosine = (x*x + y*y - 1.08**2 - 1.34**2) / (2 * 1.08 * 1.34);
    if (Math.abs(cosine) > 1) throw new RangeError('Tri-Manual contact is beyond the illustrated arm reach.');
    const elbow = -Math.acos(cosine);
    const shoulder = Math.atan2(-x, y) - Math.atan2(1.34 * Math.sin(elbow), 1.08 + 1.34 * Math.cos(elbow));
    const beforeWrist = arm.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), shoulder + elbow));
    const residual = beforeWrist.invert().multiply(toolOrientation);
    const m = new THREE.Matrix4().makeRotationFromQuaternion(residual).elements;
    // The final three revolute joints form a Y-Z-Y wrist.
    const wristPitch = Math.acos(THREE.MathUtils.clamp(m[5], -1, 1));
    const wristRoll = Math.atan2(m[6], -m[4]);
    const toolRoll = Math.atan2(m[9], m[1]);
    [0, shoulder, elbow, wristRoll, wristPitch, toolRoll].forEach((angle, i) => {
      rig.setJointAngle(i, angle); rig.joints[i].homeAngle = angle;
    });
    animatedParts.find(part => part.rig === rig).staged = true;
    arm.userData.gripperFingers.forEach(finger => {
      finger.gap = .085 + thickness / (2 * scale);
      finger.object.position.x = finger.side * finger.gap;
    });
    return arm;
  }

  // Broad wooden shoulders and a free metal hook, as in the close-up.
  function hangerSlat(a, b, width) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const slat = box(towelTask, [width, start.distanceTo(end), .09], start.clone().add(end).multiplyScalar(.5).toArray(), 'wood');
    slat.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  }
  hangerSlat([-.86, 0, 0], [0, .45, 0], .09);
  hangerSlat([0, .45, 0], [.86, 0, 0], .09);
  link(towelTask, [-.86, 0, 0], [.86, 0, 0], .027, 'wood');
  tube(towelTask, [[0, .43, 0], [0, .59, 0], [.03, .74, 0], [.13, .79, 0], [.23, .74, 0], [.25, .65, 0]], 'cream', .018);

  function towelPoint(u, v) {
    let x = .20 + (u * 2 - 1) * .34;
    let y, z, fall;
    if (v < .4) {
      fall = 1 - v / .4;
      y = .07 - fall * 1.12;
      z = -.22 + fall * .10;
    } else if (v <= .6) {
      const angle = (v - .4) / .2 * Math.PI;
      y = .07 + Math.sin(angle) * .045;
      z = -.0575 - Math.cos(angle) * .1625;
      fall = 0;
    } else {
      fall = (v - .6) / .4;
      y = .07 - fall * 1.28;
      z = .105 + fall * .045;
    }
    // Keep both fingertip contacts fixed, with wrinkles easing into each pinch.
    const upperPin = 1 - Math.exp(-((u - 1) ** 2 / .022 + (v - .4) ** 2 / .003));
    const lowerPin = 1 - Math.exp(-(u ** 2 / .018 + (v - .69) ** 2 / .005));
    const freedom = upperPin * lowerPin;
    const loose = Math.pow(fall, .72);
    const face = v < .5 ? -1 : 1;
    // Uneven longitudinal folds deepen under gravity; their crests wander
    // slightly rather than making a uniformly corrugated sheet.
    const fold = Math.sin(u * Math.PI * 4.6 + .55 * Math.sin(fall * 3.8) + face * .35) * .071
      + Math.sin(u * Math.PI * 9.4 - fall * 1.6 + .8) * .023;
    z += freedom * loose * fold;
    x += freedom * loose * (.026 * Math.sin(fall * 3.4 + face * .7) + .014 * Math.sin(u * Math.PI * 2));
    // Weight pulls the middle down; the free hem and edges curl unevenly.
    y -= freedom * (.065 * Math.sin(u * Math.PI) * loose
      + .023 * Math.sin(u * Math.PI * 4.5 + .6) * fall * fall);
    z += freedom * .035 * Math.pow(fall, 5) * Math.sin(u * Math.PI * 3.2 + face);
    // Short diagonal gathers radiate from the lower grip, fading into the drape.
    const gatherDistance = Math.hypot(u * .68, (v - .69) * 3.2);
    z += freedom * .016 * Math.sin(gatherDistance * 35) * Math.exp(-gatherDistance * 6);
    return [x, y, z];
  }
  const towel = new THREE.Group(); towelTask.add(towel);
  towel.name = 'Narrow folded towel being fed through the hanger opening';
  const towelGeometry = new THREE.PlaneGeometry(1, 1, 56, 96);
  const towelVertices = towelGeometry.attributes.position;
  for (let i = 0; i < towelVertices.count; i++) {
    towelVertices.setXYZ(i, ...towelPoint(towelVertices.getX(i) + .5, .5 - towelVertices.getY(i)));
  }
  towelGeometry.computeVertexNormals();
  const towelMaterial = materials.cloth.clone();
  towelMaterial.color.set('#707984'); towelMaterial.side = THREE.DoubleSide;
  towelMaterial.onBeforeCompile = shader => {
    materials.cloth.onBeforeCompile(shader);
    // Softer pigment shading makes the fabric's curved folds readable while
    // retaining the same paper grain and pencil hatching as the scene.
    shader.fragmentShader = shader.fragmentShader.replace(
      'outgoingLight = diffuseColor.rgb * mix(.64, 1.12, shade);',
      'float fabricShade = smoothstep(-.25, .85, dot(normalize(vInkNormal), normalize(vec3(-.5, .75, .4)))); outgoingLight = diffuseColor.rgb * mix(.57, 1.12, fabricShade);'
    );
  };
  towelMaterial.customProgramCacheKey = () => 'paper-fabric-folds-v1';
  mesh(towelGeometry, towelMaterial, towel);
  const weaveMaterial = towelMaterial.clone(); weaveMaterial.color.set('#818990');
  weaveMaterial.onBeforeCompile = towelMaterial.onBeforeCompile;
  weaveMaterial.customProgramCacheKey = towelMaterial.customProgramCacheKey;
  for (const u of [0, 1]) tube(towel, Array.from({ length: 97 }, (_, i) => towelPoint(u, i / 96)), weaveMaterial, .007);
  for (const v of [0, 1]) tube(towel, Array.from({ length: 57 }, (_, i) => towelPoint(i / 56, v)), weaveMaterial, .008);
  // Fine woven ribs bend with the surface, leaving the larger soft folds dominant.
  for (let row = 1; row < 29; row++) {
    const v = row / 29;
    tube(towel, Array.from({ length: 33 }, (_, i) => {
      const p = towelPoint(i / 32, v);
      p[2] += v < .5 ? -.004 : .004;
      return p;
    }), weaveMaterial, .003);
  }

  const supportArm = robotArm(tri, { position: [-1.65, benchTop, -.80], scale: .9, color: 'sage' });
  stageOrientedPinch(supportArm, [-.16, .45 * (1 - .16 / .86), 0], [1, .12, 0], [0, 0, 1], .09);
  supportArm.name = 'O: supporting the wooden hanger shoulder below the free hook';
  const upperArm = robotArm(tri, { position: [1.70, benchTop, -.65], scale: .9, color: 'green' });
  stageOrientedPinch(upperArm, towelPoint(1, .4), [-1, 0, 0], [0, 0, 1], .025);
  upperArm.name = 'R: feeding the folded towel from above and behind the bar';
  const lowerArm = robotArm(tri, { position: [-.65, benchTop, 1.38], scale: .9, color: 'navy' });
  stageOrientedPinch(lowerArm, towelPoint(0, .69), [1, .18, 0], [0, 0, 1], .025);
  lowerArm.name = 'L: guiding the towel from below and in front of the bar';
  let width = 1, height = 1, compact = false, selected = -1, inspecting = false;
  const home = { theta: -.09, phi: .88, radius: 22 };
  const view = { ...home, target: new THREE.Vector3(0, 1, 0) };
  const goal = { ...home, target: view.target.clone() };
  let velocityX = 0, velocityY = 0, pointer = null, lastTimestamp = 0;
  let hoverX = 0, hoverY = 0, aimX = 0, aimY = 0;
  let visible = true, pageVisible = !document.hidden, frame = null, elapsed = 0;
  const raycaster = new THREE.Raycaster();
  const pointerVector = new THREE.Vector2();

  function resize() {
    width = host.clientWidth; height = host.clientHeight;
    compact = width < 700;
    home.radius = compact ? Math.max(28, 31 * 390 / width) : 22;
    if (selected === -1) goal.radius = home.radius;
    else if (inspecting) goal.radius = compact ? 5.8 : 5;
    else goal.radius = selected === 2 ? (compact ? 13.5 : 12.5) : (compact ? 13.5 : 12);
    renderer.setSize(width, height, false);
    camera.updateProjectionMatrix();
    wake();
  }

  function select(index) {
    selected = index;
    inspecting = false;
    stations.forEach(station => { station.group.visible = true; });
    touchPayload.visible = true;
    document.querySelector('#sensor-hint').textContent = 'Illustrative sensor geometry.';
    sensorInspectButton.textContent = 'Inspect tactile sensors';
    sensorInspectButton.setAttribute('aria-pressed', 'false');
    host.dataset.viewMode = 'project';
    velocityX = velocityY = 0;
    const p = projects[index].position;
    goal.target.set(p[0], taskScenes[index].targetY, p[2]);
    goal.radius = index === 2 ? (compact ? 13.5 : 12.5) : (compact ? 13.5 : 12);
    goal.phi = 1.04;
    goal.theta = taskScenes[index].angle;
    host.dataset.selectedProject = String(index);
    wake();
  }
  selectView = select;
  inspectGripper = () => {
    if (selected !== 0) showProject(0);
    if (inspecting) { select(0); return; }
    inspecting = true;
    stations.forEach(station => { station.group.visible = station.index === 0; });
    touchPayload.visible = false;
    document.querySelector('#sensor-hint').textContent = 'Cups hidden to show both inner pads. Drag to look around.';
    scene.updateMatrixWorld(true);
    goal.target.copy(touchArm.userData.gripper.localToWorld(new THREE.Vector3(0, -.31, 0)));
    goal.radius = compact ? 5.8 : 5;
    goal.phi = 1.22;
    goal.theta = -.18;
    velocityX = velocityY = 0;
    host.dataset.viewMode = 'sensors';
    sensorInspectButton.textContent = 'View full arm';
    sensorInspectButton.setAttribute('aria-pressed', 'true');
    wake();
  };
  resetScene = () => {
    selected = -1;
    inspecting = false;
    stations.forEach(station => { station.group.visible = true; });
    touchPayload.visible = true;
    sensorInspectButton.textContent = 'Inspect tactile sensors';
    sensorInspectButton.setAttribute('aria-pressed', 'false');
    delete host.dataset.viewMode;
    Object.assign(goal, home);
    goal.target = new THREE.Vector3(0, 1, 0);
    velocityX = velocityY = 0;
    delete host.dataset.selectedProject;
    wake();
  };

  function hitTest(event) {
    const rect = canvas.getBoundingClientRect();
    pointerVector.set((event.clientX - rect.left) / width * 2 - 1, -(event.clientY - rect.top) / height * 2 + 1);
    raycaster.setFromCamera(pointerVector, camera);
    const hits = raycaster.intersectObjects(selectable.filter(group => group.visible), true);
    if (!hits.length) return null;
    let object = hits[0].object;
    while (object && object.userData.project === undefined) object = object.parent;
    return object?.userData.project ?? null;
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer) return;
    pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, time: performance.now(), lastMove: performance.now(), distance: 0, type: event.pointerType };
    velocityX = velocityY = 0;
    canvas.setPointerCapture(event.pointerId);
    host.dataset.dragging = 'true';
    wake();
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointer) {
      const rect = canvas.getBoundingClientRect();
      aimX = (event.clientX - rect.left) / width - .5;
      aimY = (event.clientY - rect.top) / height - .5;
      canvas.style.cursor = hitTest(event) !== null ? 'pointer' : 'grab';
      wake();
      return;
    }
    if (pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    const now = performance.now(), dt = Math.max(8, now - pointer.lastMove);
    pointer.distance = Math.max(pointer.distance, Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY));
    goal.theta -= dx * .005;
    if (pointer.type !== 'touch') goal.phi = THREE.MathUtils.clamp(goal.phi - dy * .003, .38, 1.32);
    velocityX = THREE.MathUtils.clamp(-dx * .005 / dt * 16.67, -.04, .04);
    velocityY = pointer.type === 'touch' ? 0 : THREE.MathUtils.clamp(-dy * .003 / dt * 16.67, -.02, .02);
    pointer.x = event.clientX; pointer.y = event.clientY; pointer.lastMove = now;
    wake();
  });
  function endPointer(event, cancelled = false) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const wasClick = !cancelled && pointer.distance < 6;
    if (cancelled || performance.now() - pointer.lastMove > 100 || reducedMotion.matches) velocityX = velocityY = 0;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointer = null;
    host.dataset.dragging = 'false';
    if (wasClick) {
      const index = hitTest(event);
      if (index !== null) showProject(index);
    }
    wake();
  }
  canvas.addEventListener('pointerup', event => endPointer(event));
  canvas.addEventListener('pointercancel', event => endPointer(event, true));
  canvas.addEventListener('lostpointercapture', event => endPointer(event, true));
  canvas.addEventListener('pointerleave', () => { aimX = aimY = 0; wake(); });

  function turn(amount) { goal.theta += amount; velocityX = velocityY = 0; wake(); }
  function zoom(amount) { goal.radius = THREE.MathUtils.clamp(goal.radius + amount, inspecting ? 3 : 7, 38); wake(); }
  document.querySelector('#turn-left').addEventListener('click', () => turn(-.3));
  document.querySelector('#turn-right').addEventListener('click', () => turn(.3));
  document.querySelector('#zoom-in').addEventListener('click', () => zoom(-2));
  document.querySelector('#zoom-out').addEventListener('click', () => zoom(2));
  canvas.addEventListener('keydown', event => {
    const actions = { ArrowLeft: () => turn(-.15), ArrowRight: () => turn(.15), ArrowUp: () => { goal.phi = Math.max(.38, goal.phi - .1); }, ArrowDown: () => { goal.phi = Math.min(1.32, goal.phi + .1); }, '+': () => zoom(-2), '=': () => zoom(-2), '-': () => zoom(2), Home: () => document.querySelector('#reset-view').click(), Escape: () => document.querySelector('#reset-view').click() };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); wake(); }
  });

  function updateLabels() {
    const occupied = [];
    const ordered = [...stations].sort((a, b) => a.group.position.distanceToSquared(camera.position) - b.group.position.distanceToSquared(camera.position));
    for (const station of ordered) {
      station.projected.copy(station.anchor);
      station.group.localToWorld(station.projected);
      station.projected.project(camera);
      const x = (station.projected.x * .5 + .5) * width;
      const y = (-station.projected.y * .5 + .5) * height;
      const label = labels[station.index];
      const labelWidth = label.offsetWidth || 110;
      const inFrame = station.projected.z < 1 && x > labelWidth / 2 + 10 && x < width - labelWidth / 2 - 10 && y > (compact ? 160 : 150) && y < height - 65;
      const overlaps = occupied.some(point => Math.abs(point.x - x) < (point.width + labelWidth) / 2 + 6 && Math.abs(point.y - y) < 38);
      const show = !inspecting && inFrame && !overlaps && (selected === -1 || selected === station.index);
      label.hidden = !show;
      if (show) {
        label.style.left = `${x.toFixed(1)}px`;
        label.style.top = `${y.toFixed(1)}px`;
        occupied.push({ x, y, width: labelWidth });
      }
    }
  }

  function render(timestamp) {
    frame = null;
    if (!visible || !pageVisible) return;
    const dt = Math.min((timestamp - (lastTimestamp || timestamp)) / 1000, .05);
    lastTimestamp = timestamp;
    elapsed += dt;
    if (!pointer) {
      goal.theta += velocityX * dt * 60;
      goal.phi = THREE.MathUtils.clamp(goal.phi + velocityY * dt * 60, .38, 1.32);
      const friction = Math.exp(-6 * dt);
      velocityX *= friction; velocityY *= friction;
      if (Math.abs(velocityX) < .00005) velocityX = 0;
      if (Math.abs(velocityY) < .00005) velocityY = 0;
    }
    const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-(pointer ? 18 : 9) * dt);
    view.theta += (goal.theta - view.theta) * ease;
    view.phi += (goal.phi - view.phi) * ease;
    view.radius += (goal.radius - view.radius) * ease;
    view.target.lerp(goal.target, ease);
    hoverX += (aimX - hoverX) * ease;
    hoverY += (aimY - hoverY) * ease;
    const theta = view.theta + (reducedMotion.matches || compact ? 0 : hoverX * .035);
    const phi = view.phi + (reducedMotion.matches || compact ? 0 : hoverY * .018);
    camera.position.set(view.radius * Math.sin(phi) * Math.sin(theta), view.radius * Math.cos(phi), view.radius * Math.sin(phi) * Math.cos(theta)).add(view.target);
    camera.lookAt(view.target);
    const halfHeight = view.radius * (compact ? .35 : .28);
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.left = -halfHeight * width / height; camera.right = halfHeight * width / height;
    camera.updateProjectionMatrix();
    if (!reducedMotion.matches) animatedParts.forEach(part => {
      if (part.kind === 'arm') {
        if (part.staged) return;
        if (part.tactile && inspecting) return;
        const base = part.rig.joints[0];
        const elbowIndex = part.rig.dof === 7 ? 3 : 2;
        const elbow = part.rig.joints[elbowIndex];
        const wristIndex = part.rig.dof - 2;
        const wrist = part.rig.joints[wristIndex];
        part.rig.setJointAngle(0, base.homeAngle + Math.sin(elapsed * .55 + part.phase) * .035);
        part.rig.setJointAngle(elbowIndex, elbow.homeAngle + Math.sin(elapsed * .45 + part.phase) * .014);
        part.rig.setJointAngle(wristIndex, wrist.homeAngle + Math.sin(elapsed * .45 + part.phase) * -.014);
        part.fingers.forEach(finger => { finger.object.position.x = finger.side * (finger.gap + Math.sin(elapsed * .9 + part.phase) * (part.tactile ? .012 : .025)); });
      } else part.object.rotation.x = .3 + Math.sin(elapsed * .65 + part.phase) * .12;
    });
    if (!reducedMotion.matches) waterMarks.position.x = Math.sin(elapsed * .12) * .15;
    renderer.render(scene, camera);
    updateLabels();
    host.dataset.viewAngle = view.theta.toFixed(3);
    host.dataset.viewDistance = view.radius.toFixed(2);
    const moving = Math.abs(goal.theta - view.theta) + Math.abs(goal.phi - view.phi) + Math.abs(goal.radius - view.radius) + view.target.distanceTo(goal.target) > .001 || velocityX !== 0 || velocityY !== 0;
    if (!reducedMotion.matches || moving || pointer) wake();
  }
  function wake() { if (frame === null && visible && pageVisible) frame = requestAnimationFrame(render); }
  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; lastTimestamp = 0; wake(); }, { threshold: 0 }).observe(host);
  document.addEventListener('visibilitychange', () => { pageVisible = !document.hidden; lastTimestamp = 0; wake(); });
  reducedMotion.addEventListener('change', () => { velocityX = velocityY = 0; wake(); });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); visible = false;
    status.textContent = 'The 3D view is paused. You can find the studies in the Paper section above.';
    status.hidden = false;
    labels.forEach(label => { label.hidden = true; });
  });
  canvas.addEventListener('webglcontextrestored', () => { visible = true; status.hidden = true; wake(); });
  resize();
  view.radius = goal.radius;
  status.hidden = true;
  host.setAttribute('aria-busy', 'false');
  host.dataset.ready = 'true';
  wake();
}

try { startScene(); }
catch (error) {
  console.error('Research space could not start:', error);
  status.textContent = 'The 3D view is unavailable in this browser. You can find the studies in the Paper section above.';
  host.setAttribute('aria-busy', 'false');
  document.querySelectorAll('.space-controls button').forEach(button => { button.disabled = true; });
}
