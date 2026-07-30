import struct
import json
import os

glb_path = r"public/models/default-avatar.glb"

with open(glb_path, 'rb') as f:
    f.read(12) # Skip header
    chunk_length = struct.unpack('<I', f.read(4))[0]
    chunk_type = f.read(4)
    json_data = f.read(chunk_length).decode('utf-8')
    gltf = json.loads(json_data)

# Print default scene and its root nodes
default_scene_idx = gltf.get('scene', 0)
scenes = gltf.get('scenes', [])
print(f"Default scene index: {default_scene_idx}")
if default_scene_idx < len(scenes):
    scene = scenes[default_scene_idx]
    print(f"Scene name: {scene.get('name', 'unnamed')}")
    print(f"Scene root nodes: {scene.get('nodes', [])}")

# Let's inspect nodes in detail
nodes = gltf.get('nodes', [])
print(f"\nTotal nodes in glTF: {len(nodes)}")

# Let's trace node children
for idx, node in enumerate(nodes):
    name = node.get('name', '')
    children = node.get('children', [])
    mesh = node.get('mesh', None)
    skin = node.get('skin', None)
    
    if children or mesh is not None or skin is not None:
        print(f"Node {idx}: '{name}' | Children: {children} | Mesh: {mesh} | Skin: {skin}")

# Print skins if any
skins = gltf.get('skins', [])
print(f"\nSkins count: {len(skins)}")
for idx, skin in enumerate(skins):
    name = skin.get('name', '')
    joints = skin.get('joints', [])
    skeleton = skin.get('skeleton', None)
    print(f"  Skin {idx}: '{name}' | Joints count: {len(joints)} | Skeleton root: {skeleton}")
