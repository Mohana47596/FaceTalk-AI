import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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

const glbPath = path.resolve('public/models/default-avatar.glb');
const buffer = fs.readFileSync(glbPath);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  const originalScene = gltf.scene;
  const cloned = SkeletonUtils.clone(originalScene);
  
  console.log('Inspecting cloned meshes for morph targets:');
  cloned.traverse(child => {
    if (child.isMesh) {
      console.log(`Mesh: ${child.name}`);
      console.log(`  - hasMorphDict: ${!!child.morphTargetDictionary}`);
      console.log(`  - morphTargetInfluences: ${child.morphTargetInfluences ? typeof child.morphTargetInfluences + ' (length: ' + child.morphTargetInfluences.length + ')' : 'undefined'}`);
      
      if (child.morphTargetDictionary && !child.morphTargetInfluences) {
        console.log(`  🚨 ERROR: Mesh ${child.name} has morph dictionary but morphTargetInfluences is undefined!`);
      }
    }
  });
});
