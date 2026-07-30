import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { JSDOM } from 'jsdom';

// Create a mock browser environment for GLTFLoader
const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
global.ProgressEvent = dom.window.ProgressEvent;
global.FileReader = dom.window.FileReader;

const glbPath = path.resolve('d:/internship final/facetalk-ai/public/models/human.glb');
const buffer = fs.readFileSync(glbPath);

const loader = new GLTFLoader();

// Convert Node Buffer to ArrayBuffer
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

loader.parse(arrayBuffer, '', (gltf) => {
  console.log('Successfully parsed GLTF!');
  const originalScene = gltf.scene;
  
  console.log('Original Scene Children:');
  originalScene.traverse(child => {
    console.log(`  - ${child.name} (${child.type}) | isBone: ${child.isBone}`);
  });
  
  console.log('\nCloning scene with SkeletonUtils.clone...');
  const cloned = SkeletonUtils.clone(originalScene);
  
  console.log('Cloned Scene Children:');
  cloned.traverse(child => {
    console.log(`  - ${child.name} (${child.type}) | isBone: ${child.isBone}`);
  });
}, (error) => {
  console.error('Failed to parse GLTF:', error);
});
