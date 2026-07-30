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
  let mesh = null;
  let bones = [];

  scene.traverse(child => {
    if (child.isMesh && child.name === 'Alpha_Surface') {
      mesh = child;
    }
    if (child.isBone) {
      bones.push(child);
    }
  });

  if (!mesh) {
    console.error('Alpha_Surface mesh not found');
    process.exit(1);
  }

  // Find head bone index
  const headBoneIndex = bones.findIndex(b => b.name.toLowerCase().includes('head'));
  console.log('Head Bone Name:', bones[headBoneIndex]?.name, 'Index:', headBoneIndex);

  // Let's analyze bone weights in the geometry
  const geometry = mesh.geometry;
  const positionAttr = geometry.attributes.position;
  const skinIndexAttr = geometry.attributes.skinIndex;
  const skinWeightAttr = geometry.attributes.skinWeight;
  const uvAttr = geometry.attributes.uv;

  console.log('Position count:', positionAttr.count);
  console.log('SkinIndex count:', skinIndexAttr?.count);
  console.log('SkinWeight count:', skinWeightAttr?.count);
  console.log('UV count:', uvAttr?.count);

  // Let's traverse all vertices, and if their weight for the head bone (or neck) is > 0.1, collect their UV coordinates
  let minU = 1.0, maxU = 0.0;
  let minV = 1.0, maxV = 0.0;
  let headVerticesCount = 0;

  // We need to match bone names by index. Let's see the skeleton bones array.
  // In Three.js, the skinned mesh has a skeleton which contains bones.
  // Let's print out the mesh skeleton bones if it exists.
  const skeletonBones = mesh.skeleton ? mesh.skeleton.bones : bones;
  const headSkeletonIndex = skeletonBones.findIndex(b => b.name.toLowerCase().includes('head'));
  console.log('Head Skeleton Index:', headSkeletonIndex);

  for (let i = 0; i < positionAttr.count; i++) {
    let isHeadVertex = false;
    for (let j = 0; j < 4; j++) {
      const boneIdx = skinIndexAttr.getX(i * 4 + j) || skinIndexAttr.array[i * 4 + j];
      const weight = skinWeightAttr.getX(i * 4 + j) || skinWeightAttr.array[i * 4 + j];
      
      // If bone matches the head bone and weight is high
      const bone = skeletonBones[boneIdx];
      if (bone && bone.name.toLowerCase().includes('head') && weight > 0.2) {
        isHeadVertex = true;
      }
    }

    if (isHeadVertex && uvAttr) {
      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
      headVerticesCount++;
    }
  }

  console.log(`Found ${headVerticesCount} head vertices.`);
  console.log(`UV Bounding Box for Head vertices:`);
  console.log(`U: [${minU.toFixed(4)}, ${maxU.toFixed(4)}]`);
  console.log(`V: [${minV.toFixed(4)}, ${maxV.toFixed(4)}]`);

} catch (err) {
  console.error('FBX parse or analysis failed:', err);
}
