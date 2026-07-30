import * as faceapi from 'face-api.js';
import * as THREE from 'three';

const LOCAL_MODEL_URL = '/models/faceapi';
const CDN_MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

let _modelsLoaded = false;

/** Load face-api models once */
export async function loadFaceModels() {
  if (_modelsLoaded) return;
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromUri(LOCAL_MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(LOCAL_MODEL_URL);
    _modelsLoaded = true;
    console.log('[FaceAPI] Local models loaded');
  } catch {
    await faceapi.nets.ssdMobilenetv1.loadFromUri(CDN_MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(CDN_MODEL_URL);
    _modelsLoaded = true;
    console.log('[FaceAPI] CDN models loaded');
  }
}

/**
 * Extract face from an uploaded image file.
 * Returns:
 *   { texture, cropCanvas, cropDataUrl, landmarkData }
 */
export async function extractFace(imageFile) {
  const img = await faceapi.bufferToImage(imageFile);

  const detection = await faceapi
    .detectSingleFace(img)
    .withFaceLandmarks();

  if (!detection) throw new Error('No face detected in this photo');

  const lm  = detection.landmarks;
  const box = detection.detection.box;

  // ── Tight crop using landmark extremes ──────────────────────────────────────
  const allPoints = lm.positions;
  const xs = allPoints.map(p => p.x);
  const ys = allPoints.map(p => p.y);

  const lmMinX = Math.min(...xs);
  const lmMaxX = Math.max(...xs);
  const lmMinY = Math.min(...ys);
  const lmMaxY = Math.max(...ys);

  // Padding: 25% on sides, 40% above (forehead/hair), 25% below (chin/beard)
  const lmW = lmMaxX - lmMinX;
  const lmH = lmMaxY - lmMinY;
  const padX  = lmW * 0.25;
  const padYt = lmH * 0.40;  
  const padYb = lmH * 0.25;  

  const cropX = Math.max(0, lmMinX - padX);
  const cropY = Math.max(0, lmMinY - padYt);
  const cropW = Math.min(img.naturalWidth  - cropX, lmW + padX * 2);
  const cropH = Math.min(img.naturalHeight - cropY, lmH + padYt + padYb);

  // ── Draw face onto a 512×512 square canvas with transparent background ──────
  const SIZE = 512;
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width  = SIZE;
  cropCanvas.height = SIZE;
  const ctx = cropCanvas.getContext('2d');

  // Draw face region, stretched to fill the square
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, SIZE, SIZE);

  // Soft edge feather using radial gradient clip
  const gradient = ctx.createRadialGradient(
    SIZE / 2, SIZE / 2, SIZE * 0.35,  // inner circle (solid)
    SIZE / 2, SIZE / 2, SIZE * 0.50   // outer circle (fades to transparent)
  );
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  // destination-in: keeps the existing canvas content only where the new shape is opaque
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.globalCompositeOperation = 'source-over';

  // ── Three.js texture ────────────────────────────────────────────────────────
  const texture = new THREE.CanvasTexture(cropCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Use transparent material settings
  texture.needsUpdate = true;

  texture.userData = {
    canvas: cropCanvas,
    img,
    crop: { x: cropX, y: cropY, w: cropW, h: cropH },
    leftEye:  lm.getLeftEye(),
    rightEye: lm.getRightEye(),
    nose:     lm.getNose(),
    mouth:    lm.getMouth(),
    box,
  };

  const cropDataUrl = cropCanvas.toDataURL('image/png');

  return { texture, cropCanvas, cropDataUrl, landmarkData: texture.userData };
}
