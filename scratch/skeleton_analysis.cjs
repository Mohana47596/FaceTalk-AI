const fs = require('fs');
const THREE = require('three');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');
const { FBXLoader } = require('three/examples/jsm/loaders/FBXLoader.js');
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
  const gltfBones = [];
  gltf.scene.traverse(c => {
    if (c.isBone) {
      gltfBones.push(c.name);
    }
  });

  const fbx = fbxLoader.parse(fbxBuffer.buffer.slice(fbxBuffer.byteOffset, fbxBuffer.byteOffset + fbxBuffer.byteLength), '');
  const fbxBones = [];
  fbx.traverse(c => {
    if (c.isBone || c.type === 'Bone' || c.name.toLowerCase().includes('mixamorig')) {
      fbxBones.push(c.name);
    }
  });

  console.log('=== GLTF BONES (Count: ' + gltfBones.length + ') ===');
  console.log(gltfBones.slice(0, 100).join('\n'));
  if (gltfBones.length > 100) {
    console.log('... and ' + (gltfBones.length - 100) + ' more bones');
  }

  console.log('\n=== FBX BONES (Count: ' + fbxBones.length + ') ===');
  console.log(fbxBones.slice(0, 100).join('\n'));
  if (fbxBones.length > 100) {
    console.log('... and ' + (fbxBones.length - 100) + ' more bones');
  }
});
