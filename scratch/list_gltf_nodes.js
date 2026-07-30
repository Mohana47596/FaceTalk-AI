const fs = require('fs');
const path = require('path');

// We don't need a full GLTF parser, we can just search for "Wolf3D_" strings in the binary file to see the mesh names!
const glbPath = path.join(__dirname, '..', 'public', 'models', 'default-avatar.glb');
if (!fs.existsSync(glbPath)) {
    console.log("File not found at:", glbPath);
    process.exit(1);
}

const buffer = fs.readFileSync(glbPath);
const content = buffer.toString('utf8');

const matches = new Set();
const regex = /Wolf3D_[a-zA-Z0-9_]+/g;
let match;
while ((match = regex.exec(content)) !== null) {
    matches.add(match[0]);
}

console.log("Found Wolf3D meshes:");
console.log(Array.from(matches).sort());
