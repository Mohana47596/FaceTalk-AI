import urllib.request
import os

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "models", "faceapi")
os.makedirs(MODELS_DIR, exist_ok=True)

urls = [
    "https://justadudewhohacks.github.io/face-api.js/models/ssd_mobilenetv1_model-weights_manifest.json",
    "https://justadudewhohacks.github.io/face-api.js/models/ssd_mobilenetv1_model-shard1",
    "https://justadudewhohacks.github.io/face-api.js/models/ssd_mobilenetv1_model-shard2",
    "https://justadudewhohacks.github.io/face-api.js/models/face_landmark_68_model-weights_manifest.json",
    "https://justadudewhohacks.github.io/face-api.js/models/face_landmark_68_model-shard1"
]

print(f"Downloading face-api models to: {os.path.abspath(MODELS_DIR)}")

for url in urls:
    filename = url.split("/")[-1]
    dest = os.path.join(MODELS_DIR, filename)
    if not os.path.exists(dest):
        print(f"Downloading {filename}...")
        try:
            urllib.request.urlretrieve(url, dest)
            print(f"Successfully downloaded {filename}")
        except Exception as e:
            print(f"Error downloading {filename}: {e}")
    else:
        print(f"{filename} already exists, skipping.")

print("All downloads complete!")
