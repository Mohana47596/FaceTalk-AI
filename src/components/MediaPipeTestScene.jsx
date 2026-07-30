import React, { useRef, useState, useCallback, useEffect } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

const S = {
  root: { width: '100vw', height: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', color: '#e4e4e7', fontFamily: 'Inter, system-ui, sans-serif' },
  topBar: { padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#111', display: 'flex', alignItems: 'center', gap: 12 },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  left: { width: 380, borderRight: '1px solid rgba(255,255,255,0.08)', background: '#111', display: 'flex', flexDirection: 'column', padding: 20, overflowY: 'auto' },
  right: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' },
  dropZone: { border: '2px dashed #3f3f46', borderRadius: 12, padding: '30px 20px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s', background: 'rgba(255,255,255,0.02)' },
  canvasContainer: { position: 'relative', maxWidth: '90%', maxHeight: '90%' },
  img: { display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', opacity: 0.8 },
  canvasOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },
  statBox: { background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, fontSize: '0.8rem', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between' }
};

export default function MediaPipeTestScene() {
  const [landmarker, setLandmarker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Loading MediaPipe WebAssembly modules...');
  const [imgUrl, setImgUrl] = useState(null);
  const [stats, setStats] = useState(null);

  const fileRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // Initialize MediaPipe FaceLandmarker on mount
  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          outputFaceBlendshapes: false,
          runningMode: "IMAGE",
          numFaces: 1
        });
        
        if (active) {
          setLandmarker(lm);
          setLoading(false);
          setStatus('Ready. Upload an image to detect 478 facial landmarks.');
        }
      } catch (err) {
        if (active) {
          console.error(err);
          setStatus('Failed to load MediaPipe: ' + err.message);
          setLoading(false);
        }
      }
    };
    init();
    return () => { active = false; };
  }, []);

  const processImage = async () => {
    if (!landmarker || !imgRef.current || !canvasRef.current) return;
    setStatus('Detecting landmarks...');
    
    // Wait for image to naturally render its dimensions
    const img = imgRef.current;
    if (img.naturalWidth === 0) return;

    // Run inference
    const result = landmarker.detect(img);
    
    if (result.faceLandmarks.length === 0) {
      setStatus('No face detected.');
      setStats(null);
      return;
    }

    const landmarks = result.faceLandmarks[0]; // 478 points
    
    // Prepare canvas overlay
    const canvas = canvasRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Bounding Box calculation
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // Draw all 478 landmarks
    ctx.fillStyle = '#00ff88';
    for (const lm of landmarks) {
      const x = lm.x * canvas.width;
      const y = lm.y * canvas.height;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw bounding box
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 2;
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

    // Key points (approximate indices from MediaPipe mesh)
    const noseTip = landmarks[1];
    const leftEye = landmarks[159]; // approx center top
    const rightEye = landmarks[386]; // approx center top
    const mouthCenter = landmarks[13]; // inner lip center

    const formatCoord = (lm) => `(${Math.round(lm.x * canvas.width)}, ${Math.round(lm.y * canvas.height)})`;

    setStats({
      count: landmarks.length,
      box: `${Math.round(maxX - minX)}x${Math.round(maxY - minY)}`,
      nose: formatCoord(noseTip),
      leftEye: formatCoord(leftEye),
      rightEye: formatCoord(rightEye),
      mouth: formatCoord(mouthCenter)
    });

    setStatus('Detection complete.');
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setStats(null);
    setStatus('Image loaded. Waiting to detect...');
  };

  return (
    <div style={S.root}>
      <div style={S.topBar}>
        <span style={{ fontSize: 20 }}>🧠</span>
        <span style={{ fontWeight: 700 }}>MediaPipe FaceLandmarker POV Test</span>
      </div>

      <div style={S.body}>
        <div style={S.left}>
          <div 
            style={S.dropZone} 
            onClick={() => !loading && fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
            <div style={{ fontSize: 32, marginBottom: 8 }}>{loading ? '⏳' : '📸'}</div>
            <div style={{ fontWeight: 600 }}>{loading ? 'Initializing MediaPipe...' : 'Upload Image'}</div>
          </div>

          <div style={{ marginTop: 24, fontSize: '0.8rem', color: '#a1a1aa', lineHeight: 1.6 }}>
            Status: <br/>
            <strong style={{ color: '#fff' }}>{status}</strong>
          </div>

          {stats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#71717a' }}>Detection Results</div>
              <div style={S.statBox}><span>Landmarks</span> <span style={{ color: '#00ff88' }}>{stats.count} (Target: 478)</span></div>
              <div style={S.statBox}><span>Face Box</span> <span style={{ color: '#fff' }}>{stats.box}</span></div>
              <div style={S.statBox}><span>Nose Tip</span> <span style={{ color: '#a78bfa' }}>{stats.nose}</span></div>
              <div style={S.statBox}><span>Left Eye</span> <span style={{ color: '#60a5fa' }}>{stats.leftEye}</span></div>
              <div style={S.statBox}><span>Right Eye</span> <span style={{ color: '#60a5fa' }}>{stats.rightEye}</span></div>
              <div style={S.statBox}><span>Mouth Center</span> <span style={{ color: '#f472b6' }}>{stats.mouth}</span></div>
            </div>
          )}
        </div>

        <div style={S.right}>
          {imgUrl && (
            <div style={S.canvasContainer}>
              {/* The image drives the layout dimensions */}
              <img 
                ref={imgRef} 
                src={imgUrl} 
                style={S.img} 
                onLoad={processImage} 
                alt="Face" 
              />
              {/* Canvas overlays perfectly on top using absolute positioning */}
              <canvas ref={canvasRef} style={S.canvasOverlay} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
