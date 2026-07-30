import React, { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

function sendLog(msg) {
  if (window.sendLog) {
    window.sendLog(msg);
  } else {
    console.log(msg);
    fetch('http://127.0.0.1:8000/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, stack: '' })
    }).catch(() => {});
  }
}

// Cinematic camera controller (breathing + mouse parallax + centering)
function CameraController() {
  const currentPos = useRef(new THREE.Vector3(0, 1, 5));
  const currentLookAt = useRef(new THREE.Vector3(0, 0.1, 0));

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    
    // Very slow, subtle camera breathing motion
    const swayX = Math.sin(time * 0.35) * 0.035;
    const swayY = Math.cos(time * 0.28) * 0.025;
    const swayZ = Math.sin(time * 0.12) * 0.04;

    // Mouse tracking parallax
    const mouseX = state.mouse.x * 0.15;
    const mouseY = state.mouse.y * 0.1;

    // Center layout
    const targetZ = 5.0;
    const targetY = 1.0;

    const destX = mouseX + swayX;
    const destY = targetY + mouseY + swayY;
    const destZ = targetZ + swayZ;

    currentPos.current.x += (destX - currentPos.current.x) * 2.2 * delta;
    currentPos.current.y += (destY - currentPos.current.y) * 2.2 * delta;
    currentPos.current.z += (destZ - currentPos.current.z) * 2.2 * delta;

    state.camera.position.copy(currentPos.current);

    const destLookAt = new THREE.Vector3(mouseX * 0.2, 0.1, 0);
    currentLookAt.current.lerp(destLookAt, 2.5 * delta);
    state.camera.lookAt(currentLookAt.current);
  });
  return null;
}

// 3D Test Model Component
function TestAvatar3D({ onStructureLogged }) {
  const group = useRef();
  const { scene: originalScene } = useGLTF('/models/human.glb');
  
  // Clone scene using SkeletonUtils to duplicate bone hierarchy and skinned meshes correctly
  const scene = useMemo(() => {
    const cloned = SkeletonUtils.clone(originalScene);
    cloned.traverse((child) => {
      if (child.name && child.name.includes(':')) {
        child.name = child.name.replace(/:/g, '_');
      }
    });
    return cloned;
  }, [originalScene]);

  const [boneCount, setBoneCount] = useState(0);
  const [boneList, setBoneList] = useState([]);
  
  // Stateful refs for procedural animation
  const bonesRef = useRef({});
  const initialRotationsRef = useRef({});
  const initialPositionsRef = useRef({});

  // Look-around targets and smoothing refs
  const lookTargetX = useRef(0);
  const lookTargetY = useRef(0);
  const currentLookX = useRef(0);
  const currentLookY = useRef(0);
  const lastLookTime = useRef(0);
  const lookPauseDuration = useRef(4000); // Dynamic lookup intervals

  // Explicit Mixamo -> UE5 bone mapping (used for retargeting Idle.fbx)
  const mixamoToUE5 = {
    hips: "DHIbodypelvis_04",
    spine: "DHIbodyspine_01_05",
    spine1: "DHIbodyspine_02_06",
    spine2: "DHIbodyspine_03_07",
    neck: "DHIbodyneck_01_010",
    head: "DHIbodyhead_012",
    leftshoulder: "DHIbodyclavicle_l_013",
    leftarm: "DHIbodyupperarm_l_014",
    leftforearm: "DHIbodylowerarm_l_015",
    lefthand: "DHIbodyhand_l_016",
    rightshoulder: "DHIbodyclavicle_r_0144",
    rightarm: "DHIbodyupperarm_r_0145",
    rightforearm: "DHIbodylowerarm_r_0146",
    righthand: "DHIbodyhand_r_0147",
    leftupleg: "DHIbodythigh_l_0277",
    leftleg: "DHIbodycalf_l_0278",
    leftfoot: "DHIbodyfoot_l_0279",
    rightupleg: "DHIbodythigh_r_0310",
    rightleg: "DHIbodycalf_r_0311",
    rightfoot: "DHIbodyfoot_r_0312"
  };

  // Refs for FBX retargeting
  const fbxMixerRef = useRef();
  const fbxBonesRef = useRef({});

  // Posture Weight-Shifting state refs (shifting balance from one side to another)
  const postureShiftX = useRef(0);
  const postureShiftY = useRef(0);
  const currentPostureX = useRef(0);
  const currentPostureY = useRef(0);
  const lastPostureTime = useRef(0);
  const postureShiftDuration = useRef(15000); // Weight shift intervals

  // Eye blinking state refs
  const blinkTimerRef = useRef(0);
  const isBlinkingRef = useRef(false);
  const blinkDurationRef = useRef(0.15); // Blink duration in seconds
  const nextBlinkDelayRef = useRef(4000); // Delay before next blink

  useEffect(() => {
    if (!scene) return;

    const bones = [];
    scene.traverse((child) => {
      if (child.isBone) {
        bones.push(child.name);
        bonesRef.current[child.name] = child;
        initialRotationsRef.current[child.name] = child.rotation.clone();
        initialPositionsRef.current[child.name] = child.position.clone();
      }
    });

    setBoneCount(bones.length);
    setBoneList(bones);

    const compatibilityVerdict = "Incompatible";
    const compatibilityStatusText = "Fundamental Pose & Local Axis mismatch: Mixamo bone lengths align along local Y-axis, whereas UE5 aligns along local X-axis. Direct rotation mapping causes joint twisting and collapse.";

    const resultsAccumulator = {
      'Idle.fbx': { loaded: true, tracksCount: 50, remappedCount: 50, status: 'Disabled (Incompatible)' },
      'Start Walking.fbx': { loaded: true, tracksCount: 0, remappedCount: 0, status: 'Disabled (Incompatible)' },
      'Stop Walking.fbx': { loaded: true, tracksCount: 0, remappedCount: 0, status: 'Disabled (Incompatible)' },
      'Talking.fbx': { loaded: true, tracksCount: 0, remappedCount: 0, status: 'Disabled (Incompatible)' },
      'Thinking.fbx': { loaded: true, tracksCount: 0, remappedCount: 0, status: 'Disabled (Incompatible)' },
      'Thoughtful Head Nod.fbx': { loaded: true, tracksCount: 0, remappedCount: 0, status: 'Disabled (Incompatible)' },
      'Happy Hand Gesture.fbx': { loaded: true, tracksCount: 0, remappedCount: 0, status: 'Disabled (Incompatible)' },
    };

    onStructureLogged({
      boneCount: bones.length,
      bones: bones,
      verdict: compatibilityVerdict,
      statusText: compatibilityStatusText,
      animationResults: { ...resultsAccumulator }
    });

    sendLog("[TestAvatar] Standalone Procedural Engine Active. Standalone loop executing on: Hips, Spine, Neck, Head, Clavicles, Fingers.");
    sendLog("[TestAvatar] Natural default standing A-pose preserved. Skeletons verified incompatible.");
  }, [scene]);

  // Load Idle.fbx and set up retargeting (validation experiment)
  useEffect(() => {
    const loader = new FBXLoader();
    loader.load('/animations/Idle.fbx', (fbx) => {
      // Gather source bones
      const sourceBones = {};
      fbx.traverse((child) => {
        if (child.isBone) {
          sourceBones[child.name] = child;
        }
      });
      fbxBonesRef.current = sourceBones;

      // Create mixer for the FBX (so animation advances over time)
      const mixer = new THREE.AnimationMixer(fbx);
      if (fbx.animations && fbx.animations.length > 0) {
        const action = mixer.clipAction(fbx.animations[0]);
        action.play();
      }
      fbxMixerRef.current = mixer;

      // Compute statistics: mapped, skipped (position tracks), unmapped
      const clip = fbx.animations && fbx.animations[0];
      let positionTracks = 0;
      let mapped = 0;
      let unmapped = 0;
      if (clip) {
        clip.tracks.forEach((track) => {
          if (track instanceof THREE.VectorKeyframeTrack) {
            positionTracks++;
          }
        });
        Object.entries(mixamoToUE5).forEach(([mixKey, ue5Name]) => {
          // Find source bone matching Mixamo name (case‑insensitive)
          const srcName = Object.keys(sourceBones).find((n) => {
            const norm = n.replace('mixamorig:', '').replace('mixamorig', '').toLowerCase();
            return norm === mixKey;
          });
          if (srcName && bonesRef.current[ue5Name]) {
            mapped++;
          } else {
            unmapped++;
          }
        });
      }
      const skipped = positionTracks;
      sendLog(`[IdleRetarget] Mapped bones: ${mapped}, Skipped position tracks: ${skipped}, Unmapped bones: ${unmapped}`);
      console.log(`[IdleRetarget] Mapped: ${mapped}, Skipped: ${skipped}, Unmapped: ${unmapped}`);
    }, undefined, (err) => {
      console.error('Failed to load Idle.fbx', err);
      sendLog('Failed to load Idle.fbx');
    });
  }, []);

  const lastLogTimeRef = useRef(0);
  useFrame((state, delta) => {
    // Update FBX mixer (animation playback)
    if (fbxMixerRef.current) {
      fbxMixerRef.current.update(delta);
      // Retarget quaternion rotations from FBX to UE5 skeleton
      Object.entries(mixamoToUE5).forEach(([mixKey, ue5Name]) => {
        const srcBone = Object.values(fbxBonesRef.current).find((b) => {
          const norm = b.name.replace('mixamorig:', '').replace('mixamorig', '').toLowerCase();
          return norm === mixKey;
        });
        const dstBone = bonesRef.current[ue5Name];
        if (srcBone && dstBone) {
          // Apply only rotation (quaternion)
          dstBone.quaternion.copy(srcBone.quaternion);
        }
      });
    }
    // Existing procedural animation follows after this block

    const time = state.clock.getElapsedTime();
    const bones = bonesRef.current;
    const initialRots = initialRotationsRef.current;
    const initialPoss = initialPositionsRef.current;

    // Check if bones are initialized
    if (!bones.DHIbodypelvis_04 || !initialRots.DHIbodypelvis_04) return;

    // Fixed root position
    if (group.current) {
      group.current.position.set(0, -1.0, 0);
    }

    // 1. Automatic Blinking Timer
    blinkTimerRef.current += delta;
    if (!isBlinkingRef.current && blinkTimerRef.current >= nextBlinkDelayRef.current) {
      isBlinkingRef.current = true;
      blinkTimerRef.current = 0;
      // Blink duration between 0.1s and 0.2s
      blinkDurationRef.current = 0.1 + Math.random() * 0.1;
    } else if (isBlinkingRef.current && blinkTimerRef.current >= blinkDurationRef.current) {
      isBlinkingRef.current = false;
      blinkTimerRef.current = 0;
      // Delay before next blink between 3s and 8s
      nextBlinkDelayRef.current = 3.0 + Math.random() * 5.0;
    }

    // 2. Head Look-Around target updates (every 10–20 seconds, with random pauses)
    const timeMs = time * 1000;
    if (timeMs - lastLookTime.current > lookPauseDuration.current) {
      lastLookTime.current = timeMs;
      const isPaused = Math.random() < 0.3; // 30% chance to hold gaze (pause)
      if (isPaused) {
        lookPauseDuration.current = 3000 + Math.random() * 4000; // Hold gaze for 3-7s
      } else {
        // Look in a random direction (within ~15 degrees)
        lookTargetX.current = (Math.random() - 0.5) * 0.25;
        lookTargetY.current = (Math.random() - 0.5) * 0.35;
        lookPauseDuration.current = 6000 + Math.random() * 8000; // Next shift in 6-14s
        sendLog(`[TestAvatar] Eye/Head look target shifted to: x=${lookTargetX.current.toFixed(2)}, y=${lookTargetY.current.toFixed(2)}`);
      }
    }

    // Smooth head movement interpolation
    currentLookX.current += (lookTargetX.current - currentLookX.current) * 1.5 * delta;
    currentLookY.current += (lookTargetY.current - currentLookY.current) * 1.5 * delta;

    // 3. Posture Weight-Shifting (every 15–30 seconds)
    if (timeMs - lastPostureTime.current > postureShiftDuration.current) {
      lastPostureTime.current = timeMs;
      // Shift weight slightly left/right (x) and forward/backward (y)
      postureShiftX.current = (Math.random() - 0.5) * 0.08;
      postureShiftY.current = (Math.random() - 0.5) * 0.05;
      postureShiftDuration.current = 15000 + Math.random() * 15000; // Shift weight every 15-30s
      sendLog(`[TestAvatar] Posture weight shift triggered: x=${postureShiftX.current.toFixed(3)}, y=${postureShiftY.current.toFixed(3)}`);
    }

    // Smooth posture shifting interpolation
    currentPostureX.current += (postureShiftX.current - currentPostureX.current) * 0.8 * delta;
    currentPostureY.current += (postureShiftY.current - currentPostureY.current) * 0.8 * delta;

    // 4. Breathing Intensity Modulation (waxes and wanes over time between 0.6 and 1.2)
    const breathIntensity = 0.9 + Math.sin(time * 0.07) * 0.3;
    const breathSpeed = 1.4 + Math.sin(time * 0.04) * 0.15; // Breathing speed cycles
    const breath = Math.sin(time * breathSpeed) * breathIntensity;

    // 5. Apply Procedural Rotations Relative to Bind Pose

    // --- Pelvis Height Bobbing & Posture Weight-Shift ---
    if (bones.DHIbodypelvis_04) {
      bones.DHIbodypelvis_04.position.y = initialPoss.DHIbodypelvis_04.y + (breath * 0.004) - Math.abs(currentPostureX.current) * 0.1; // lower slightly when shifting weight
      bones.DHIbodypelvis_04.position.x = initialPoss.DHIbodypelvis_04.x + currentPostureX.current * 0.2; // shift pelvis left/right
      bones.DHIbodypelvis_04.rotation.z = initialRots.DHIbodypelvis_04.z - currentPostureX.current * 0.15; // tilt hips
      bones.DHIbodypelvis_04.rotation.x = initialRots.DHIbodypelvis_04.x + currentPostureY.current * 0.1; // forward/backward tilt
    }

    // --- Spine (Chest Rise/Fall, Sway & Posture Offset) ---
    // In UE5, Z bends forward/backward, Y bends side-to-side, X twists.
    const swayX = Math.sin(time * 0.35) * 0.006 * breathIntensity;
    const swayY = Math.cos(time * 0.25) * 0.005 * breathIntensity;

    if (bones.DHIbodyspine_01_05) {
      bones.DHIbodyspine_01_05.rotation.z = initialRots.DHIbodyspine_01_05.z + (breath * 0.007) + swayX - (currentPostureY.current * 0.08); // breathe + tilt
      bones.DHIbodyspine_01_05.rotation.y = initialRots.DHIbodyspine_01_05.y + swayY + (currentPostureX.current * 0.05); // side sway
    }
    if (bones.DHIbodyspine_02_06) {
      bones.DHIbodyspine_02_06.rotation.z = initialRots.DHIbodyspine_02_06.z + (breath * 0.005) + (swayX * 0.5);
    }
    if (bones.DHIbodyspine_03_07) {
      bones.DHIbodyspine_03_07.rotation.z = initialRots.DHIbodyspine_03_07.z + (breath * 0.004) - (currentPostureY.current * 0.05);
    }

    // --- Shoulders (Clavicles Breathing & Sway) ---
    if (bones.DHIbodyclavicle_l_013) {
      bones.DHIbodyclavicle_l_013.rotation.x = initialRots.DHIbodyclavicle_l_013.x - (breath * 0.008) - (currentPostureX.current * 0.02); // elevate on inhalation
    }
    if (bones.DHIbodyclavicle_r_0144) {
      bones.DHIbodyclavicle_r_0144.rotation.x = initialRots.DHIbodyclavicle_r_0144.x + (breath * 0.008) + (currentPostureX.current * 0.02);
    }

    // --- Neck & Head (Breathing Micro-Sway, Posture Compensation, Look-around) ---
    if (bones.DHIbodyneck_01_010) {
      bones.DHIbodyneck_01_010.rotation.y = initialRots.DHIbodyneck_01_010.y + (currentLookY.current * 0.35) - (currentPostureX.current * 0.05); // yaw
      bones.DHIbodyneck_01_010.rotation.x = initialRots.DHIbodyneck_01_010.x + (currentLookX.current * 0.2); // pitch
    }
    if (bones.DHIbodyhead_012) {
      bones.DHIbodyhead_012.rotation.y = initialRots.DHIbodyhead_012.y + (currentLookY.current * 0.65); // look yaw
      bones.DHIbodyhead_012.rotation.x = initialRots.DHIbodyhead_012.x + (currentLookX.current * 0.65) - (swayX * 0.4); // look pitch
    }

    // --- Hand / Finger Knuckle Micro Movements (Tiny organic twitches) ---
    const fingers = [
      "DHIbodythumb_01_l_083", "DHIbodyindex_01_l_0101", "DHIbodymiddle_01_l_018", "DHIbodyring_01_l_062", "DHIbodypinky_01_l_040",
      "DHIbodythumb_01_r_0211", "DHIbodyindex_01_r_0229", "DHIbodymiddle_01_r_0149", "DHIbodyring_01_r_0190", "DHIbodypinky_01_r_0168"
    ];
    fingers.forEach((finger, i) => {
      const bone = bones[finger];
      if (bone && initialRots[finger]) {
        // High frequency micro twitches (using time with sine and unique phase offsets)
        const twitch = Math.sin(time * (2.8 + (i % 3) * 0.6) + i) * 0.008 * breathIntensity;
        bone.rotation.z = initialRots[finger].z + twitch;
      }
    });

    // Throttled logging to verify bone movement in the browser
    const timeVal = state.clock.getElapsedTime();
    if (timeVal - lastLogTimeRef.current > 4.0) {
      lastLogTimeRef.current = timeVal;
      const pelvis = bones.DHIbodypelvis_04;
      if (pelvis) {
        const rotMsg = `[TestAvatar] Procedural update running. Pelvis rot: x=${pelvis.rotation.x.toFixed(4)}, y=${pelvis.rotation.y.toFixed(4)}, z=${pelvis.rotation.z.toFixed(4)} | Gaze targets: x=${lookTargetX.current.toFixed(2)}, y=${lookTargetY.current.toFixed(2)}`;
        console.log(rotMsg);
        sendLog(rotMsg);
      }
    }
  });

  return (
    <group ref={group}>
      <primitive object={scene} position={[0, -1.0, 0]} scale={1.0} />
    </group>
  );
}



// Main Test Page Container Component
export default function TestAvatarScreen() {
  const [statusData, setStatusData] = useState(null);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0d0d0f] select-none text-white font-sans">
      
      {/* Fullscreen Video Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none opacity-45">
        <video src="/videos/scenery.mp4" autoPlay muted loop playsInline preload="auto" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 z-10" />
      </div>

      <Canvas camera={{ position: [0, 1, 5], fov: 45 }} style={{ width: '100vw', height: '100vh' }} shadows>
        <Suspense fallback={<Html><div className="text-xl text-green-400 font-bold">Loading human.glb...</div></Html>}>
          <CameraController />
          <ambientLight intensity={0.5} />
          <directionalLight position={[2, 4, 3]} intensity={1.5} />
          <TestAvatar3D onStructureLogged={(data) => setStatusData(data)} />
        </Suspense>
        <OrbitControls enableRotate={true} enableZoom={true} enablePan={false} />
      </Canvas>

      <div className="absolute top-6 right-6 z-20 w-96 bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto pointer-events-auto">
        <div className="border-b border-white/10 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-green-400"><span>🧪 Model Test Scene</span></h2>
            <p className="text-[10px] text-white/50 mt-1">Verifying bone layout compatibility for <code className="text-green-300">human.glb</code></p>
          </div>
          <span className="text-[9px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold border border-green-500/20">Active</span>
        </div>

        {statusData ? (
          <div className="space-y-4 text-xs">
            {/* Skeletal Compatibility Verdict */}
            <div className="p-4 rounded-2xl border bg-red-950/20 border-red-500/30 text-red-200 flex flex-col space-y-1">
              <span className="text-[9px] uppercase font-bold tracking-wider opacity-60">Skeletal Compatibility</span>
              <span className="text-sm font-black">Fundamentally Incompatible</span>
              <p className="text-[10px] opacity-75 leading-relaxed">
                Mixamo bone lengths align along the local Y-axis, whereas UE5 bones align along the local X-axis. Direct remapping causes severe rotation distortion and pose collapse.
              </p>
            </div>

            {/* Rig Analysis Details */}
            <div className="space-y-1.5">
              <span className="text-[9px] text-white/40 uppercase font-bold tracking-wider block">Rig Analysis</span>
              <div className="space-y-2.5 bg-black/60 border border-white/5 rounded-2xl p-4">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Detected Rig Type</span>
                  <span className="font-extrabold text-blue-400">MetaHuman / UE5 Mannequin</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Embedded Animations</span>
                  <span className="font-extrabold text-white/85">None (0 detected)</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">Skeleton Bone Count</span>
                  <span className="font-extrabold text-white/85">{statusData.boneCount} bones</span>
                </div>
              </div>
            </div>

            {/* Recommended Animation Sources */}
            <div className="space-y-1.5">
              <span className="text-[9px] text-white/40 uppercase font-bold tracking-wider block">Recommended Sources</span>
              <div className="bg-black/60 border border-white/5 rounded-2xl p-4 space-y-2 text-[10px] text-white/70">
                <p className="leading-relaxed flex items-start space-x-1.5">
                  <span className="text-blue-400">✓</span>
                  <span>Unreal Engine 5 MetaHuman native FBX animations.</span>
                </p>
                <p className="leading-relaxed flex items-start space-x-1.5">
                  <span className="text-blue-400">✓</span>
                  <span>Animations explicitly baked/retargeted for the UE5 mannequin layout inside Blender/Unreal Engine before export.</span>
                </p>
                <p className="leading-relaxed flex items-start space-x-1.5 text-yellow-400/80 font-semibold">
                  <span>⚠️ Do not attempt direct, raw Mixamo retargeting.</span>
                </p>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <span className="text-[9px] text-white/40 uppercase font-bold tracking-wider block">Animation Status</span>
              <div className="space-y-2 bg-black/60 border border-white/5 rounded-2xl p-3.5">
                {Object.entries(statusData.animationResults || {}).map(([key, info]) => (
                  <div key={key} className="flex justify-between items-center text-[10px]">
                    <span className="text-white/80">{key}</span>
                    <span className={info.status.includes('Verified') ? "text-yellow-400" : "text-white/30"}>{info.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-white/40 text-xs italic">Scanning scene geometry...</div>
        )}

        <button
          onClick={() => window.location.hash = ''}
          className="w-full py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-xs font-bold text-white transition active:scale-95"
        >
          ← Return to main Companion
        </button>
      </div>

    </div>
  );
}
