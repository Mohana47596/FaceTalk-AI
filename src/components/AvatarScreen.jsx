import React, { Suspense, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useApp } from '../context/AppContext';
import Background3D from './Background3D';
import Avatar3D from './Avatar3D';
import SpeechBubble from './SpeechBubble';
import MicButton from './MicButton';
import OutfitSelector from './OutfitSelector';
import BackgroundSelector from './BackgroundSelector';
import LoadingOverlay from './LoadingOverlay';

// Cinematic camera controller implementing slow camera breathing, mouse parallax tracking, and state-based conversational dolly-zoom
function CameraController() {
  const { isSpeaking, isThinking } = useApp();
  const currentPos = React.useRef(new THREE.Vector3(0, 1, 5));
  const currentLookAt = React.useRef(new THREE.Vector3(0, 0.1, 0));

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    
    // 1. Slow camera breathing motion (gentle drifting)
    const swayX = Math.sin(time * 0.45) * 0.05;
    const swayY = Math.cos(time * 0.35) * 0.035;
    const swayZ = Math.sin(time * 0.15) * 0.06;

    // 2. Mouse tracking parallax (subtle follow)
    const mouseX = state.mouse.x * 0.15;
    const mouseY = state.mouse.y * 0.1;

    // 3. State-based cinematic dolly zoom
    const targetZ = isSpeaking ? 4.15 : (isThinking ? 4.4 : 5.0);
    const targetY = isSpeaking ? 1.12 : 1.0;

    // Combine base, breathing, and mouse movements
    const destX = mouseX + swayX;
    const destY = targetY + mouseY + swayY;
    const destZ = targetZ + swayZ;

    // Smoothly interpolate camera position
    currentPos.current.x += (destX - currentPos.current.x) * 2.2 * delta;
    currentPos.current.y += (destY - currentPos.current.y) * 2.2 * delta;
    currentPos.current.z += (destZ - currentPos.current.z) * 2.2 * delta;

    state.camera.position.copy(currentPos.current);

    // Look at target: slow drift matching state
    const lookY = isSpeaking ? 0.22 : 0.1;
    const destLookAt = new THREE.Vector3(mouseX * 0.2, lookY, 0);
    currentLookAt.current.lerp(destLookAt, 2.5 * delta);
    
    state.camera.lookAt(currentLookAt.current);
  });
  return null;
}

export default function AvatarScreen() {
  const {
    photoName,
    faceTexture,
    selectedOutfit,
    selectedBackground,
    isSpeaking,
    isListening,
    isThinking,
    mouthOpenAmount,
    currentGesture,
    resetSession
  } = useApp();

  const [isMuted, setIsMuted] = useState(false);

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      window.speechSynthesis.cancel();
      // Mute audio element if playing
      const audios = document.getElementsByTagName('audio');
      for (let i = 0; i < audios.length; i++) {
        audios[i].volume = 0;
      }
    } else {
      const audios = document.getElementsByTagName('audio');
      for (let i = 0; i < audios.length; i++) {
        audios[i].volume = 1;
      }
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden select-none bg-black">
      
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

      {/* 3D R3F Graphics Engine Canvas */}
      <Canvas
        camera={{ position: [0, 1, 5], fov: 45 }}
        style={{ width: '100vw', height: '100vh' }}
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05
        }}
      >
        <Suspense fallback={<Html><LoadingOverlay /></Html>}>
          
          {/* 1. Cinematic Camera Breathing & Tracking Controller */}
          <CameraController />

          {/* 2. Soft Sun & Directional Lighting */}
          <ambientLight intensity={0.25} />
          
          <directionalLight
            position={[3, 5, 3]}
            intensity={1.6}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0001}
          />

          {/* Warm fill light on the side */}
          <pointLight
            position={[-3, 2, 2]}
            color="#FFC58D"
            intensity={0.9}
          />

          {/* Rim light behind avatar to create glowing edges */}
          <directionalLight
            position={[0, 3, -6]}
            color="#e2f1ff"
            intensity={2.2}
          />

          {/* Animated 3D Background (with photorealistic HDRI inside) */}
          <Background3D scene={selectedBackground} />

          {/* 3D Character Avatar */}
          <Avatar3D
            isSpeaking={isSpeaking}
            isListening={isListening}
            isThinking={isThinking}
            mouthOpenAmount={isMuted ? 0 : mouthOpenAmount}
            faceTexture={faceTexture}
            gesture={currentGesture}
            outfit={selectedOutfit}
          />

          {/* 3. Soft contact shadows under the avatar's feet */}
          <ContactShadows
            position={[0, -1.0, 0]}
            opacity={0.85}
            scale={10}
            blur={2.4}
            far={1.8}
          />

          {/* 3D Speech Subtitle bubble above head */}
          <SpeechBubble />

          {/* Camera controls (restricted, handled primarily by CameraController) */}
          <OrbitControls
            enableRotate={false}
            enableZoom={false}
            enablePan={false}
          />

          {/* Post Processing bloom glowing effects */}
          <EffectComposer>
            <Bloom intensity={0.25} luminanceThreshold={0.8} />
          </EffectComposer>

        </Suspense>
      </Canvas>

      {/* =========================================================
          UI OVERLAYS (HTML Layer)
          ========================================================= */}
      
      {/* Top Navigation Bar */}
      <header className="absolute top-0 inset-x-0 h-16 flex items-center justify-between px-6 z-20 pointer-events-none">
        
        {/* Character Badge Name */}
        <div className="flex items-center space-x-3 pointer-events-auto bg-black/55 backdrop-blur border border-white/10 px-4 py-2 rounded-2xl">
          <span className="text-xl">😎</span>
          <div className="flex flex-col">
            <span className="text-xs font-black text-white leading-none">
              {photoName || "Companion"}
            </span>
            <span className="text-[9px] font-bold text-green-400 mt-0.5 tracking-wider uppercase">
              Online
            </span>
          </div>
        </div>

        {/* Action Toggles */}
        <div className="flex items-center space-x-2.5 pointer-events-auto">
          {/* Mute toggle */}
          <button
            onClick={handleMuteToggle}
            className="w-10 h-10 rounded-2xl bg-black/55 backdrop-blur border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all active:scale-95 text-white"
            title={isMuted ? "Unmute Voice" : "Mute Voice"}
          >
            {isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
              </svg>
            )}
          </button>

          {/* Reset Session button */}
          <button
            onClick={resetSession}
            className="px-4 h-10 rounded-2xl bg-black/55 backdrop-blur border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all active:scale-95 text-xs font-bold text-white"
          >
            ↩ New Photo
          </button>
        </div>
      </header>

      {/* Bottom Control Drawer overlay panel (Mic Button Only) */}
      <div className="absolute bottom-10 inset-x-0 flex flex-col items-center z-20 pointer-events-none">
        
        {/* Mic Toggle Button */}
        <div className="pointer-events-auto">
          <MicButton />
        </div>

      </div>

    </div>
  );
}
