import React, { useRef, useEffect, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';

// ── log helper ────────────────────────────────────────────────────────────────
function log(msg) {
  console.log('[Mixamo]', msg);
  if (!window.appLogs) window.appLogs = [];
  window.appLogs.push(msg);
  window.dispatchEvent(new Event('app_log_updated'));
  fetch('http://127.0.0.1:8000/log-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg, stack: '' })
  }).catch(() => {});
}

// Strip Mixamo namespace prefix — handles ALL formats:
//   "mixamorig:Hips"  → "Hips"
//   "mixamorig1:Hips" → "Hips"
//   "mixamorig_Hips"  → "Hips"
function stripMixamoPrefix(name) {
  if (!name) return name;
  // If there's a colon, take everything AFTER the last colon
  if (name.includes(':')) return name.split(':').pop();
  // Otherwise strip any mixamorig[digits]_ prefix
  return name.replace(/^mixamorig\d*[_]?/i, '');
}

// ── inner 3D scene (runs inside Canvas) ───────────────────────────────────────
function MixamoScene({ onStatus }) {
  // 1. Load character
  const rawModel = useLoader(FBXLoader, '/models/hero.fbx');

  // 2. Clone + normalize bone names on the character skeleton
  const model = useMemo(() => {
    const cloned = SkeletonUtils.clone(rawModel);
    cloned.traverse((child) => {
      if (child.name) child.name = stripMixamoPrefix(child.name);
    });
    return cloned;
  }, [rawModel]);

  const mixerRef = useRef(null);
  const [animations, setAnimations] = useState(null); // null = still loading

  // 3. Inspect skeleton immediately after model is ready
  useEffect(() => {
    if (!model) return;

    const bones = [];
    model.traverse((child) => { if (child.isBone) bones.push(child.name); });

    log(`✅ Character loaded`);
    log(`🦴 Skeleton bone count: ${bones.length}`);
    log(`📋 First 20 bones: ${bones.slice(0, 20).join(', ')}`);
    onStatus(`Character ready — ${bones.length} bones`);
  }, [model]);

  // 4. Load all animation FBX files manually (not via useLoader so we can batch)
  useEffect(() => {
    const animCfgs = [
      { key: 'idle',         url: '/animations/Idle.fbx' },
      { key: 'talking',      url: '/animations/Talking.fbx' },
      { key: 'thinking',     url: '/animations/Thinking.fbx' },
      { key: 'startWalking', url: '/animations/Start Walking.fbx' },
      { key: 'stopWalking',  url: '/animations/Stop Walking.fbx' },
    ];

    const loader = new FBXLoader();
    const loaded = {};
    let pending = animCfgs.length;

    animCfgs.forEach(({ key, url }) => {
      loader.load(
        url,
        (fbx) => {
          if (fbx.animations?.length > 0) {
            const clip = fbx.animations[0].clone();
            clip.name = key;

            // ── KEY FIX: strip namespace from every track name ──
            // e.g. "mixamorig:Hips.position" → "Hips.position"
            clip.tracks.forEach((track) => {
              track.name = track.name.replace(/mixamorig[_:]?/gi, '');
            });

            // Report stats
            const animBones = new Set(clip.tracks.map((t) => t.name.split('.')[0]));
            log(`🎬 Animation loaded: ${key}`);
            log(`   Track count: ${clip.tracks.length}`);
            log(`   Unique bones in animation: ${animBones.size}`);
            loaded[key] = clip;
          } else {
            log(`⚠️ No animation tracks in ${url}`);
          }
          pending--;
          if (pending === 0) setAnimations({ ...loaded });
        },
        undefined,
        (err) => {
          log(`❌ Failed to load ${url}: ${err.message || err}`);
          pending--;
          if (pending === 0) setAnimations({ ...loaded });
        }
      );
    });
  }, []);

  // 5. Compare + play once both model AND animations are ready
  useEffect(() => {
    if (!model || !animations) return;

    // Collect model bone names
    const modelBoneSet = new Set();
    model.traverse((child) => { if (child.isBone) modelBoneSet.add(child.name); });

    // Compare idle animation bones vs character bones
    const idleClip = animations.idle;
    if (!idleClip) { log('❌ Idle clip not found!'); return; }

    const animBones = [...new Set(idleClip.tracks.map((t) => t.name.split('.')[0]))];
    const matching = animBones.filter((b) => modelBoneSet.has(b));
    const missing  = animBones.filter((b) => !modelBoneSet.has(b));

    log(`🔍 Idle animation bone comparison:`);
    log(`   Matching bones: ${matching.length}`);
    log(`   Missing bones:  ${missing.length}${missing.length > 0 ? ' → ' + missing.slice(0, 5).join(', ') : ''}`);

    if (matching.length === 0) {
      log('❌ No bones matched — animation will not play. Check bone naming.');
      onStatus('ERROR: bone mismatch');
      return;
    }

    // 6. Create AnimationMixer and play idle
    log(`🎛️ Creating AnimationMixer…`);
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;

    const idleAction = mixer.clipAction(idleClip);
    idleAction.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    log(`▶️ Idle loaded`);
    log(`▶️ Idle playing`);
    onStatus('▶ IDLE playing');

    // 7. After idle runs for 7 s, auto-test Talking
    const t1 = setTimeout(() => {
      const talkClip = animations.talking;
      if (!talkClip) { log('⚠️ Talking clip not found'); return; }

      mixer.stopAllAction();
      const talkAction = mixer.clipAction(talkClip);
      talkAction.reset().setLoop(THREE.LoopOnce, 1);
      talkAction.clampWhenFinished = true;
      talkAction.play();
      log(`▶️ Talking loaded`);
      log(`▶️ Talking playing`);
      onStatus('▶ TALKING playing');

      const onTalkEnd = (e) => {
        if (e.action.getClip().name !== 'talking') return;
        mixer.removeEventListener('finished', onTalkEnd);

        // 8. Auto-test Thinking after Talking ends
        const thinkClip = animations.thinking;
        if (!thinkClip) { log('⚠️ Thinking clip not found'); return; }

        mixer.stopAllAction();
        const thinkAction = mixer.clipAction(thinkClip);
        thinkAction.reset().setLoop(THREE.LoopOnce, 1);
        thinkAction.clampWhenFinished = true;
        thinkAction.play();
        log(`▶️ Thinking loaded`);
        log(`▶️ Thinking playing`);
        onStatus('▶ THINKING playing');

        // After thinking, loop back to idle
        const onThinkEnd = (e2) => {
          if (e2.action.getClip().name !== 'thinking') return;
          mixer.removeEventListener('finished', onThinkEnd);
          mixer.stopAllAction();
          const backToIdle = mixer.clipAction(idleClip);
          backToIdle.reset().setLoop(THREE.LoopRepeat, Infinity).play();
          log(`🔁 Looping back to idle`);
          onStatus('▶ IDLE looping');
        };
        mixer.addEventListener('finished', onThinkEnd);
      };
      mixer.addEventListener('finished', onTalkEnd);
    }, 7000);

    return () => {
      clearTimeout(t1);
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
    };
  }, [model, animations]);

  // 9. Advance mixer every frame
  useFrame((_, delta) => { mixerRef.current?.update(delta); });

  return (
    <primitive object={model} position={[0, -1.1, 0]} scale={0.01} />
  );
}

// ── loading placeholder ───────────────────────────────────────────────────────
function LoadingCube() {
  const ref = useRef();
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d; });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.6, 0.6, 0.6]} />
      <meshStandardMaterial color="#4f46e5" wireframe />
    </mesh>
  );
}

// ── main exported component ───────────────────────────────────────────────────
export default function MixamoTestScene() {
  const [status, setStatus] = useState('Loading hero.fbx…');

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', position: 'relative' }}>

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 1.6, 3.5], fov: 50 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 8, 4]} intensity={1.5} castShadow />
        <hemisphereLight skyColor="#ddeeff" groundColor="#222" intensity={0.5} />

        <Suspense fallback={<LoadingCube />}>
          <MixamoScene onStatus={setStatus} />
        </Suspense>

        <OrbitControls
          enableZoom
          enablePan={false}
          target={[0, 0.5, 0]}
          minDistance={1.5}
          maxDistance={8}
        />
        <gridHelper args={[10, 20, '#2a2a2a', '#1a1a1a']} position={[0, -1.1, 0]} />
      </Canvas>

      {/* Status badge */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.85)',
        border: '1px solid rgba(0,255,136,0.3)',
        color: '#00ff88',
        padding: '10px 24px',
        borderRadius: '999px',
        fontSize: '0.8rem',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        letterSpacing: '0.05em',
        zIndex: 100,
        backdropFilter: 'blur(8px)',
      }}>
        {status}
      </div>

      {/* Hint */}
      <div style={{
        position: 'fixed',
        top: 12,
        right: 16,
        color: 'rgba(255,255,255,0.25)',
        fontSize: '0.65rem',
        fontFamily: 'monospace',
        zIndex: 100,
      }}>
        Drag to orbit · Scroll to zoom
      </div>
    </div>
  );
}
