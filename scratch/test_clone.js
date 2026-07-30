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

const glbPath = path.resolve('public/models/default-avatar.glb');
console.log('Reading GLB from:', glbPath);
const buffer = fs.readFileSync(glbPath);

const loader = new GLTFLoader();

// Convert Node Buffer to ArrayBuffer
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

loader.parse(arrayBuffer, '', (gltf) => {
  console.log('Successfully parsed GLTF!');
  const originalScene = gltf.scene;
  
  try {
    console.log('Cloning scene with SkeletonUtils.clone...');
    const cloned = SkeletonUtils.clone(originalScene);
    console.log('Successfully cloned scene!');
  } catch (err) {
    console.error('Error during SkeletonUtils.clone:', err);
  }
}, (error) => {
  console.error('Failed to parse GLTF:', error);
});
