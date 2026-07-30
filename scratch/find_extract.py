import sys
sys.stdout.reconfigure(encoding='utf-8')

with open("src/components/FaceTalkScene.jsx", "r", encoding="utf-8") as f:
    lines = f.read().splitlines()

for i, line in enumerate(lines):
    if "extractFaceWithMediaPipe" in line:
        print(f"{i+1}: {line}")
