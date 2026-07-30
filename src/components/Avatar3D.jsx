import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useLoader, createPortal } from '@react-three/fiber';
import { useGLTF, Decal } from '@react-three/drei';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';



// Drei Decal component is completely disabled to bypass dynamic skinned mesh parent resolution limitations.
// We use the PlaneGeometry overlay system which is 100% reliable and tracks bone movement in real-time.

// Helper function to send logs back to the FastAPI backend terminal and browser overlay
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

// Helper function to retarget FBX animation tracks to GLTF bone names dynamically
function retargetClip(clip, scene) {
  const gltfBones = [];
  scene.traverse((child) => {
    if (child.isBone) {
      gltfBones.push(child.name);
    }
  });

  const normalize = (name) => {
    return name.replace(/mixamorig/gi, '')
               .replace(/[:_\-\s]/g, '')
               .toLowerCase();
  };

  clip.tracks.forEach((track) => {
    // Sanitize any colons in track name to match our renamed GLTF bones
    let trackName = track.name.replace(/:/g, '_');
    const trackParts = trackName.split('.');
    let trackBoneName = trackParts[0];

    // Find the bone name inside brackets or path
    const bracketMatch = trackBoneName.match(/\[([^\]]+)\]/);
    let leafTrackBoneName = "";
    if (bracketMatch) {
      leafTrackBoneName = bracketMatch[1];
    } else {
      const pathParts = trackBoneName.split('/');
      leafTrackBoneName = pathParts[pathParts.length - 1];
    }

    const cleanTrackName = normalize(leafTrackBoneName);

    const matchingGLTFBone = gltfBones.find((gltfBone) => {
      const leafGLTFBone = gltfBone.split(/[:_]/).pop();
      return normalize(leafGLTFBone) === cleanTrackName || normalize(gltfBone) === cleanTrackName;
    });

    if (matchingGLTFBone) {
      // Bind directly to the node name for maximum PropertyBinding reliability in Three.js
      track.name = matchingGLTFBone + '.' + trackParts.slice(1).join('.');
    } else {
      track.name = trackName;
    }

    // Scale Mixamo position tracks (in cm) down by 0.01 to match GLB coordinates (in meters)
    if (track.name.endsWith('.position')) {
      for (let i = 0; i < track.values.length; i++) {
        track.values[i] *= 0.01;
      }
    }
  });

  return clip;
}

export default function Avatar3D({
  isSpeaking,
  isListening,
  isThinking,
  mouthOpenAmount,
  blinkAmount = 0,
  faceTexture,
  uploadedFaceInfo,
  gesture,
  outfit,
  fPos = { x: 0, y: 0, z: 0 },
  fScale = 1.0,
  fCurve = 120,
  showFaceMesh = true,
  showWireframe = false
}) {
  const group = useRef();
  const bonesRef = useRef({});
  const initialRotationsRef = useRef({});
  const initialPositionsRef = useRef({});
  const mixerRef = useRef(null);
  const activeActionRef = useRef(null);
  const lastLogTimeRef = useRef(0);

  const noseHelperRef = useRef();
  const leftEyeHelperRef = useRef();
  const rightEyeHelperRef = useRef();
  const mouthHelperRef = useRef();
  const debugSphereRef = useRef();
  const debugPlaneRef = useRef();

  const [animations, setAnimations] = useState({});
  const [playGesture, setPlayGesture] = useState(null);
  const [outfitSpin, setOutfitSpin] = useState(0);
  const [currentActiveName, setCurrentActiveName] = useState(null);
  const [headMesh, setHeadMesh] = useState(null);

  // Load local pre-rigged ARKit-compatible GLB model
  const { scene: originalScene } = useGLTF('/models/default-avatar.glb');

  // Clone scene using SkeletonUtils to bind skinned meshes to cloned bone hierarchy correctly
  const scene = useMemo(() => {
    if (!originalScene) return null;
    sendLog("[Avatar3D] Cloning GLTF scene using SkeletonUtils...");
    const cloned = SkeletonUtils.clone(originalScene);
    // Sanitize node names: Replace ':' with '_' to prevent Three.js PropertyBinding colon-parsing errors
    cloned.traverse((child) => {
      if (child.name && child.name.includes(':')) {
        child.name = child.name.replace(/:/g, '_');
      }
    });
    return cloned;
  }, [originalScene]);

  // 1. Traverse and catalog bones on mount
  useEffect(() => {
    if (!scene) return;
    const initialRotations = {};
    const initialPositions = {};
    const gltfBonesList = [];
    const allNodesLog = [];
    
    scene.traverse((child) => {
      allNodesLog.push(`${child.name} (${child.type || 'unknown'})`);
      
      // Find head skinned mesh for face swapping
      if (child.isSkinnedMesh && (child.name.toLowerCase().includes('head') || child.name.toLowerCase().includes('face') || child.name.toLowerCase().includes('avatar'))) {
        setHeadMesh(child);
      }

      const isMixamoBone = child.isBone || child.type === 'Bone' || child.name.toLowerCase().includes('mixamorig');
      
      if (isMixamoBone) {
        gltfBonesList.push(child.name);
        
        // Catalog bone by its short name (e.g. Head, Hips, etc.)
        let boneKey = child.name;
        if (child.name.includes('_')) {
          const parts = child.name.split('_');
          boneKey = parts[parts.length - 1];
        } else if (child.name.includes(':')) {
          const parts = child.name.split(':');
          boneKey = parts[parts.length - 1];
        } else {
          // Fallback: strip mixamorig prefix case-insensitively
          boneKey = child.name.replace(/mixamorig/gi, '');
        }

        bonesRef.current[boneKey] = child;
        initialRotations[boneKey] = child.rotation.clone();
        initialPositions[boneKey] = child.position.clone();
      }
    });
    
    initialRotationsRef.current = initialRotations;
    initialPositionsRef.current = initialPositions;

    const allNodesMsg = `[Avatar3D] All scene nodes: ${allNodesLog.slice(0, 15).join(', ')}...`;
    console.log(allNodesMsg);
    sendLog(allNodesMsg);

    const boneNamesMsg = `[Avatar3D] GLB Total Bone count: ${gltfBonesList.length} | Cataloged: ${Object.keys(bonesRef.current).join(', ')}`;
    console.log(boneNamesMsg);
    sendLog(boneNamesMsg);

    // Initialize animation mixer
    mixerRef.current = new THREE.AnimationMixer(scene);

    // Load Mixamo FBX animations in background
    const fbxLoader = new FBXLoader();
    const animationConfigs = [
      { key: 'idle', url: '/animations/Idle.fbx' },
      { key: 'talking', url: '/animations/Talking.fbx' },
      { key: 'thinking', url: '/animations/Thinking.fbx' },
      { key: 'nod', url: '/animations/Thoughtful Head Nod.fbx' },
      { key: 'happy', url: '/animations/Happy Hand Gesture.fbx' }
    ];

    animationConfigs.forEach((cfg) => {
      fbxLoader.load(
        cfg.url,
        (fbx) => {
          if (fbx.animations && fbx.animations.length > 0) {
            let clip = fbx.animations[0].clone();
            clip.name = cfg.key;
            
            const originalTracks = clip.tracks.map(t => t.name);
            clip = retargetClip(clip, scene);
            const remappedTracks = clip.tracks.map(t => t.name);
            
            const trackMsg = `[Avatar3D] "${cfg.key}" tracks count: ${clip.tracks.length} | Original: ${originalTracks.slice(0, 1).join('')}... | Remapped: ${remappedTracks.slice(0, 1).join('')}...`;
            console.log(trackMsg);
            sendLog(trackMsg);
            
            setAnimations((prev) => ({ ...prev, [cfg.key]: clip }));
            console.log(`[Avatar3D] Loaded and retargeted animation: ${cfg.key}`);
          }
        },
        undefined,
        (err) => {
          const errMsg = `[Avatar3D] FBX Animation "${cfg.key}" failed to load from ${cfg.url}: ${err.message || err}`;
          console.warn(errMsg);
          sendLog(errMsg);
        }
      );
    });

    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }
    };
  }, [scene]);

  // 2. Listen for finished events to clean up one-off gestures
  useEffect(() => {
    if (!mixerRef.current) return;

    const handleFinished = (e) => {
      const finishedClipName = e.action.getClip().name;
      console.log(`[Avatar3D] Animation finished: ${finishedClipName}`);
      if (finishedClipName === 'nod' || finishedClipName === 'happy' || finishedClipName === gesture) {
        setPlayGesture(null);
      }
    };

    mixerRef.current.addEventListener('finished', handleFinished);
    return () => {
      if (mixerRef.current) {
        mixerRef.current.removeEventListener('finished', handleFinished);
      }
    };
  }, [animations, gesture]);

  // 3. Randomly trigger nod or happy sways when idle (every 10–20 seconds)
  useEffect(() => {
    if (Object.keys(animations).length === 0) return;

    let timeoutId = null;

    const scheduleNextGesture = () => {
      // Random delay between 10 and 20 seconds
      const delay = 10000 + Math.random() * 10000;
      
      timeoutId = setTimeout(() => {
        const isCurrentlyIdle = !isSpeaking && !isListening && !isThinking && !gesture && !playGesture;
        if (isCurrentlyIdle) {
          const randomGesture = Math.random() < 0.5 ? 'nod' : 'happy';
          console.log(`[Avatar3D] Idle timeout triggered, playing random gesture: ${randomGesture}`);
          setPlayGesture(randomGesture);
        }
        scheduleNextGesture();
      }, delay);
    };

    scheduleNextGesture();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isSpeaking, isListening, isThinking, gesture, playGesture, animations]);

  // 4. Smoothly crossfade between actions
  const fadeToAction = (targetActionName, duration = 0.5) => {
    const targetClip = animations[targetActionName];
    if (!targetClip || !mixerRef.current) return;

    const nextAction = mixerRef.current.clipAction(targetClip);
    const currentAction = activeActionRef.current;

    console.log(`[Avatar3D] Playing action: ${targetActionName}`);

    if (currentAction === nextAction) {
      if (!nextAction.isRunning()) {
        nextAction.play();
      }
      return;
    }

    // Configure loop and clamp rules for gestures vs states
    if (targetActionName === 'nod' || targetActionName === 'happy') {
      nextAction.loop = THREE.LoopOnce;
      nextAction.clampWhenFinished = true;
    } else {
      nextAction.loop = THREE.LoopRepeat;
    }

    nextAction.reset();
    nextAction.play();

    if (currentAction) {
      currentAction.crossFadeTo(nextAction, duration, true);
    } else {
      nextAction.fadeIn(duration);
    }

    activeActionRef.current = nextAction;
    setCurrentActiveName(targetActionName);
  };

  // 5. Play animations depending on current state updates
  useEffect(() => {
    if (Object.keys(animations).length === 0) {
      console.log("[Avatar3D] No animations loaded yet, waiting...");
      return;
    }

    let target = 'idle';

    if (isThinking) {
      target = 'thinking';
    } else if (isSpeaking) {
      target = 'talking';
    } else if (gesture && animations[gesture]) {
      target = gesture;
    } else if (playGesture && animations[playGesture]) {
      target = playGesture;
    } else {
      target = 'idle';
    }

    if (!animations[target]) {
      target = 'idle';
    }

    console.log(`[Avatar3D] State changed. Target animation: ${target}`);
    fadeToAction(target, 0.4);
  }, [isSpeaking, isListening, isThinking, gesture, playGesture, animations]);

  // 1. Apply customized PBR materials and shader-based face mapping on Alpha_Surface & Alpha_Joints
  useEffect(() => {
    if (!scene) return;
    let headBoneIndex = 5; // default fallback for mixamorigHead
    scene.traverse((child) => {
      if (child.isBone && child.name.toLowerCase().includes('head')) {
        // Find skeleton index of the head bone if possible
        scene.traverse((meshChild) => {
          if (meshChild.isMesh && meshChild.skeleton) {
            const idx = meshChild.skeleton.bones.findIndex(b => b.name === child.name);
            if (idx !== -1) {
              headBoneIndex = idx;
            }
          }
        });
      }
    });

    scene.traverse((child) => {
      if (child.isMesh) {
        const name = child.name.toLowerCase();
        
        // Ensure the mesh blocks light properly
        child.castShadow = true;
        child.receiveShadow = true;

        // Temporarily hide hair, glasses, headwear, beard accessories to inspect face replacement
        if (name.includes('hair') || name.includes('glasses') || name.includes('headwear') || name.includes('beard')) {
          child.visible = false;
        }

        if (child.name === 'Alpha_Surface' || child.name === 'Alpha_Joints') {
          // Improve existing material quality for cinematic lighting
          // Do not override with faceTexture (Face Swap disabled per supervisor)
          if (child.material) {
            child.material.roughness = 0.5; // Slightly smoother skin/fabric
            child.material.metalness = 0.1; // Slight ambient response
            child.material.envMapIntensity = 0.8;
            child.material.needsUpdate = true;
          }
        }

        if (child.name === 'Alpha_Joints') {
          // Upgrade robotic joints to glossy cyan neon PBR metal
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#121212'), // black joints
            roughness: 0.15,
            metalness: 0.9,
            emissive: new THREE.Color('#00e5ff'), // glowing neon cyan
            emissiveIntensity: 1.8
          });
          child.material.needsUpdate = true;
        }

        // Tune eyes for wetness/gloss sheen
        if (name.includes('eye')) {
          if (child.material) {
            child.material.roughness = 0.12;
            child.material.metalness = 0.15;
            child.material.side = THREE.FrontSide;
            child.material.needsUpdate = true;
          }
        }

        // Force mouth interior to be completely dark and unlit to prevent the fireplace from glowing inside the head
        if (name.includes('teeth') || name.includes('mouth') || name.includes('tongue')) {
          child.material = new THREE.MeshBasicMaterial({ color: 0x050505 });
          child.material.needsUpdate = true;
        }
      }
    });
  }, [faceTexture, scene]);

  // 2. Native 3D Morph Target Blinking Cycle Effect
  useEffect(() => {
    if (!headMesh || !headMesh.morphTargetDictionary || !headMesh.morphTargetInfluences) return;

    let timeoutId = null;
    const blinkLeftIdx = headMesh.morphTargetDictionary['eyeBlinkLeft'];
    const blinkRightIdx = headMesh.morphTargetDictionary['eyeBlinkRight'];

    // Fallback if morph targets aren't named exactly
    if (blinkLeftIdx === undefined || blinkRightIdx === undefined) {
      console.warn("[Avatar3D] Blinking morph targets not found on head mesh.");
      return;
    }

    const runBlinkCycle = () => {
      const nextBlinkDelay = 3000 + Math.random() * 4000; // blink every 3-7 seconds
      
      timeoutId = setTimeout(() => {
        // Blink eyes closed
        headMesh.morphTargetInfluences[blinkLeftIdx] = 1.0;
        headMesh.morphTargetInfluences[blinkRightIdx] = 1.0;
        
        // Eyelids open after 150ms
        setTimeout(() => {
          headMesh.morphTargetInfluences[blinkLeftIdx] = 0.0;
          headMesh.morphTargetInfluences[blinkRightIdx] = 0.0;
          runBlinkCycle();
        }, 150);
        
      }, nextBlinkDelay);
    };

    runBlinkCycle();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      // Ensure eyes are open on unmount
      if (headMesh && headMesh.morphTargetInfluences) {
        if (blinkLeftIdx !== undefined) headMesh.morphTargetInfluences[blinkLeftIdx] = 0.0;
        if (blinkRightIdx !== undefined) headMesh.morphTargetInfluences[blinkRightIdx] = 0.0;
      }
    };
  }, [headMesh]);

  // Dynamic bone updates & fallback loops
  useFrame((state, delta) => {
    const bones = bonesRef.current;
    const initialRots = initialRotationsRef.current;
    const initialPoss = initialPositionsRef.current;

    // Reset bones to base poses before running the mixer and adding offsets to prevent infinite accumulation
    if (bones && initialRots && initialPoss) {
      Object.entries(bones).forEach(([name, b]) => {
        if (initialRots[name]) {
          b.rotation.copy(initialRots[name]);
        }
        if (initialPoss[name]) {
          b.position.copy(initialPoss[name]);
        }
      });
    }

    // 1. Update Mixer if FBX animations exist
    const hasFBX = Object.keys(animations).length > 0;
    if (hasFBX && mixerRef.current) {
      mixerRef.current.update(delta);
    }

    // 2. Play Outfit spin animation
    if (outfitSpin > 0) {
      const step = delta * 8;
      setOutfitSpin((prev) => Math.max(0, prev - step));
      if (group.current) {
        group.current.rotation.y = outfitSpin;
      }
    } else if (group.current) {
      group.current.rotation.y = 0;
    }

    // 3. Procedural Breathing & Random Idle Micro-Motions (applied on top of animations for lifelike realism)
    if (bones) {
      const time = state.clock.getElapsedTime();
      
      // Gentle Breathing (subtle sinusoidal offsets)
      if (bones.Spine) {
        bones.Spine.rotation.x += Math.sin(time * 1.5) * 0.015;
      }
      if (bones.Spine1) {
        bones.Spine1.rotation.x += Math.sin(time * 1.5) * 0.01;
      }
      if (bones.Hips) {
        bones.Hips.position.y += Math.sin(time * 1.5) * 0.005;
      }

      // Looking around/Micro-motions (Random idle motions) + Gentle Mouse Tracking
      if (bones.Head) {
        // Subtle mouse tracking
        const mouseX = state.pointer.x * 0.2; 
        const mouseY = state.pointer.y * -0.15;

        // Slow organic wandering sways
        const swayX = Math.sin(time * 0.35) * 0.04 + Math.cos(time * 0.11) * 0.015;
        const swayY = Math.cos(time * 0.25) * 0.045 + Math.sin(time * 0.08) * 0.02;
        const swayZ = Math.sin(time * 0.18) * 0.015;
        
        bones.Head.rotation.x += swayX + mouseY;
        bones.Head.rotation.y += swayY + mouseX;
        bones.Head.rotation.z += swayZ;
      }
      if (bones.Neck) {
        // Neck slightly follows head
        bones.Neck.rotation.y += Math.cos(time * 0.25) * 0.02 + (state.pointer.x * 0.05);
      }
    }

    // 4. Procedural Fallback bone rotation loop (if FBX files are missing)
    if (!hasFBX) {
      const time = state.clock.getElapsedTime();

      // Reset bones before applying offsets
      Object.entries(bones).forEach(([name, b]) => {
        if (initialRots[name]) {
          b.rotation.copy(initialRots[name]);
        }
        if (initialPoss[name]) {
          b.position.copy(initialPoss[name]);
        }
      });

      // --- BREATHING ---
      if (bones.Spine && initialRots.Spine) {
        bones.Spine.rotation.x = initialRots.Spine.x + Math.sin(time * 1.6) * 0.022; // breathing expansion
      }
      if (bones.Spine1 && initialRots.Spine1) {
        bones.Spine1.rotation.x = initialRots.Spine1.x + Math.sin(time * 1.6) * 0.012;
      }
      if (bones.Hips && initialPoss.Hips) {
        bones.Hips.position.y = initialPoss.Hips.y + Math.sin(time * 1.6) * 0.008; // subtle breathing bob
      }

      // --- IDLE HEAD SWAYS ---
      if (bones.Head && initialRots.Head) {
        bones.Head.rotation.y = initialRots.Head.y + Math.sin(time * 0.45) * 0.08;
        bones.Head.rotation.x = initialRots.Head.x + Math.cos(time * 0.35) * 0.04;
      }

      // --- GESTURES OR SPEECH SLANTED ROTATIONS ---
      if (gesture && gesture !== 'idle') {
        // Apply procedural math positions for specific actions
        if (gesture === 'wave' && bones.RightArm && bones.RightForeArm && initialRots.RightArm && initialRots.RightForeArm) {
          bones.RightArm.rotation.z = initialRots.RightArm.z + 1.35; // raise arm
          bones.RightArm.rotation.x = initialRots.RightArm.x - 0.3;
          bones.RightForeArm.rotation.y = initialRots.RightForeArm.y + Math.sin(time * 12) * 0.35; // wave hand
        } 
        else if (gesture === 'clap' && bones.RightArm && bones.LeftArm && initialRots.RightArm && initialRots.LeftArm) {
          bones.RightArm.rotation.z = initialRots.RightArm.z + 0.55;
          bones.LeftArm.rotation.z = initialRots.LeftArm.z - 0.55;
          bones.RightArm.rotation.y = initialRots.RightArm.y - 0.2 - Math.abs(Math.sin(time * 14)) * 0.25;
          bones.LeftArm.rotation.y = initialRots.LeftArm.y + 0.2 + Math.abs(Math.sin(time * 14)) * 0.25;
        } 
        else if (gesture === 'thinking' && bones.RightArm && bones.RightForeArm && bones.Head && initialRots.RightArm && initialRots.RightForeArm && initialRots.Head) {
          bones.RightArm.rotation.z = initialRots.RightArm.z + 0.95;
          bones.RightForeArm.rotation.y = initialRots.RightForeArm.y + 1.15; // hand to head
          bones.Head.rotation.x = initialRots.Head.x + 0.12;
          bones.Head.rotation.z = initialRots.Head.z + 0.08;
        } 
        else if (gesture === 'laugh' && bones.Head && bones.Spine && initialRots.Head && initialRots.Spine) {
          bones.Head.rotation.x = initialRots.Head.x - 0.18; // tilt back
          bones.Spine.rotation.y = initialRots.Spine.y + Math.sin(time * 24) * 0.022; // shake shoulders
        }
      } 
      else if (isSpeaking) {
        // Procedural speaking gesture
        if (bones.RightArm && initialRots.RightArm) {
          bones.RightArm.rotation.z = initialRots.RightArm.z + 0.3 + Math.cos(time * 3.5) * 0.12;
          bones.RightArm.rotation.x = initialRots.RightArm.x - 0.2;
        }
        if (bones.LeftArm && initialRots.LeftArm) {
          bones.LeftArm.rotation.z = initialRots.LeftArm.z - 0.3 + Math.sin(time * 3.0) * 0.12;
          bones.LeftArm.rotation.x = initialRots.LeftArm.x - 0.2;
        }
        if (bones.RightForeArm && initialRots.RightForeArm) {
          bones.RightForeArm.rotation.y = initialRots.RightForeArm.y + 0.4 + Math.sin(time * 4) * 0.25;
        }
        if (bones.Head && initialRots.Head) {
          bones.Head.rotation.x = initialRots.Head.x + Math.sin(time * 7) * 0.025; // talking nod sways
        }
      } 
      else if (isListening) {
        // Listening nods
        if (bones.Head && initialRots.Head) {
          bones.Head.rotation.x = initialRots.Head.x + 0.06 + Math.sin(time * 2.2) * 0.035; // slow understanding nod
        }
      }
    }

    // 4. Lip Sync Mouth & Eye Morph Target Driving (Every Frame)
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh && child.morphTargetDictionary) {
          const dict = child.morphTargetDictionary;
          const inf = child.morphTargetInfluences;

          // Drive a single primary mouth morph target to prevent compound stretching
          // Prioritize standard jaw/mouth targets
          const jawIdx = dict['jawOpen'] || dict['viseme_aa'] || dict['mouthOpen'] || dict['Mouth_Open'];
          
          if (jawIdx !== undefined) {
            // Apply smoothed audio volume directly to the jaw/mouth
            inf[jawIdx] = Math.min(1.0, mouthOpenAmount * 1.3);
          }
          
          // Ensure mouthClose target doesn't fight the jaw open
          const closeIdx = dict['mouthClose'];
          if (closeIdx !== undefined) {
            inf[closeIdx] = 0;
          }

          // Drive standard ReadyPlayerMe eye blink morph targets
          const blinkLeftIdx = dict['eyeBlinkLeft'] || dict['EyeBlinkLeft'] || dict['eyeBlink_L'] || dict['eyesClosed'];
          const blinkRightIdx = dict['eyeBlinkRight'] || dict['EyeBlinkRight'] || dict['eyeBlink_R'] || dict['eyesClosed'];

          if (blinkLeftIdx !== undefined) {
            inf[blinkLeftIdx] = blinkAmount;
          }
          if (blinkRightIdx !== undefined) {
            inf[blinkRightIdx] = blinkAmount;
          }
        }
      });
    }

    // Track and update 3D helper positions matching the head movement dynamically
    if (bonesRef.current.Head) {
      const tempV = new THREE.Vector3();
      
      if (noseHelperRef.current) {
        tempV.set(0, 0.10, 0.095).applyMatrix4(bonesRef.current.Head.matrixWorld);
        noseHelperRef.current.position.copy(tempV);
      }
      if (leftEyeHelperRef.current) {
        tempV.set(-0.032, 0.135, 0.075).applyMatrix4(bonesRef.current.Head.matrixWorld);
        leftEyeHelperRef.current.position.copy(tempV);
      }
      if (rightEyeHelperRef.current) {
        tempV.set(0.032, 0.135, 0.075).applyMatrix4(bonesRef.current.Head.matrixWorld);
        rightEyeHelperRef.current.position.copy(tempV);
      }
      if (mouthHelperRef.current) {
        tempV.set(0, 0.065, 0.088).applyMatrix4(bonesRef.current.Head.matrixWorld);
        mouthHelperRef.current.position.copy(tempV);
      }
      const headBone = bonesRef.current.Head;
      const headWP = new THREE.Vector3();
      headBone.getWorldPosition(headWP);
      
      const planeWP = new THREE.Vector3();
      
      if (debugPlaneRef.current) {
        // Position directly on the face by applying headBone's matrixWorld to fPos offsets (with minor Z push to prevent Z-fighting)
        const targetLocal = new THREE.Vector3(fPos.x, fPos.y, fPos.z + 0.003);
        targetLocal.applyMatrix4(headBone.matrixWorld);
        debugPlaneRef.current.position.copy(targetLocal);
        
        const tempQ = new THREE.Quaternion();
        headBone.getWorldQuaternion(tempQ);
        debugPlaneRef.current.quaternion.copy(tempQ);
        debugPlaneRef.current.getWorldPosition(planeWP);
      }

      // Print exact world positions and attachment verification throttled to 1-second intervals
      const timeVal = state.clock.getElapsedTime();
      if (!state.lastFrameLogTime) state.lastFrameLogTime = 0;
      if (timeVal - state.lastFrameLogTime > 1.0) {
        state.lastFrameLogTime = timeVal;
        sendLog(`[FRAME TELEMETRY] headBone: [${headWP.x.toFixed(4)}, ${headWP.y.toFixed(4)}, ${headWP.z.toFixed(4)}] | faceOverlayPlane: [${planeWP.x.toFixed(4)}, ${planeWP.y.toFixed(4)}, ${planeWP.z.toFixed(4)}]`);
        sendLog(`[FRAME ATTACH] scene.add(faceOverlayPlane): ${!!debugPlaneRef.current}`);
      }
    }

    // Throttle logging to once every 5 seconds to confirm bones are moving
    const timeVal = state.clock.getElapsedTime();
    if (timeVal - lastLogTimeRef.current > 5.0) {
      lastLogTimeRef.current = timeVal;
      const statusMsg = `[Avatar3D] Current active action: ${currentActiveName || 'none'}`;
      console.log(statusMsg);
      sendLog(statusMsg);
      if (bonesRef.current.Head) {
        const headBone = bonesRef.current.Head;
        const headWP = new THREE.Vector3();
        headBone.getWorldPosition(headWP);
        const headRotMsg = `[Avatar3D] Head bone: World Pos(x=${headWP.x.toFixed(3)}, y=${headWP.y.toFixed(3)}, z=${headWP.z.toFixed(3)}) | Rot(x=${headBone.rotation.x.toFixed(4)}, y=${headBone.rotation.y.toFixed(4)}, z=${headBone.rotation.z.toFixed(4)})`;
        console.log(headRotMsg);
        sendLog(headRotMsg);

        // Local offsets
        const noseLoc = { x: 0, y: 0.10, z: 0.095 };
        const leftEyeLoc = { x: -0.032, y: 0.135, z: 0.075 };
        const rightEyeLoc = { x: 0.032, y: 0.135, z: 0.075 };
        const mouthLoc = { x: 0, y: 0.065, z: 0.088 };

        // Compute 3D World Positions of facial features
        const noseWorld = new THREE.Vector3(noseLoc.x, noseLoc.y, noseLoc.z).applyMatrix4(headBone.matrixWorld);
        const leftEyeWorld = new THREE.Vector3(leftEyeLoc.x, leftEyeLoc.y, leftEyeLoc.z).applyMatrix4(headBone.matrixWorld);
        const rightEyeWorld = new THREE.Vector3(rightEyeLoc.x, rightEyeLoc.y, rightEyeLoc.z).applyMatrix4(headBone.matrixWorld);
        const mouthWorld = new THREE.Vector3(mouthLoc.x, mouthLoc.y, mouthLoc.z).applyMatrix4(headBone.matrixWorld);
        
        // Compute midpoint between eyes, and center of face (eyes, nose, mouth)
        const eyeMidpointWorld = new THREE.Vector3().addVectors(leftEyeWorld, rightEyeWorld).multiplyScalar(0.5);
        const faceCenterWorld = new THREE.Vector3()
          .add(eyeMidpointWorld)
          .add(noseWorld)
          .add(mouthWorld)
          .multiplyScalar(1.0 / 3.0);

        const decalScaleVal = fScale * 0.12;
        const decalScaleXYZ = [decalScaleVal * 0.8, decalScaleVal, decalScaleVal * 0.05];
        
        const featuresMsg = `[Avatar3D] Feature 3D Telemetry (Local Offset / World Coordinate):\n` + 
          `  - Nose Tip: Local(x=${noseLoc.x.toFixed(3)}, y=${noseLoc.y.toFixed(3)}, z=${noseLoc.z.toFixed(3)}) -> World(x=${noseWorld.x.toFixed(3)}, y=${noseWorld.y.toFixed(3)}, z=${noseWorld.z.toFixed(3)})\n` +
          `  - Left Eye Center: Local(x=${leftEyeLoc.x.toFixed(3)}, y=${leftEyeLoc.y.toFixed(3)}, z=${leftEyeLoc.z.toFixed(3)}) -> World(x=${leftEyeWorld.x.toFixed(3)}, y=${leftEyeWorld.y.toFixed(3)}, z=${leftEyeWorld.z.toFixed(3)})\n` +
          `  - Right Eye Center: Local(x=${rightEyeLoc.x.toFixed(3)}, y=${rightEyeLoc.y.toFixed(3)}, z=${rightEyeLoc.z.toFixed(3)}) -> World(x=${rightEyeWorld.x.toFixed(3)}, y=${rightEyeWorld.y.toFixed(3)}, z=${rightEyeWorld.z.toFixed(3)})\n` +
          `  - Eye Midpoint: World(x=${eyeMidpointWorld.x.toFixed(3)}, y=${eyeMidpointWorld.y.toFixed(3)}, z=${eyeMidpointWorld.z.toFixed(3)})\n` +
          `  - Mouth Center: Local(x=${mouthLoc.x.toFixed(3)}, y=${mouthLoc.y.toFixed(3)}, z=${mouthLoc.z.toFixed(3)}) -> World(x=${mouthWorld.x.toFixed(3)}, y=${mouthWorld.y.toFixed(3)}, z=${mouthWorld.z.toFixed(3)})\n` +
          `  - Computed Face Center: World(x=${faceCenterWorld.x.toFixed(3)}, y=${faceCenterWorld.y.toFixed(3)}, z=${faceCenterWorld.z.toFixed(3)})\n` +
          `  - Decal Position (World offset applied): x=${(headWP.x + fPos.x).toFixed(3)}, y=${(headWP.y + fPos.y).toFixed(3)}, z=${(headWP.z + fPos.z).toFixed(3)}\n` +
          `  - Decal Rotation: x=${headBone.rotation.x.toFixed(4)}, y=${headBone.rotation.y.toFixed(4)}, z=${headBone.rotation.z.toFixed(4)}\n` +
          `  - Decal Scale: [x=${decalScaleXYZ[0].toFixed(4)}, y=${decalScaleXYZ[1].toFixed(4)}, z=${decalScaleXYZ[2].toFixed(4)}]`;
        console.log(featuresMsg);
        sendLog(featuresMsg);
      }
    }
  });

  // Helper to align, scale, crop and blend user face directly into Wolf3D_Head's diffuse map
  const applyUserFaceToAvatar = (photoImg, landmarks, mesh) => {
    if (!mesh || !mesh.material) return null;
    const originalTex = mesh.userData.originalMap || mesh.material.map;
    if (!originalTex || !originalTex.image) {
      console.warn('[Avatar3D] Original head texture map or image is missing.');
      return null;
    }
    
    const w = photoImg.naturalWidth || photoImg.width;
    const h = photoImg.naturalHeight || photoImg.height;

    const lm159 = landmarks[159]; // left eye center
    const lm386 = landmarks[386]; // right eye center
    const lm152 = landmarks[152]; // chin
    
    if (!lm159 || !lm386 || !lm152) {
      console.warn('[Avatar3D] Required landmarks 159, 386, or 152 are missing.');
      return null;
    }

    const x_s1 = lm159.x * w;
    const y_s1 = lm159.y * h;
    const x_s2 = lm386.x * w;
    const y_s2 = lm386.y * h;
    const x_chin = lm152.x * w;
    const y_chin = lm152.y * h;

    // 1. Source eye midpoint and angle in flipped coordinate space
    const x_s1_f = w - x_s1;
    const x_s2_f = w - x_s2;
    const cx_s = (x_s1_f + x_s2_f) / 2;
    const cy_s = (y_s1 + y_s2) / 2;
    
    const dx_s_eye = x_s2_f - x_s1_f;
    const dy_s_eye = y_s2 - y_s1;
    const angle = Math.atan2(dy_s_eye, dx_s_eye);

    // 2. Compute non-uniform horizontal scale factor (matching target eye distance of 185px)
    const sourceEyeDist = Math.sqrt(dx_s_eye * dx_s_eye + dy_s_eye * dy_s_eye);
    const targetEyeDist = 605 - 420; // 185
    const scaleX = sourceEyeDist > 0 ? targetEyeDist / sourceEyeDist : 1.0;

    // 3. Compute non-uniform vertical scale factor (matching target eye-to-chin distance of 295px)
    const x_chin_f = w - x_chin;
    const dx_chin = x_chin_f - cx_s;
    const dy_chin = y_chin - cy_s;
    const sourceEyeToChin = dx_chin * (-Math.sin(angle)) + dy_chin * Math.cos(angle);
    const targetEyeToChin = 600 - 305; // 295
    const scaleY = sourceEyeToChin > 0 ? targetEyeToChin / sourceEyeToChin : scaleX;

    // 4. Construct transformation matrix representing: rotation + non-uniform scale + reflection + translation
    const theta = -angle;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    const m11 = -scaleX * cos;
    const m21 = -scaleX * sin;
    const dx = 512.5 - (m11 * ((x_s1 + x_s2) / 2) + m21 * cy_s);

    const m12 = -scaleY * sin;
    const m22 = scaleY * cos;
    const dy = 305 - (m12 * ((x_s1 + x_s2) / 2) + m22 * cy_s);

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Draw original head texture background (preserves hair, neck, ears, skin texture)
    ctx.drawImage(originalTex.image, 0, 0, 1024, 1024);

    sendLog(`[DEBUG DRAWIMAGE] Drawing photoImg: width=${w}, height=${h} | scaleX=${scaleX.toFixed(3)}, scaleY=${scaleY.toFixed(3)}`);

    // Render transformed face on a separate layer (applying non-uniform transform)
    const faceCan = document.createElement('canvas');
    faceCan.width = 1024;
    faceCan.height = 1024;
    const faceCtx = faceCan.getContext('2d');
    faceCtx.save();
    faceCtx.setTransform(m11, m12, m21, m22, dx, dy);
    // Apply brightness/contrast filter and desaturation to balance lighting and blend tones
    console.log('Applying brightness/saturation filter');
    sendLog('Applying brightness/saturation filter');
    faceCtx.filter = 'brightness(1.05) contrast(1.0) saturate(0.9)';
    faceCtx.drawImage(photoImg, 0, 0);
    faceCtx.restore();

    // Render soft, feathered elliptical mask centered on face region
    const maskCan = document.createElement('canvas');
    maskCan.width = 1024;
    maskCan.height = 1024;
    const maskCtx = maskCan.getContext('2d');
    
    // Egg/oval shape: narrower at the top, wider at the cheeks
    maskCtx.fillStyle = 'rgba(0, 0, 0, 1.0)';
    maskCtx.beginPath();
    maskCtx.ellipse(512, 420, 220, 260, 0, 0, Math.PI * 2);
    maskCtx.fill();

    // Cut out the eye socket regions so the avatar's 3D eyeball meshes render cleanly without 2D overlap
    maskCtx.globalCompositeOperation = 'destination-out';
    
    // Left eye cutout (target centered at x=420, y=305)
    maskCtx.beginPath();
    maskCtx.ellipse(420, 305, 22, 14, 0, 0, Math.PI * 2);
    maskCtx.fill();

    // Right eye cutout (target centered at x=605, y=305)
    maskCtx.beginPath();
    maskCtx.ellipse(605, 305, 22, 14, 0, 0, Math.PI * 2);
    maskCtx.fill();

    // Reset composite operation to standard
    maskCtx.globalCompositeOperation = 'source-over';

    // Apply a 25px blur filter to the mask for ultra-smooth edge blending
    const blurCan = document.createElement('canvas');
    blurCan.width = 1024;
    blurCan.height = 1024;
    const blurCtx = blurCan.getContext('2d');
    blurCtx.filter = 'blur(25px)';
    blurCtx.drawImage(maskCan, 0, 0);

    // Composite/blend the face with the feathered mask
    const blendedFaceCan = document.createElement('canvas');
    blendedFaceCan.width = 1024;
    blendedFaceCan.height = 1024;
    const bFaceCtx = blendedFaceCan.getContext('2d');
    bFaceCtx.drawImage(faceCan, 0, 0);
    bFaceCtx.globalCompositeOperation = 'destination-in';
    bFaceCtx.drawImage(blurCan, 0, 0);

    // Draw the blended face overlay back onto the main canvas
    ctx.drawImage(blendedFaceCan, 0, 0);

    // Get pixel values at key coordinates to confirm color data is present
    const pCenter = ctx.getImageData(512, 300, 1, 1).data;
    const pCorner = ctx.getImageData(50, 50, 1, 1).data;
    const pLeftEye = ctx.getImageData(420, 305, 1, 1).data;
    const pRightEye = ctx.getImageData(605, 305, 1, 1).data;
    
    sendLog(`[DEBUG PIXELS] Center (512,300): [R=${pCenter[0]}, G=${pCenter[1]}, B=${pCenter[2]}, A=${pCenter[3]}]`);
    sendLog(`[DEBUG PIXELS] Corner (50,50): [R=${pCorner[0]}, G=${pCorner[1]}, B=${pCorner[2]}, A=${pCorner[3]}]`);
    sendLog(`[DEBUG PIXELS] Left Eye (420,305): [R=${pLeftEye[0]}, G=${pLeftEye[1]}, B=${pLeftEye[2]}, A=${pLeftEye[3]}]`);
    sendLog(`[DEBUG PIXELS] Right Eye (605,305): [R=${pRightEye[0]}, G=${pRightEye[1]}, B=${pRightEye[2]}, A=${pRightEye[3]}]`);

    // 6. Create CanvasTexture matching GLTF UV mapping (flipY=false)
    const newTex = new THREE.CanvasTexture(canvas);
    newTex.flipY = false;
    newTex.colorSpace = THREE.SRGBColorSpace;
    newTex.needsUpdate = true;

    mesh.material.map = newTex;
    mesh.material.color.setHex(0xffffff); // explicitly ensure color is white so texture is not tinted dark
    mesh.material.needsUpdate = true;

    sendLog(`[Avatar3D] Applied user face texture. Material: color=${mesh.material.color.getHexString()}, roughness=${mesh.material.roughness}, metalness=${mesh.material.metalness}`);
    return newTex;
  };

  // Manage head texture (applying face overlay directly or restoring base texture)
  useEffect(() => {
    if (!headMesh) return;
    
    // Save original diffuse map on mount
    if (headMesh.material && !headMesh.userData.originalMap) {
      headMesh.userData.originalMap = headMesh.material.map;
    }
    
    if (uploadedFaceInfo) {
      const { img, landmarks } = uploadedFaceInfo;
      try {
        applyUserFaceToAvatar(img, landmarks, headMesh);
      } catch (err) {
        console.error('[Avatar3D] Error applying face to avatar texture:', err);
      }
    } else {
      // Explicitly restore original mapping if no custom uploaded face is set
      if (headMesh.material && headMesh.userData.originalMap) {
        headMesh.material.map = headMesh.userData.originalMap;
        headMesh.material.color.setHex(0xffffff);
        headMesh.material.needsUpdate = true;
        console.log('[Avatar3D] Restored original head texture map.');
      }
    }
  }, [headMesh, uploadedFaceInfo]);

  return (
    <group ref={group}>
      <primitive
        object={scene}
        position={[0, -1.0, 0]}
        scale={1.0}
        rotation={[0, 0, 0]}
      />

      {/* 3D Facial Feature Landmark Helpers - Hidden permanently as per supervisor request */}
      {/* 
      {!uploadedFaceInfo && (
        <>
          <mesh ref={noseHelperRef}>
            <sphereGeometry args={[0.005, 8, 8]} />
            <meshBasicMaterial color="#ff3333" depthTest={false} transparent opacity={0.9} />
          </mesh>
          <mesh ref={leftEyeHelperRef}>
            <sphereGeometry args={[0.005, 8, 8]} />
            <meshBasicMaterial color="#3333ff" depthTest={false} transparent opacity={0.9} />
          </mesh>
          <mesh ref={rightEyeHelperRef}>
            <sphereGeometry args={[0.005, 8, 8]} />
            <meshBasicMaterial color="#3333ff" depthTest={false} transparent opacity={0.9} />
          </mesh>
          <mesh ref={mouthHelperRef}>
            <sphereGeometry args={[0.005, 8, 8]} />
            <meshBasicMaterial color="#33ff33" depthTest={false} transparent opacity={0.9} />
          </mesh>
        </>
      )}
      */}

    </group>
  );
}
