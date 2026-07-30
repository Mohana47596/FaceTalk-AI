import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { JSDOM } from 'jsdom';

// Mock browser globals for loaders
const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
global.ProgressEvent = dom.window.ProgressEvent;
global.FileReader = dom.window.FileReader;

// Add TextEncoder/TextDecoder if missing
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = await import('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

const fbxPath = path.resolve('d:/internship final/facetalk-ai/public/animations/Y Bot.fbx');
const buffer = fs.readFileSync(fbxPath);

// Convert buffer to ArrayBuffer
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new FBXLoader();
try {
  const scene = loader.parse(arrayBuffer, '');
  console.log('FBX Parsed Successfully!');
  console.log('Scene Child Nodes:');
  scene.traverse(child => {
    if (child.isMesh) {
      console.log(`Mesh: ${child.name} | Geometry Groups: ${child.geometry.groups?.length || 0} | Material type: ${child.material ? (Array.isArray(child.material) ? 'Array of ' + child.material.map(m=>m.type).join(',') : child.material.type) : 'none'}`);
    } else {
      console.log(`Node: ${child.name} (${child.type})`);
    }
  });
} catch (err) {
  console.error('FBX Load Failed:', err);
}
