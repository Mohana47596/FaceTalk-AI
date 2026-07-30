import sys
sys.stdout.reconfigure(encoding='utf-8')

with open("src/components/FaceTalkScene.jsx", "r", encoding="utf-8") as f:
    lines = f.read().splitlines()

for idx in range(49, 160):
    if idx < len(lines):
        print(f"{idx+1}: {lines[idx]}")
