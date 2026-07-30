/**
 * PROBLEM 4 — CHARACTER HAS NO LIFE
 * Parametric animation mathematical engines for 60fps joint transforms.
 */

export function evaluateJoints(state, time) {
  const joints = {
    // Body weight sways (left-to-right every 8 seconds)
    bodyX: Math.sin(time * (Math.PI / 4)) * 12,
    bodyY: 0,
    bodyScaleY: 1 + Math.sin(time * (Math.PI / 2)) * 0.004, // Breathing (torso scale every 4s)
    bodyScaleX: 1 + Math.sin(time * (Math.PI / 2)) * 0.002,
    
    // Head drifts (±2px micro-movement)
    headX: Math.cos(time * 2.5) * 1.5,
    headY: Math.sin(time * 3) * 1.5 - 400, // Anchored relative to body center
    headAngle: Math.sin(time * 0.8) * 0.02, // slight head tilt
    
    // Wind / Hair sway
    hairSway: Math.sin(time * 1.8) * 0.05,
    
    // Clothing offsets (±1px subtle clothing drifts)
    clothingOffset: Math.cos(time * 4) * 0.8,
    
    // Joints
    leftArmAngle: Math.PI / 8,  // standard resting splay
    rightArmAngle: -Math.PI / 8,
    leftHandY: 0,
    rightHandY: 0,
    leftLegAngle: 0,
    rightLegAngle: 0,
    leftFootY: 0,
    rightFootY: 0,
    
    // Expressions
    eyeBlinkScaleY: 1.0,
    eyebrowRaiseY: 0,
    smileScale: 0
  };

  // 1. Continuous blinking timing check
  if (state.isBlinking) {
    // sin curve from 0 to PI over blink duration
    const progress = (state.blinkTime / 0.15) * Math.PI; // 150ms blink
    joints.eyeBlinkScaleY = Math.max(0.05, Math.abs(Math.cos(progress)));
  }

  // 2. Active Mode overrides
  if (state.gestureMode === "listening") {
    // Lean forward, nod head, eyebrows raise, hand to chin
    joints.bodyScaleY = 1.02;
    joints.bodyY = -8;
    joints.headAngle += Math.sin(time * (Math.PI / 1.5)) * 0.08; // Node sways every 3s
    joints.eyebrowRaiseY = -3;
    joints.smileScale = 0.1;
    
    // Left hand to chin pose
    joints.leftArmAngle = -Math.PI * 0.55; 
    joints.leftHandY = -230;
  } 
  else if (state.gestureMode === "speaking") {
    // Wave left arm, tilt head, eyebrow raises
    joints.headAngle += Math.sin(time * 2) * 0.06;
    joints.eyebrowRaiseY = -2 + Math.sin(time * 3) * 2;
    joints.smileScale = 0.25 + Math.sin(time) * 0.1;
    
    // Gestures wave back and forth
    joints.rightArmAngle = -Math.PI / 4 + Math.sin(time * 4) * 0.25; // sways waving
    joints.leftArmAngle = Math.PI / 6 + Math.cos(time * 2.5) * 0.15;
  }

  // 3. Random Idles execution
  if (state.activeIdle && state.idleProgress < 1.0) {
    const t = state.idleProgress; // normalized 0 to 1
    const sway = Math.sin(t * Math.PI); // ease in/out curve

    switch (state.activeIdle) {
      case "scratchHead":
        // Right hand raises to scratch head area
        joints.rightArmAngle = -Math.PI * 0.72 * sway;
        joints.rightHandY = -240 * sway;
        joints.headAngle += Math.sin(t * Math.PI * 4) * 0.04 * sway;
        break;
      case "lookAround":
        // Eye and head sways left then right
        joints.headAngle += Math.sin(t * Math.PI * 2) * 0.15;
        break;
      case "checkWatch":
        // Left wrist rises up
        joints.leftArmAngle = -Math.PI * 0.45 * sway;
        joints.leftHandY = -150 * sway;
        break;
      case "yawn":
        // Torso slumps slightly, shoulders rise
        joints.bodyScaleY = (1 - 0.015 * sway) * joints.bodyScaleY;
        joints.bodyY = 4 * sway;
        break;
      case "stretchArms":
        // Both arms extend wide
        joints.leftArmAngle = (Math.PI * 0.45) * sway;
        joints.rightArmAngle = (-Math.PI * 0.45) * sway;
        break;
      case "footTap":
        // Foot bounces rapidly
        joints.rightFootY = -5 * Math.abs(Math.sin(t * Math.PI * 6));
        break;
      case "sigh":
        // Shoulders rise and fall
        joints.bodyY = -6 * sway;
        break;
    }
  }

  return joints;
}

/**
 * Procedurally updates the timers and ticks
 */
export function updateAnimationState(state, delta) {
  // Update blink timer
  state.blinkTimer += delta;
  if (state.isBlinking) {
    state.blinkTime += delta;
    if (state.blinkTime >= 0.15) {
      state.isBlinking = false;
      state.blinkTimer = 0;
    }
  } else if (state.blinkTimer >= state.nextBlinkInterval) {
    state.isBlinking = true;
    state.blinkTime = 0;
    state.nextBlinkInterval = 3 + Math.random() * 2; // every 3-5 seconds
  }

  // Update random idle triggers
  state.idleTimer += delta;
  if (state.activeIdle) {
    state.idleProgress += delta / state.idleDuration;
    if (state.idleProgress >= 1.0) {
      state.activeIdle = null;
      state.idleTimer = 0;
      state.nextIdleInterval = 8 + Math.random() * 12; // every 8-20 seconds
    }
  } else if (state.idleTimer >= state.nextIdleInterval) {
    const idles = ["scratchHead", "lookAround", "checkWatch", "yawn", "stretchArms", "footTap", "sigh"];
    state.activeIdle = idles[Math.floor(Math.random() * idles.length)];
    state.idleProgress = 0;
    state.idleDuration = state.activeIdle === "yawn" || state.activeIdle === "stretchArms" ? 3.0 : 1.8;
  }
}
