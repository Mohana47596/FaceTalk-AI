with open("src/components/Avatar3D.jsx", "r", encoding="utf-8") as f:
    content = f.read()

lines = content.splitlines()
for i, line in enumerate(lines):
    if "applyUserFaceToAvatar" in line:
        for idx in range(max(0, i-5), min(len(lines), i+80)):
            print(f"{idx+1}: {lines[idx]}")
        break
