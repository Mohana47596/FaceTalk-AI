import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useApp } from '../context/AppContext';
import { loadFaceModels, extractFace } from '../avatar/faceExtractor';
import Avatar3D from './Avatar3D';

export default function UploadScreen() {
  const {
    setScreen,
    uploadedImage,
    setUploadedImage,
    photoName,
    setPhotoName,
    faceTexture,
    setFaceTexture
  } = useApp();

  const [loadingModels, setLoadingModels] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [facePreviewUrl, setFacePreviewUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const fileInputRef = useRef(null);

  // Pre-load face-api.js models on mount
  useEffect(() => {
    async function init() {
      try {
        setLoadingModels(true);
        await loadFaceModels();
        setLoadingModels(false);
      } catch (err) {
        console.error("Failed to load face-api models:", err);
        setErrorMsg("Failed to initialize face detection models. Please refresh.");
        setLoadingModels(false);
      }
    }
    init();
  }, []);

  const handleChoosePhoto = () => {
    if (loadingModels || extracting) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedImage(file);
    // Clean up filename for persona prompt
    const cleanName = file.name.split('.')[0].replace(/[-_]/g, ' ');
    setPhotoName(cleanName);

    setExtracting(true);
    setFaceDetected(false);
    setErrorMsg(null);

    // Create temporary image object to show raw preview and extract face
    const reader = new FileReader();
    reader.onload = async (event) => {
      setFacePreviewUrl(event.target.result);
      
      try {
        // Run face-api face extraction and get THREE.CanvasTexture
        const texture = await extractFace(file);
        setFaceTexture(texture);
        setFaceDetected(true);
      } catch (err) {
        console.error("Face extraction error:", err);
        setErrorMsg(err.message || "No face detected. Please try another photo.");
        setUploadedImage(null);
        setFaceTexture(null);
      } finally {
        setExtracting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleContinue = () => {
    if (faceDetected) {
      setScreen("avatar");
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-[#0a0a0a] flex flex-col justify-center items-center overflow-hidden select-none">
      
      {/* Full-Screen Looping Video Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
        <video
          src="/videos/scenery.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="w-full h-full object-cover transition-opacity duration-1000 ease-in-out opacity-0"
          onPlay={(e) => {
            e.currentTarget.classList.remove('opacity-0');
            e.currentTarget.classList.add('opacity-100');
          }}
        />
        {/* Subtle Dark Overlay (25%) */}
        <div className="absolute inset-0 bg-black/25 z-10" />
      </div>

      {/* 3D Ybot in Background */}
      <div className="absolute inset-0 w-full h-full z-0 opacity-60">
        <Canvas camera={{ position: [0, 1, 5], fov: 45 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[1, 2, 1]} intensity={1.2} />
          <pointLight position={[-1, 1, 1]} intensity={0.5} color="#4ade80" />
          <Suspense fallback={null}>
            <Avatar3D
              isSpeaking={false}
              isListening={false}
              mouthOpenAmount={0}
              faceTexture={faceTexture}
              gesture="idle"
              outfit="casual"
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Foreground Container Card */}
      <div className="relative z-10 w-[90%] max-w-[420px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
        
        {/* Pulse Face Scan Indicator */}
        <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
          <div className={`absolute inset-0 rounded-full border border-green-500/30 bg-green-500/5 ${extracting ? 'animate-ping' : 'animate-pulse'}`} />
          <div className="relative w-14 h-14 rounded-full bg-green-500/10 border border-green-400/30 flex items-center justify-center">
            {faceDetected ? (
              <span className="text-2xl text-green-400">✓</span>
            ) : (
              <span className={`text-2xl ${extracting ? 'animate-spin' : ''}`}>👤</span>
            )}
          </div>
        </div>

        {/* Titles */}
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Upload any photo
        </h1>
        <p className="text-xs text-white/50 mb-8 max-w-[280px]">
          Any portrait photo. Your face comes alive on a 3D model.
        </p>

        {/* Upload Dashed Box Card */}
        <div
          onClick={handleChoosePhoto}
          className={`w-full py-8 px-4 border-2 border-dashed rounded-2xl cursor-pointer flex flex-col items-center justify-center transition-all ${
            faceDetected
              ? 'border-green-500/50 bg-green-500/5'
              : 'border-white/20 hover:border-green-500/40 hover:bg-white/5'
          }`}
        >
          {facePreviewUrl ? (
            <div className="flex flex-col items-center">
              <img
                src={facePreviewUrl}
                alt="Face Preview"
                className="w-20 h-20 rounded-full object-cover border-2 border-white/20 shadow-lg mb-3"
              />
              <span className="text-xs font-semibold text-green-400">
                {extracting ? "Scanning face..." : "Face Detected!"}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-3xl mb-2">📸</span>
              <span className="text-xs font-semibold text-white/70">
                {loadingModels ? "Loading models..." : "Choose Photo"}
              </span>
              <span className="text-[10px] text-white/40 mt-1">
                PNG, JPG or JPEG
              </span>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            disabled={loadingModels || extracting}
            className="hidden"
          />
        </div>

        {/* Error notification */}
        {errorMsg && (
          <p className="text-xs text-red-400 mt-4 leading-relaxed font-medium">
            ⚠️ {errorMsg}
          </p>
        )}

        {/* "Bring it to life" transition button */}
        {faceDetected && !extracting && (
          <button
            onClick={handleContinue}
            className="w-full py-4 mt-8 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 active:scale-95 transition-all text-sm font-bold text-white rounded-2xl shadow-lg shadow-green-500/20"
          >
            Bring it to life →
          </button>
        )}
      </div>

      {/* Loading Overlay Spinner for model initialization */}
      {loadingModels && (
        <div className="absolute inset-0 bg-black/80 flex flex-col justify-center items-center z-50">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-xs text-white/60 tracking-wider">
            Loading Face api Models...
          </p>
        </div>
      )}
    </div>
  );
}
