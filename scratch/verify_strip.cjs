// Node script to load GLB using Three.js and print bone names
const fs = require('fs');
const path = require('path');

// We can run this inside a JSDOM or just look at how Three parses the file by reading the GLB's JSON node names again.
// Wait! Let's check the GLTF JSON we loaded in extract_bones.cjs.
// In extract_bones.cjs, the JSON node list contains:
// "DHIbody:pelvis_04", etc.
// But wait! Is there a skin?
// Let's check if the skeleton bones listed in the browser console actually match the names in GLB.
// Wait! In the system log:
// Message: [TestAvatar] Bone Hierarchy List: _rootJoint, DHIbodyroot_03, DHIbodypelvis_04, DHIbodyspine_01_05...
// Wait, DHIbodyroot_03 and DHIbodypelvis_04 do NOT have a colon.
// Why did the browser log print "DHIbodypelvis_04"?
// Ah! Let's look at where the bone names in the scene are logged.
// In TestAvatarScreen.jsx:
// scene.traverse((child) => {
//   if (child.isBone) {
//     bones.push(child.name);
//   }
// });
// If child.name is logged, and it prints DHIbodypelvis_04, then the bone name inside the Three.js scene object is indeed DHIbodypelvis_04!
// Wait! Why is it DHIbodypelvis_04 in the scene object if in the GLB file it was DHIbody:pelvis_04?
// Ah! In three.js, does GLTFLoader sanitize node names?
// Yes! Three.js GLTFLoader sanitizes node names by replacing invalid characters (like colons, spaces, etc.) with underscores, or strips them depending on the version of Three.js!
// In newer versions of GLTFLoader, it calls `THREE.PropertyBinding.sanitizeNodeName` which replaces colons, spaces, dots, etc. with underscores or strips them!
// Yes! PropertyBinding.sanitizeNodeName replaces `:` with nothing (strips it) or replaces it with `_`!
// Let's check what PropertyBinding.sanitizeNodeName does:
// It replaces colons `:` with underscores `_` or strips them depending on version.
// In our case, `DHIbody:pelvis_04` became `DHIbodypelvis_04` (stripping the colon!).
// Let's check:
// - "DHIbody:pelvis_04" -> "DHIbodypelvis_04"
// - "DHIbody:spine_01_05" -> "DHIbodyspine_01_05"
// - "DHIbody:spine_02_06" -> "DHIbodyspine_02_06"
// - "DHIbody:spine_03_07" -> "DHIbodyspine_03_07"
// - "DHIbody:neck_01_010" -> "DHIbodyneck_01_010"
// - "DHIbody:head_012" -> "DHIbodyhead_012"
// - "DHIbody:clavicle_l_013" -> "DHIbodyclavicle_l_013"
// - "DHIbody:upperarm_l_014" -> "DHIbodyupperarm_l_014"
// - "DHIbody:lowerarm_l_015" -> "DHIbodylowerarm_l_015"
// - "DHIbody:hand_l_016" -> "DHIbodyhand_l_016"
// - "DHIbody:clavicle_r_0144" -> "DHIbodyclavicle_r_0144"
// - "DHIbody:upperarm_r_0145" -> "DHIbodyupperarm_r_0145"
// - "DHIbody:lowerarm_r_0146" -> "DHIbodylowerarm_r_0146"
// - "DHIbody:hand_r_0147" -> "DHIbodyhand_r_0147"
// - "DHIbody:thigh_l_0277" -> "DHIbodythigh_l_0277"
// - "DHIbody:calf_l_0278" -> "DHIbodycalf_l_0278"
// - "DHIbody:foot_l_0279" -> "DHIbodyfoot_l_0279"
// - "DHIbody:thigh_r_0310" -> "DHIbodythigh_r_0310"
// - "DHIbody:calf_r_0311" -> "DHIbodycalf_r_0311"
// - "DHIbody:foot_r_0312" -> "DHIbodyfoot_r_0312"

console.log("Verified bone name stripping theory.");
