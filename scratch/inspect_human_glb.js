import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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

const glbPath = path.resolve('d:/internship final/facetalk-ai/public/models/human.glb');
const buffer = fs.readFileSync(glbPath);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new GLTFLoader();
try {
  loader.parse(arrayBuffer, '', (gltf) => {
    console.log('human.glb Parsed Successfully!');
    const scene = gltf.scene;
    let bones = [];
    let meshes = [];

    scene.traverse(child => {
      if (child.isBone) {
        bones.push(child.name);
      }
      if (child.isMesh) {
        meshes.push(`${child.name} (${child.type})`);
      }
    });

    console.log(`Bones found (${bones.length}):`);
    console.log(JSON.stringify(bones, null, 2));

    console.log(`\nMeshes found (${meshes.length}):`);
    console.log(JSON.stringify(meshes, null, 2));

  }, (err) => {
    console.error('GLTF parse error:', err);
  });
} catch (err) {
  console.error('GLTF load failed:', err);
}
