import React, { useRef, useEffect, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Decal, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { Background3D, FloatingParticles } from './Background3D.jsx';
import Avatar3D from './Avatar3D.jsx';

// ── Error Boundary ─────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: 20, background: 'black', height: '100vh' }}>
          <h2>💥 Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Bone name normaliser ───────────────────────────────────────────────────────
function stripMixamoPrefix(name) {
  if (!name) return name;
  if (name.includes(':')) return name.split(':').pop();
  return name.replace(/^mixamorig\d*[_]?/i, '');
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  root:        { width: '100vw', height: '100vh', background: '#0a0a0a', display: 'flex', color: '#e4e4e7', fontFamily: 'Inter, system-ui, sans-serif' },
  leftPanel:   { width: 420, borderRight: '1px solid rgba(255,255,255,0.08)', background: '#111', display: 'flex', flexDirection: 'column', padding: 20, overflowY: 'auto' },
  rightPanel:  { flex: 1, position: 'relative' },
  dropZone:    { border: '2px dashed #3f3f46', borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', marginBottom: 16 },
  sectionTitle:{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#71717a', marginBottom: 8, marginTop: 20, letterSpacing: '0.08em' },
  statBox:     { background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 8, fontSize: '0.8rem', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', marginBottom: 8 },
  sliderRow:   { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', marginBottom: 8 },
  slider:      { flex: 1, cursor: 'pointer', accentColor: '#a5b4fc' },
  val:         { width: 46, textAlign: 'right', fontFamily: 'monospace', color: '#a5b4fc', fontSize: '0.75rem' },
  label:       { width: 50, color: '#a1a1aa', flexShrink: 0 },
};

// ── Face extraction ────────────────────────────────────────────────────────────
async function extractFaceWithMediaPipe(imgEl, landmarker) {
  const result = landmarker.detect(imgEl);
  if (!result?.faceLandmarks?.length) throw new Error('No face detected');
  const lms = result.faceLandmarks[0];
  const w = imgEl.naturalWidth, h = imgEl.naturalHeight;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const lm of lms) {
    minX = Math.min(minX, lm.x * w); minY = Math.min(minY, lm.y * h);
    maxX = Math.max(maxX, lm.x * w); maxY = Math.max(maxY, lm.y * h);
  }
  const lmW = maxX - minX, lmH = maxY - minY;
  const cx = Math.max(0, minX - lmW * 0.25);
  const cy = Math.max(0, minY - lmH * 0.42);
  const cw = Math.min(w - cx, lmW * 1.5);
  const ch = Math.min(h - cy, lmH * 1.67);
  const SIZE = 512;
  const can = document.createElement('canvas');
  can.width = can.height = SIZE;
  const ctx = can.getContext('2d');
  
  // 1. Draw the face image cropped from the original portrait
  ctx.drawImage(imgEl, cx, cy, cw, ch, 0, 0, SIZE, SIZE);
  
  // 2. Create a mask canvas
  const maskCan = document.createElement('canvas');
  maskCan.width = maskCan.height = SIZE;
  const maskCtx = maskCan.getContext('2d');
  
  const faceOvalIndices = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
    152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
  ];
  
  maskCtx.fillStyle = 'black';
  maskCtx.beginPath();
  faceOvalIndices.forEach((idx, i) => {
    const lm = lms[idx];
    const canvasX = ((lm.x * w - cx) / cw) * SIZE;
    const canvasY = ((lm.y * h - cy) / ch) * SIZE;
    if (i === 0) {
      maskCtx.moveTo(canvasX, canvasY);
    } else {
      maskCtx.lineTo(canvasX, canvasY);
    }
  });
  maskCtx.closePath();
  maskCtx.fill();
  
  // 3. Create a blurred mask to make the edges soft (feathered)
  const blurCan = document.createElement('canvas');
  blurCan.width = blurCan.height = SIZE;
  const blurCtx = blurCan.getContext('2d');
  blurCtx.filter = 'blur(16px)';
  blurCtx.drawImage(maskCan, 0, 0);
  
  // 4. Apply the blurred mask to the main canvas to crop and blend
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(blurCan, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  
  const tex = new THREE.CanvasTexture(can);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  // 5. Clone the canvas to draw the debug preview contour without affecting the actual texture
  const previewCan = document.createElement('canvas');
  previewCan.width = previewCan.height = SIZE;
  const previewCtx = previewCan.getContext('2d');
  previewCtx.drawImage(can, 0, 0);

  // Draw cyan face oval contour line
  previewCtx.strokeStyle = '#00ffff';
  previewCtx.lineWidth = 3;
  previewCtx.beginPath();
  faceOvalIndices.forEach((idx, i) => {
    const lm = lms[idx];
    const canvasX = ((lm.x * w - cx) / cw) * SIZE;
    const canvasY = ((lm.y * h - cy) / ch) * SIZE;
    if (i === 0) {
      previewCtx.moveTo(canvasX, canvasY);
    } else {
      previewCtx.lineTo(canvasX, canvasY);
    }
  });
  previewCtx.closePath();
  previewCtx.stroke();

  // Draw eye centers (blue), nose tip (red), and mouth center (green) dots on the preview image
  const leftEyeIndex = 159;
  const rightEyeIndex = 386;
  const noseIndex = 4;
  const mouthIndex = 13;

  const drawMarker = (idx, color) => {
    const lm = lms[idx];
    if (lm) {
      const cx_pt = ((lm.x * w - cx) / cw) * SIZE;
      const cy_pt = ((lm.y * h - cy) / ch) * SIZE;
      previewCtx.fillStyle = color;
      previewCtx.beginPath();
      previewCtx.arc(cx_pt, cy_pt, 6, 0, Math.PI * 2);
      previewCtx.fill();
    }
  };

  drawMarker(leftEyeIndex, '#3333ff');
  drawMarker(rightEyeIndex, '#3333ff');
  drawMarker(noseIndex, '#ff3333');
  drawMarker(mouthIndex, '#33ff33');

  return { texture: tex, count: lms.length, previewUrl: previewCan.toDataURL(), landmarks: lms };
}

// ── Decal-based face overlay ───────────────────────────────────────────────────
// Uses @react-three/drei's Decal to project the face directly onto the avatar's mesh.
// This eliminates all Z-fighting because the decal IS the mesh surface.
function FaceDecalMesh({ mesh, faceTexture, fPos, fScale, fCurve, showFaceMesh, showWireframe }) {
  const decalRef = useRef();
  const headWP  = useMemo(() => new THREE.Vector3(),    []);
  const headWQ  = useMemo(() => new THREE.Quaternion(), []);
  const [decalPos, setDecalPos] = useState([0, 0, 0]);
  const [decalRot, setDecalRot] = useState([0, 0, 0]);

  // Update decal position every frame to track head
  useFrame(() => {
    if (!mesh) return;
    try {
      mesh.getWorldPosition(headWP);
      mesh.getWorldQuaternion(headWQ);
      const euler = new THREE.Euler().setFromQuaternion(headWQ, 'XYZ');
      setDecalPos([headWP.x + fPos.x, headWP.y + fPos.y, headWP.z + fPos.z]);
      setDecalRot([euler.x, euler.y, euler.z]);
    } catch (e) {
      console.warn('[FaceDecalMesh] World coords translation mismatch:', e);
    }
  });

  if (!mesh || !showFaceMesh) return null;

  const decalScale = fScale * 0.12;

  return (
    <mesh
      geometry={mesh.geometry}
      material={mesh.material}
      matrixAutoUpdate={false}
      matrix={mesh.matrixWorld}
      morphTargetInfluences={mesh.morphTargetInfluences}
      morphTargetDictionary={mesh.morphTargetDictionary}
    >
      <Decal
        position={decalPos}
        rotation={decalRot}
        scale={[decalScale * 0.8, decalScale, decalScale * 0.05]}
        polygonOffsetFactor={-10}
      >
        {faceTexture ? (
          <meshBasicMaterial
            map={faceTexture}
            transparent
            alphaTest={0.05}
            depthTest
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-10}
          />
        ) : (
          <meshBasicMaterial
            color={0xff2200}
            transparent
            opacity={0.85}
            wireframe={showWireframe}
            polygonOffset
            polygonOffsetFactor={-10}
          />
        )}
      </Decal>
    </mesh>
  );
}

// ── Avatar Component ───────────────────────────────────────────────────────────
function AvatarWithFaceTalk({ faceTexture, onReady, fPos, fScale, fCurve, showWireframe, showFaceMesh }) {
  const rawModelResult = useGLTF('/models/default-avatar.glb');
  const rawModel = rawModelResult ? rawModelResult.scene : null;
  const [headMesh, setHeadMesh] = useState(null);   // the SkinnedMesh for the head
  const [headBone, setHeadBone] = useState(null);   // the Bone for position tracking

  const model = useMemo(() => {
    if (!rawModel) return null;
    const cloned = SkeletonUtils.clone(rawModel);
    cloned.traverse(c => { if (c.name) c.name = stripMixamoPrefix(c.name); });
    return cloned;
  }, [rawModel]);

  useEffect(() => {
    if (!model) return;
    let bone = null, mesh = null;
    model.traverse(c => {
      if (c.isBone && c.name.toLowerCase() === 'head') {
        bone = c;
        console.log('[FaceTalk] ✅ Head bone:', c.name);
      }
      // Find a skinned mesh (the face geometry)
      if (c.isSkinnedMesh && (c.name.toLowerCase().includes('head') || c.name.toLowerCase().includes('face') || c.name.toLowerCase().includes('avatar'))) {
        mesh = c;
        console.log('[FaceTalk] ✅ Head Mesh for decal:', c.name);
      }
    });
    if (bone) setHeadBone(bone);
    if (mesh) {
      setHeadMesh(mesh);
    } else {
      // fallback to any skinned mesh
      model.traverse(c => {
        if (c.isSkinnedMesh && !mesh) {
          mesh = c;
          setHeadMesh(c);
          console.log('[FaceTalk] ✅ Fallback Mesh for decal:', c.name);
        }
      });
    }
  }, [model]);

  useEffect(() => {
    if (!model) return;
    onReady?.();
  }, [model]);



  return (
    <>
      <primitive object={model} position={[0, -1.1, 0]} scale={1.0} />
      {headBone && headMesh && (
        <FaceDecalMesh
          mesh={headMesh}
          faceTexture={faceTexture}
          fPos={fPos}
          fScale={fScale}
          fCurve={fCurve}
          showFaceMesh={showFaceMesh}
          showWireframe={showWireframe}
        />
      )}
    </>
  );
}

// ── Main Scene ─────────────────────────────────────────────────────────────────
export default function FaceTalkScene() {
  const [landmarker,       setLandmarker]       = useState(null);
  const [loadingMediaPipe, setLoadingMediaPipe] = useState(true);
  const [processing,       setProcessing]       = useState(false);
  const [status,           setStatus]           = useState('Loading MediaPipe...');
  const [avatarReady,      setAvatarReady]      = useState(false);

  useEffect(() => {
    setAvatarReady(true);
  }, []);

  const [faceTexture,   setFaceTexture]   = useState(null);
  const [uploadedFaceInfo, setUploadedFaceInfo] = useState(null);
  const [testBlink, setTestBlink] = useState(0);
  const [testMouthOpen, setTestMouthOpen] = useState(0);
  const [isLipSyncTesting, setIsLipSyncTesting] = useState(false);
  const [previewUrl,    setPreviewUrl]    = useState(null);
  const [landmarkCount, setLandmarkCount] = useState(0);

  const [showWireframe, setShowWireframe] = useState(false);
  const [showFaceMesh,  setShowFaceMesh]  = useState(true);
  const [fPos,   setFPos]   = useState({ x: 0, y: 0.10, z: 0.095 });
  const [fScale, setFScale] = useState(1.0);
  const [fCurve, setFCurve] = useState(120);

  const backgrounds = [
    { label: 'Moon Over Mountain',   url: '/backgrounds/moon-over-mountain.jpeg'            },
    { label: 'Cityscape',            url: '/backgrounds/cityscape.jpeg'                      },
    { label: 'Classroom',            url: '/backgrounds/lernado-diff-classroom-center.jpeg'  },
    { label: 'Room Interior',        url: '/backgrounds/room-interior-illustration.jpeg'     },
    { label: 'Night Field',          url: '/backgrounds/field-night-painting-moon.jpeg'      },
  ];
  const [selectedBg, setSelectedBg] = useState(backgrounds[0].url);

  // Lip-sync dummy mouth movement oscillation
  useEffect(() => {
    if (!isLipSyncTesting) {
      setTestMouthOpen(0);
      return;
    }
    let start = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      // Oscillate mouth open smoothly between 0 and 0.75
      setTestMouthOpen(0.375 + Math.sin(elapsed * 8) * 0.375);
    }, 30);
    return () => clearInterval(timer);
  }, [isLipSyncTesting]);

  // Eye blinking test helper
  const triggerBlinkTest = () => {
    setTestBlink(1.0); // Close eyes
    setTimeout(() => {
      setTestBlink(0.0); // Open eyes after 180ms
    }, 180);
  };

  const fileRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm');
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate: 'GPU' },
          outputFaceBlendshapes: false, runningMode: 'IMAGE', numFaces: 1,
        });
        if (active) { setLandmarker(lm); setLoadingMediaPipe(false); setStatus('Ready — upload a portrait.'); }
      } catch (err) {
        if (active) { setStatus('MediaPipe failed.'); setLoadingMediaPipe(false); }
      }
    })();
    return () => { active = false; };
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !landmarker) return;
    setProcessing(true);
    setStatus('Detecting face…');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    img.onload = async () => {
      try {
        const res = await extractFaceWithMediaPipe(img, landmarker);
        setFaceTexture(res.texture);
        setPreviewUrl(res.previewUrl);
        setLandmarkCount(res.count);
        setUploadedFaceInfo({ img, landmarks: res.landmarks });
        setStatus('✅ Face aligned and applied directly to avatar!');
      } catch (err) {
        setStatus('❌ ' + err.message);
      } finally {
        setProcessing(false);
        // Do not revoke object URL immediately, as the Image element inside uploadedFaceInfo
        // might need to read it during Canvas rendering. We can revoke it later or let GC handle it.
      }
    };
  };

  const Slider = ({ label, value, min, max, step, onChange }) => (
    <div style={S.sliderRow}>
      <span style={S.label}>{label}</span>
      <input style={S.slider} type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} />
      <span style={S.val}>{Number.isInteger(value) ? value : value.toFixed(3)}</span>
    </div>
  );

  return (
    <ErrorBoundary>
      <div style={S.root}>
        <div style={S.leftPanel}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>🗣️ FaceTalk AI</div>

          <div style={S.dropZone} onClick={() => !loadingMediaPipe && !processing && fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
            <div style={{ fontSize: 28, marginBottom: 6 }}>{processing ? '⏳' : '📸'}</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {loadingMediaPipe ? 'Initializing MediaPipe…' : processing ? 'Processing…' : 'Upload Portrait'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: 6 }}>{status}</div>
          </div>

          {landmarkCount > 0 && (
            <div style={S.statBox}>
              <span style={{ color: '#a1a1aa' }}>Landmarks</span>
              <span style={{ color: '#00ff88', fontWeight: 700 }}>{landmarkCount}</span>
            </div>
          )}

          {previewUrl && (
            <div>
              <div style={S.sectionTitle}>Extraction Preview</div>
              <img src={previewUrl} style={{ width: '100%', borderRadius: 8, background: '#000', border: '1px solid rgba(255,255,255,0.1)' }} alt="Face" />
            </div>
          )}

          <div style={S.sectionTitle}>Visibility</div>
          <div style={{ display: 'flex', gap: 20, fontSize: '0.82rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={showFaceMesh} onChange={e => setShowFaceMesh(e.target.checked)} /> Face Decal
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={showWireframe} onChange={e => setShowWireframe(e.target.checked)} /> Wireframe
            </label>
          </div>

          <div style={S.sectionTitle}>Decal Position</div>
          <Slider label="X →"  value={fPos.x} min={-0.1} max={0.1}  step={0.001} onChange={v => setFPos(p => ({ ...p, x: v }))} />
          <Slider label="Y ↑"  value={fPos.y} min={0.0} max={0.2}  step={0.001} onChange={v => setFPos(p => ({ ...p, y: v }))} />
          <Slider label="Z ↗"  value={fPos.z} min={0.0} max={0.2}  step={0.001} onChange={v => setFPos(p => ({ ...p, z: v }))} />

          <div style={S.sectionTitle}>Size</div>
          <Slider label="Scale" value={fScale} min={0.2} max={4.0} step={0.05} onChange={setFScale} />

          <div style={S.sectionTitle}>Background</div>
          <select
            style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, fontSize: '0.82rem', width: '100%', marginBottom: 12 }}
            value={selectedBg} onChange={e => setSelectedBg(e.target.value)}
          >
            {backgrounds.map(b => <option key={b.url} value={b.url}>{b.label}</option>)}
          </select>

          <div style={S.sectionTitle}>ARKit Blendshape Test</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              onClick={triggerBlinkTest}
              style={{
                flex: 1, padding: '8px 12px', background: 'rgba(99,102,241,0.2)',
                color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.4)',
                borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              👁️ Test Blink
            </button>
            <button
              onClick={() => setIsLipSyncTesting(!isLipSyncTesting)}
              style={{
                flex: 1, padding: '8px 12px',
                background: isLipSyncTesting ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                color: isLipSyncTesting ? '#fca5a5' : '#6ee7b7',
                border: isLipSyncTesting ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(16,185,129,0.4)',
                borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {isLipSyncTesting ? '⏹️ Stop' : '💬 Test Talk'}
            </button>
          </div>
        </div>

        <div style={S.rightPanel}>
          {!avatarReady && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, color: '#a1a1aa' }}>
              Loading Avatar…
            </div>
          )}
          <Canvas camera={{ position: [0, 1.5, 3], fov: 45 }}>
            <color attach="background" args={['#06060f']} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[0, 5, 5]} intensity={1.4} castShadow />
            <pointLight position={[-3, 2, 2]} intensity={0.5} color="#a5b4fc" />
            <pointLight position={[ 3, 2, 2]} intensity={0.5} color="#fcd34d" />
            <hemisphereLight skyColor="#a5b4fc" groundColor="#1a1a2e" intensity={0.6} />
            <Suspense fallback={<Html><div style={{ color: 'white' }}>Loading Suspense Elements...</div></Html>}>
              {console.log("[FaceTalkScene] Suspense child execution starting...")}
              <Background3D backgroundUrl={selectedBg} />
              <FloatingParticles count={150} />
              <Avatar3D
                faceTexture={faceTexture}
                uploadedFaceInfo={uploadedFaceInfo}
                isSpeaking={isLipSyncTesting}
                isListening={false}
                isThinking={false}
                mouthOpenAmount={testMouthOpen}
                blinkAmount={testBlink}
                gesture={null}
                outfit={null}
                fPos={fPos}
                fScale={fScale}
                fCurve={fCurve}
                showFaceMesh={showFaceMesh}
                showWireframe={showWireframe}
              />
            </Suspense>
            <OrbitControls target={[0, 1.2, 0]} />
          </Canvas>
        </div>
      </div>
    </ErrorBoundary>
  );
}
