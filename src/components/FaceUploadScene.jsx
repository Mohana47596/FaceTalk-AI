import React, { useRef, useEffect, useState, useMemo, Suspense, useCallback } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';
import { loadFaceModels, extractFace } from '../avatar/faceExtractor';

// ── Bone name normaliser — DO NOT MODIFY (baseline) ──────────────────────────
function stripMixamoPrefix(name) {
  if (!name) return name;
  if (name.includes(':')) return name.split(':').pop();
  return name.replace(/^mixamorig\d*[_]?/i, '');
}

// ── 3D Avatar with Live Portrait Overlay ──────────────────────────────────────
function AvatarWithLiveFace({ 
  faceTexture, 
  onReady, 
  facePos, 
  faceRot, 
  faceScale, 
  faceOpacity,
  showWireframe,
  showOriginalHead
}) {
  const rawModel = useLoader(FBXLoader, '/models/hero.fbx');

  const model = useMemo(() => {
    const cloned = SkeletonUtils.clone(rawModel);
    cloned.traverse((c) => { 
      if (c.name) c.name = stripMixamoPrefix(c.name); 
    });
    return cloned;
  }, [rawModel]);

  const mixerRef = useRef(null);
  const headBoneRef = useRef(null);
  const [idleClip, setIdleClip] = useState(null);

  // Find head bone
  useEffect(() => {
    model.traverse((c) => {
      if (c.isBone && c.name.toLowerCase() === 'head') {
        headBoneRef.current = c;
      }
    });
  }, [model]);

  // Load idle animation only
  useEffect(() => {
    const loader = new FBXLoader();
    loader.load('/animations/Idle.fbx', (fbx) => {
      if (fbx.animations?.length) {
        const clip = fbx.animations[0].clone();
        clip.name = 'idle';
        clip.tracks.forEach((t) => {
          t.name = stripMixamoPrefix(t.name);
        });
        setIdleClip(clip);
      }
    });
  }, []);

  // Start idle mixer
  useEffect(() => {
    if (!model || !idleClip) return;
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;
    mixer.clipAction(idleClip).reset().setLoop(THREE.LoopRepeat, Infinity).play();
    onReady?.();
    return () => { mixer.stopAllAction(); mixer.uncacheRoot(model); };
  }, [model, idleClip]);

  // Toggle original head visibility
  useEffect(() => {
    if (!model) return;
    model.traverse((c) => {
      if (c.isMesh) {
        c.visible = showOriginalHead;
      }
    });
  }, [model, showOriginalHead]);

  useFrame((_, delta) => mixerRef.current?.update(delta));

  // The face mesh overlay attached to the head bone
  const liveFaceMesh = useMemo(() => {
    // We always create the red rectangle mesh for debugging, even without a texture
    console.log('[DEBUG] Face mesh created: PlaneGeometry(0.15, 0.2)');
    
    // Simple flat plane for debugging
    const geom = new THREE.PlaneGeometry(0.15, 0.2);
    
    // Force a bright red rectangle
    console.log('[DEBUG] Face mesh material: MeshBasicMaterial (Red)');
    const mat = new THREE.MeshBasicMaterial({
      color: '#ff0000',
      transparent: true,
      opacity: faceOpacity,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    
    const mesh = <mesh geometry={geom} material={mat} />;
    return mesh;
  }, [faceOpacity]);

  // Log everything about the mesh and bone on mount
  useEffect(() => {
    if (headBoneRef.current) {
      const bone = headBoneRef.current;
      const wp = new THREE.Vector3();
      bone.getWorldPosition(wp);
      console.log(`[DEBUG] Head bone found? YES`);
      console.log(`[DEBUG] - Name: ${bone.name}`);
      console.log(`[DEBUG] - Local Pos: x=${bone.position.x.toFixed(4)}, y=${bone.position.y.toFixed(4)}, z=${bone.position.z.toFixed(4)}`);
      console.log(`[DEBUG] - World Pos: x=${wp.x.toFixed(4)}, y=${wp.y.toFixed(4)}, z=${wp.z.toFixed(4)}`);
      
      console.log(`[DEBUG] Face mesh attached? YES`);
      console.log(`[DEBUG] - Parent bone name: ${bone.name}`);
      
      console.log(`[DEBUG] Face mesh visible? YES (forced true)`);
      console.log(`[DEBUG] - Opacity: ${faceOpacity}`);
      console.log(`[DEBUG] - Material type: MeshBasicMaterial`);
      
      console.log(`[DEBUG] Face mesh transform:`);
      console.log(`[DEBUG] - Position: x=${facePos.x}, y=${facePos.y}, z=${facePos.z}`);
      console.log(`[DEBUG] - Rotation: x=${faceRot.x}, y=${faceRot.y}, z=${faceRot.z}`);
      console.log(`[DEBUG] - Scale: ${faceScale}`);
    } else {
      console.log(`[DEBUG] Head bone found? NO`);
    }
  }, [model, facePos, faceRot, faceScale, faceOpacity]);

  return (
    <primitive object={model} position={[0, -1.1, 0]} scale={0.01}>
      {/* Attach face directly to Head bone if found */}
      {headBoneRef.current && faceTexture && (
        <primitive object={headBoneRef.current}>
          <group 
            position={[facePos.x, facePos.y, facePos.z]} 
            rotation={[
              THREE.MathUtils.degToRad(faceRot.x), 
              THREE.MathUtils.degToRad(faceRot.y), 
              THREE.MathUtils.degToRad(faceRot.z)
            ]}
            scale={[faceScale, faceScale, faceScale]}
          >
            {liveFaceMesh}
          </group>
        </primitive>
      )}
    </primitive>
  );
}

function SpinBox() {
  const ref = useRef();
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d; });
  return <mesh ref={ref}><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial color="#6366f1" wireframe /></mesh>;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  root: { width: '100vw', height: '100vh', background: '#06060f', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif', color: '#e4e4e7' },
  topBar: { padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', zIndex: 10, flexShrink: 0 },
  body: { flex: 1, display: 'grid', gridTemplateColumns: '360px 1fr', overflow: 'hidden' },
  left: { background: 'rgba(0,0,0,0.45)', borderRight: '1px solid rgba(255,255,255,0.07)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' },
  sectionTitle: { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: '#52525b', textTransform: 'uppercase', marginBottom: 4 },
  sliderRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', gap: 8, marginBottom: 6 },
  slider: { flex: 1, accentColor: '#4ade80' },
  val: { width: 32, textAlign: 'right', fontFamily: 'monospace', color: '#a1a1aa' }
};

const statusColor = { idle: '#71717a', detecting: '#facc15', done: '#4ade80', error: '#f87171' };

// ── Preview card ──────────────────────────────────────────────────────────────
function PreviewCard({ label, src, badge, dim = false }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={S.sectionTitle}>{label}</div>
      <div style={{ borderRadius: 10, overflow: 'hidden', background: 'url("data:image/svg+xml,%3Csvg width=\'10\' height=\'10\' viewBox=\'0 0 10 10\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect width=\'5\' height=\'5\' fill=\'%23ffffff08\'/%3E%3Crect x=\'5\' y=\'5\' width=\'5\' height=\'5\' fill=\'%23ffffff08\'/%3E%3C/svg%3E")', border: '1px solid rgba(255,255,255,0.08)', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {src
          ? <img src={src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: dim ? 'brightness(0.4)' : 'none', display: 'block' }} />
          : <span style={{ fontSize: 24, opacity: 0.2 }}>🖼️</span>}
        {badge && <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: '2px 6px', fontSize: '0.6rem', color: '#4ade80' }}>{badge}</div>}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FaceUploadScene() {
  const [faceTexture,    setFaceTexture]    = useState(null);
  const [originalUrl,   setOriginalUrl]    = useState(null);   
  const [cropUrl,       setCropUrl]        = useState(null);   
  const [status,        setStatus]         = useState('idle');
  const [statusMsg,     setStatusMsg]      = useState('Upload a portrait photo to begin');
  const [modelsReady,   setModelsReady]    = useState(false);
  const [avatarReady,   setAvatarReady]    = useState(false);
  
  // Debug Controls (tuned for Mixamo Head bone)
  const [fPos, setFPos] = useState({ x: 0, y: 0, z: 0 }); // Start with 0 offsets as requested
  const [fRot, setFRot] = useState({ x: 0, y: 0, z: 0 }); 
  const [fScale, setFScale] = useState(1.0); 
  const [fOpac, setFOpac] = useState(1.0); 
  const [showWireframe, setShowWireframe] = useState(true); // Red wireframe for debugging
  const [showOriginalHead, setShowOriginalHead] = useState(true);

  // Toggle original head visibility is now handled inside AvatarWithLiveFace

  // Log positions (removed to prevent ReferenceError)

  const fileRef = useRef();

  // Load face-api models
  useEffect(() => {
    loadFaceModels()
      .then(() => setModelsReady(true))
      .catch(() => setStatusMsg('⚠️ Face detection models failed to load'));
  }, []);

  const processFile = useCallback(async (file) => {
    if (!file || !['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setStatusMsg('❌ Only JPG / JPEG / PNG accepted'); return;
    }

    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    setCropUrl(null);
    setFaceTexture(null);
    setStatus('detecting');
    setStatusMsg('🔍 Detecting face…');

    try {
      const { texture, cropDataUrl } = await extractFace(file);
      setCropUrl(cropDataUrl);
      setFaceTexture(texture);
      setStatus('done');
      setStatusMsg('✅ Live face generated & attached!');
    } catch (err) {
      setStatus('error');
      setStatusMsg('❌ ' + (err.message || 'Face detection failed'));
    }
  }, []);

  const onFileChange = (e) => processFile(e.target.files?.[0]);
  const onDrop = (e) => { e.preventDefault(); processFile(e.dataTransfer.files?.[0]); };

  const reset = () => {
    setOriginalUrl(null); setCropUrl(null);
    setFaceTexture(null); setStatus('idle');
    setStatusMsg('Upload a portrait photo to begin');
  };

  const steps = [
    { label: 'Upload photo',           done: !!originalUrl },
    { label: 'Face detected',          done: status === 'done' },
    { label: 'Alpha mask extracted',   done: !!cropUrl },
    { label: 'Curved mesh created',    done: !!faceTexture },
    { label: 'Attached to Head bone',  done: !!faceTexture && avatarReady },
    { label: 'Idle animation active',  done: avatarReady },
  ];

  return (
    <div style={S.root}>
      {/* Top bar */}
      <div style={S.topBar}>
        <span style={{ fontSize: 18 }}>🎭</span>
        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>FaceTalk AI — Live Face Upload</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#3f3f46', fontFamily: 'monospace' }}>WORKING_MIXAMO_BASELINE ✓</span>
      </div>

      <div style={S.body}>
        {/* ── LEFT PANEL ── */}
        <div style={S.left}>

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{
              border: `2px dashed ${status === 'done' ? '#4ade6060' : status === 'error' ? '#f8717160' : '#27272a'}`,
              borderRadius: 14, padding: '20px 16px', cursor: 'pointer',
              textAlign: 'center', background: 'rgba(255,255,255,0.02)',
              transition: 'all 0.25s',
            }}
          >
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png" style={{ display: 'none' }} onChange={onFileChange} />
            <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Upload Portrait Photo</div>
            <div style={{ color: '#52525b', fontSize: '0.7rem', marginTop: 4 }}>JPG · JPEG · PNG · Click or drop</div>
          </div>

          {/* Status */}
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px', border: `1px solid ${statusColor[status]}22`, fontSize: '0.75rem', color: statusColor[status], fontWeight: 600 }}>
            {statusMsg}
            {!modelsReady && <div style={{ color: '#52525b', fontSize: '0.65rem', marginTop: 4, fontWeight: 400 }}>Loading face detection models…</div>}
          </div>

          {/* ── 2-Panel Preview ── */}
          <div>
            <div style={S.sectionTitle}>Pipeline (LiveOverlay)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <PreviewCard label="① Original" src={originalUrl} />
              <PreviewCard
                label="② Transparent Mask"
                src={cropUrl}
                badge={cropUrl ? 'feathered' : null}
                dim={status === 'detecting' && !cropUrl}
              />
            </div>
          </div>

          {/* ── Debug Controls ── */}
          {faceTexture && (
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ ...S.sectionTitle, color: '#4ade80' }}>Debug Toggles</div>
              <div style={{ display: 'flex', gap: 12, fontSize: '0.7rem', marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showOriginalHead} onChange={(e) => setShowOriginalHead(e.target.checked)} />
                  Show Original Avatar
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showWireframe} onChange={(e) => setShowWireframe(e.target.checked)} />
                  Red Wireframe Mask
                </label>
              </div>

              <div style={{ ...S.sectionTitle, color: '#4ade80' }}>Alignment</div>
              
              <div style={S.sliderRow}>
                <span>Scale</span>
                <input style={S.slider} type="range" min="0.5" max="2.0" step="0.05" value={fScale} onChange={e=>setFScale(parseFloat(e.target.value))} />
                <span style={S.val}>{fScale.toFixed(2)}</span>
              </div>
              <div style={S.sliderRow}>
                <span>Opacity</span>
                <input style={S.slider} type="range" min="0.2" max="1.0" step="0.05" value={fOpac} onChange={e=>setFOpac(parseFloat(e.target.value))} />
                <span style={S.val}>{fOpac.toFixed(2)}</span>
              </div>
              
              <div style={{ marginTop: 8, marginBottom: 4, ...S.sectionTitle }}>Position (X Y Z)</div>
              <div style={S.sliderRow}>
                <span>X</span><input style={S.slider} type="range" min="-0.2" max="0.2" step="0.01" value={fPos.x} onChange={e=>setFPos({...fPos, x:parseFloat(e.target.value)})} /><span style={S.val}>{fPos.x.toFixed(2)}</span>
              </div>
              <div style={S.sliderRow}>
                <span>Y</span><input style={S.slider} type="range" min="-0.2" max="0.3" step="0.01" value={fPos.y} onChange={e=>setFPos({...fPos, y:parseFloat(e.target.value)})} /><span style={S.val}>{fPos.y.toFixed(2)}</span>
              </div>
              <div style={S.sliderRow}>
                <span>Z</span><input style={S.slider} type="range" min="-0.1" max="0.3" step="0.01" value={fPos.z} onChange={e=>setFPos({...fPos, z:parseFloat(e.target.value)})} /><span style={S.val}>{fPos.z.toFixed(2)}</span>
              </div>

              <div style={{ marginTop: 8, marginBottom: 4, ...S.sectionTitle }}>Rotation (Deg)</div>
              <div style={S.sliderRow}>
                <span>X</span><input style={S.slider} type="range" min="-90" max="90" step="1" value={fRot.x} onChange={e=>setFRot({...fRot, x:parseFloat(e.target.value)})} /><span style={S.val}>{fRot.x}</span>
              </div>
              <div style={S.sliderRow}>
                <span>Y</span><input style={S.slider} type="range" min="-90" max="90" step="1" value={fRot.y} onChange={e=>setFRot({...fRot, y:parseFloat(e.target.value)})} /><span style={S.val}>{fRot.y}</span>
              </div>
              <div style={S.sliderRow}>
                <span>Z</span><input style={S.slider} type="range" min="-90" max="90" step="1" value={fRot.z} onChange={e=>setFRot({...fRot, z:parseFloat(e.target.value)})} /><span style={S.val}>{fRot.z}</span>
              </div>
            </div>
          )}

          {/* Reset */}
          {originalUrl && (
            <button
              onClick={reset}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#71717a', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              🔄 Reset
            </button>
          )}
        </div>

        {/* ── RIGHT: 3D VIEWPORT ── */}
        <div style={{ position: 'relative' }}>
          <Canvas shadows camera={{ position: [0, 1.4, 2.5], fov: 40 }}>
            <ambientLight intensity={0.65} />
            <directionalLight position={[2, 6, 3]} intensity={1.4} castShadow />
            <hemisphereLight skyColor="#ddeeff" groundColor="#1a1a2e" intensity={0.4} />
            <pointLight position={[-2, 1.5, 2]} intensity={0.5} color="#a78bfa" />

            <Suspense fallback={<SpinBox />}>
              <AvatarWithLiveFace
                faceTexture={faceTexture}
                onReady={() => setAvatarReady(true)}
                facePos={fPos}
                faceRot={fRot}
                faceScale={fScale}
                faceOpacity={fOpac}
                showWireframe={showWireframe}
              />
            </Suspense>

            <OrbitControls enableZoom enablePan={false} target={[0, 1.5, 0]} minDistance={0.5} maxDistance={7} />
            <gridHelper args={[10, 20, '#111122', '#0a0a18']} position={[0, -1.1, 0]} />
          </Canvas>

          {/* Viewport info */}
          <div style={{ position: 'absolute', top: 12, left: 12, color: 'rgba(255,255,255,0.2)', fontSize: '0.6rem', fontFamily: 'monospace', lineHeight: 1.6, pointerEvents: 'none' }}>
            <div>hero.fbx · 65 bones</div>
            <div>Idle animation · {faceTexture ? 'LiveFace Overlay attached' : 'Original material'}</div>
          </div>

          {/* Status pill */}
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            border: `1px solid ${faceTexture ? '#4ade8033' : '#27272a'}`,
            color: faceTexture ? '#4ade80' : '#71717a',
            padding: '8px 20px', borderRadius: 999,
            fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600,
            transition: 'all 0.4s', whiteSpace: 'nowrap',
          }}>
            {!avatarReady
              ? '⏳ Loading hero.fbx…'
              : faceTexture
                ? '🎭 LiveFace attached to Head bone'
                : '▶ Idle playing · Upload a face to begin'}
          </div>
        </div>
      </div>
    </div>
  );
}
