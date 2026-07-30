import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
global.ProgressEvent = dom.window.ProgressEvent;
global.FileReader = dom.window.FileReader;

if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = await import('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

const fbxPath = path.resolve('d:/internship final/facetalk-ai/public/animations/Y Bot.fbx');
const buffer = fs.readFileSync(fbxPath);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new FBXLoader();
try {
  const scene = loader.parse(arrayBuffer, '');
  scene.traverse(child => {
    if (child.isMesh) {
      console.log(`Mesh: ${child.name}`);
      console.log(`Morph Target Dictionary:`, child.morphTargetDictionary);
      if (child.geometry.morphAttributes) {
        console.log(`Morph Attributes Keys:`, Object.keys(child.geometry.morphAttributes));
      }
    }
  });
} catch (err) {
  console.error('FBX parse failed:', err);
}
