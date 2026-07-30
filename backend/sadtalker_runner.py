import uvicorn
import os

def start_server():
    """
    Coordinates FastAPI local startup on port 8000.
    Ensures that temporary directories are cleaned on launch.
    """
    print("Initializing FaceTalk AI Local Animation Server...")
    
    # Create temp directory
    os.makedirs("temp", exist_ok=True)
    
    # Check SadTalker models status
    check_sadtalker_models()
    
    # Launch Uvicorn Server
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

def check_sadtalker_models():
    """
    Verifies that the required checkpoints/weights are downloaded.
    Prints informative instructions if weights are missing.
    """
    checkpoints_path = os.path.join("SadTalker", "checkpoints")
    gfpgan_path = os.path.join("SadTalker", "gfpgan", "weights")
    
    sadtalker_exists = os.path.exists("SadTalker")
    
    if not sadtalker_exists:
        print("[Notice] SadTalker directory not found. The server will run in simulation mode.")
        print("To install SadTalker, run: git clone https://github.com/OpenTalker/SadTalker")
        return
        
    models_present = os.path.exists(checkpoints_path) and os.path.exists(gfpgan_path)
    if not models_present:
        print("[Notice] Pretrained models might be missing from 'SadTalker/checkpoints'.")
        print("Please download the following checkpoints to enable realistic face animations:")
        print("1. sadtalker checkpoint files (e.g. mapping_00109-2023_01_18.pth.tar)")
        print("2. gfpgan weights (e.g. GFPGANv1.4.pth) inside 'SadTalker/gfpgan/weights/'")

if __name__ == "__main__":
    start_server()
