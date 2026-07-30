# WORKING_MIXAMO_BASELINE

> **This document records the locked, verified working state of the Mixamo animation pipeline.**  
> **DO NOT modify the avatar, skeleton, or animation system without reverting to this baseline first.**

---

## Verified Working State

| Feature | Status |
|---|---|
| Mixamo character loads (`hero.fbx`) | ✅ |
| Skeleton detected (65 bones) | ✅ |
| Idle animation plays + loops | ✅ |
| Talking animation plays | ✅ |
| Thinking animation plays | ✅ |
| Skeletal distortion | ❌ None |
| UE5 retargeting | ❌ Removed |
| MetaHuman pipeline | ❌ Removed |
| DHIbody mapping | ❌ Removed |
| Mixamo→UE5 conversion | ❌ Removed |

---

## Key Implementation Details

### Character Model
- **File:** `public/models/hero.fbx` (Mixamo Ch36_nonPBR character)
- **Loader:** `three/examples/jsm/loaders/FBXLoader`
- **Bone count:** 65

### Bone Name Normalisation
Mixamo FBX uses namespace prefixes like `mixamorig1:Hips`.  
The fix: **split on `:` and take the last segment**.

```js
function stripMixamoPrefix(name) {
  if (!name) return name;
  if (name.includes(':')) return name.split(':').pop(); // "mixamorig1:Hips" → "Hips"
  return name.replace(/^mixamorig\d*[_]?/i, '');
}
```

Applied to **both**:
1. Character skeleton bone names (on clone)
2. Animation track names (after FBX load)

### Animation Files
All in `public/animations/`:
- `Idle.fbx` → plays on loop at startup
- `Talking.fbx` → plays after 7s, then transitions to Thinking
- `Thinking.fbx` → plays after Talking ends, then loops back to Idle
- `Start Walking.fbx` / `Stop Walking.fbx` → available for future use

### Animation Mixer
- Created on the cloned model object
- Updated every frame via `useFrame`
- Idle: `LoopRepeat` / Infinity
- Talking/Thinking: `LoopOnce` + `clampWhenFinished = true`

---

## Component Structure

```
MixamoTestScene (default export)
  └─ Canvas
       ├─ Lights (ambient + directional + hemisphere)
       ├─ Suspense
       │    └─ MixamoScene  ← all 3D logic lives here
       │         ├─ useLoader(FBXLoader, '/models/hero.fbx')
       │         ├─ SkeletonUtils.clone()
       │         ├─ FBXLoader (animations, manual batch load)
       │         ├─ AnimationMixer
       │         └─ useFrame (mixer.update)
       ├─ OrbitControls
       └─ gridHelper
```

---

## Git Reference

```
Commit: WORKING_MIXAMO_BASELINE  (root-commit 2c9655d)
Tag:    WORKING_MIXAMO_BASELINE
Branch: master
```

### To revert to this baseline at any time:
```bash
git checkout WORKING_MIXAMO_BASELINE
# or
git reset --hard WORKING_MIXAMO_BASELINE
```

---

## Allowed Future Changes (build on top only)

- Face upload system
- Face mapping / texture projection
- Gemini AI integration
- ElevenLabs TTS integration
- Lighting improvements
- Materials / textures
- Background environments
- UI/UX improvements
- Blinking & procedural micro-movements (layered on top of existing animations)

## Prohibited Changes

- ❌ Do NOT modify `MixamoTestScene.jsx` animation logic
- ❌ Do NOT modify `stripMixamoPrefix` function
- ❌ Do NOT replace `hero.fbx`
- ❌ Do NOT change animation state transitions (idle → talking → thinking)
- ❌ Do NOT re-introduce UE5/MetaHuman/DHIbody code
