import os

root_dir = r"d:\internship final"
for dirpath, dirnames, filenames in os.walk(root_dir):
    # Skip large folders to speed up search
    if 'node_modules' in dirpath or '.git' in dirpath or '.gemini' in dirpath or 'venv' in dirpath:
        continue
    for f in filenames:
        if f.endswith('.glb') or f.endswith('.gltf') or f.endswith('.fbx'):
            full_path = os.path.join(dirpath, f)
            print(f"{full_path} (size: {os.path.getsize(full_path)} bytes)")
