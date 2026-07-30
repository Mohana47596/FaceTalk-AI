const fs = require('fs');
const THREE = require('three');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');
const { FBXLoader } = require('three/examples/jsm/loaders/FBXLoader.js');
const SkeletonUtils = require('three/examples/jsm/utils/SkeletonUtils.js');
const { JSDOM } = require('jsdom');

const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
global.ProgressEvent = dom.window.ProgressEvent;
global.FileReader = dom.window.FileReader;

const glbBuffer = fs.readFileSync('d:/internship final/facetalk-ai/public/models/human.glb');
const fbxBuffer = fs.readFileSync('d:/internship final/facetalk-ai/public/animations/Idle.fbx');

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();

gltfLoader.parse(glbBuffer.buffer.slice(glbBuffer.byteOffset, glbBuffer.byteOffset + glbBuffer.byteLength), '', (gltf) => {
  const targetScene = gltf.scene;

  // Find target skinned mesh
  let targetMesh = null;
  targetScene.traverse(c => {
    if (c.isSkinnedMesh) targetMesh = c;
  });

  const sourceScene = fbxLoader.parse(fbxBuffer.buffer.slice(fbxBuffer.byteOffset, fbxBuffer.byteOffset + fbxBuffer.byteLength), '');

  const sourceBones = [];
  sourceScene.traverse(c => {
    if (c.isBone || c.name.toLowerCase().includes('mixamorig')) {
      sourceBones.push(c);
    }
  });

  const sourceSkeleton = new THREE.Skeleton(sourceBones);

  const targetToSourceMap = {
    "DHIbodypelvis_04": "mixamorigHips",
    "DHIbodyspine_01_05": "mixamorigSpine",
    "DHIbodyspine_02_06": "mixamorigSpine1",
    "DHIbodyspine_03_07": "mixamorigSpine2",
    "DHIbodyneck_01_010": "mixamorigNeck",
    "DHIbodyhead_012": "mixamorigHead",
    "DHIbodyclavicle_l_013": "mixamorigLeftShoulder",
    "DHIbodyupperarm_l_014": "mixamorigLeftArm",
    "DHIbodylowerarm_l_015": "mixamorigLeftForeArm",
    "DHIbodyhand_l_016": "mixamorigLeftHand",
    "DHIbodyclavicle_r_0144": "mixamorigRightShoulder",
    "DHIbodyupperarm_r_0145": "mixamorigRightArm",
    "DHIbodylowerarm_r_0146": "mixamorigRightForeArm",
    "DHIbodyhand_r_0147": "mixamorigRightHand",
    "DHIbodythigh_l_0277": "mixamorigLeftUpLeg",
    "DHIbodycalf_l_0278": "mixamorigLeftLeg",
    "DHIbodyfoot_l_0279": "mixamorigLeftFoot",
    "DHIbodythigh_r_0310": "mixamorigRightUpLeg",
    "DHIbodycalf_r_0311": "mixamorigRightLeg",
    "DHIbodyfoot_r_0312": "mixamorigRightFoot"
  };

  const clip = sourceScene.animations[0];

  try {
    // Attach skeleton to targetScene so SkeletonUtils can read it, but targetScene updates all bone matrixWorlds!
    targetScene.skeleton = targetMesh.skeleton;

    const retargetedClip = SkeletonUtils.retargetClip(targetScene, sourceSkeleton, clip, {
      names: targetToSourceMap,
      hip: 'DHIbodypelvis_04'
    });

    console.log('Target Upperarm L initial rotation (Euler):', targetMesh.skeleton.getBoneByName('DHIbodyupperarm_l_014').rotation);

    const mixer = new THREE.AnimationMixer(targetScene);
    const action = mixer.clipAction(retargetedClip);
    action.play();

    // Let's update mixer by 0.5s
    mixer.update(0.5);

    console.log('Target Upperarm L rotation after retargeting play (Euler):', targetMesh.skeleton.getBoneByName('DHIbodyupperarm_l_014').rotation);
    console.log('Pelvis rotation after retargeting play (Euler):', targetMesh.skeleton.getBoneByName('DHIbodypelvis_04').rotation);
  } catch (err) {
    console.error('Error during retargeting/play:', err);
  }
});
