import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// Minimal browser mocks for GLTFLoader in Node
global.window = {};
global.self = global;
global.document = {
  createElement: (type) => {
    if (type === 'img') return { style: {} };
    return {};
  }
};
global.URL = {
  createObjectURL: () => '',
  revokeObjectURL: () => ''
};

// Helper function to retarget FBX animation tracks to GLTF bone names dynamically
function retargetClip(clip, scene) {
  const gltfBones = [];
  scene.traverse((child) => {
    if (child.isBone) {
      gltfBones.push(child.name);
    }
  });

  const normalize = (name) => {
    return name.replace(/mixamorig/gi, '')
               .replace(/[:_\-\s]/g, '')
               .toLowerCase();
  };

  clip.tracks.forEach((track) => {
    let trackName = track.name.replace(/:/g, '_');
    const trackParts = trackName.split('.');
    let trackBoneName = trackParts[0];

    const bracketMatch = trackBoneName.match(/\[([^\]]+)\]/);
    let leafTrackBoneName = "";
    if (bracketMatch) {
      leafTrackBoneName = bracketMatch[1];
    } else {
      const pathParts = trackBoneName.split('/');
      leafTrackBoneName = pathParts[pathParts.length - 1];
    }

    const cleanTrackName = normalize(leafTrackBoneName);

    const matchingGLTFBone = gltfBones.find((gltfBone) => {
      const leafGLTFBone = gltfBone.split(/[:_]/).pop();
      return normalize(leafGLTFBone) === cleanTrackName || normalize(gltfBone) === cleanTrackName;
    });

    if (matchingGLTFBone) {
      track.name = matchingGLTFBone + '.' + trackParts.slice(1).join('.');
    } else {
      track.name = trackName;
    }
  });

  return clip;
}

const glbPath = path.resolve('public/models/default-avatar.glb');
const buffer = fs.readFileSync(glbPath);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const gltfLoader = new GLTFLoader();
gltfLoader.parse(arrayBuffer, '', (gltf) => {
  const scene = SkeletonUtils.clone(gltf.scene);
  console.log('Parsed GLTF successfully.');

  const fbxLoader = new FBXLoader();
  const fbxPath = path.resolve('public/animations/Idle.fbx');
  const fbxBuffer = fs.readFileSync(fbxPath);
  
  try {
    const fbx = fbxLoader.parse(fbxBuffer.buffer.slice(fbxBuffer.byteOffset, fbxBuffer.byteOffset + fbxBuffer.byteLength), '');
    let clip = fbx.animations[0].clone();
    clip.name = 'idle';
    
    console.log('Original first 5 tracks:');
    clip.tracks.slice(0, 5).forEach(t => console.log('  ', t.name));

    retargetClip(clip, scene);

    console.log('Retargeted first 5 tracks:');
    clip.tracks.slice(0, 5).forEach(t => console.log('  ', t.name));

    const mixer = new THREE.AnimationMixer(scene);
    const action = mixer.clipAction(clip);
    action.play();

    console.log('Updating mixer...');
    mixer.update(0.016);
    console.log('Mixer update completed successfully!');
  } catch (err) {
    console.error('CRASH in mixer.update:', err);
    if (err.stack) {
      console.error(err.stack);
    }
  }
});
