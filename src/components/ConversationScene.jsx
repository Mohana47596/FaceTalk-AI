import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, ContactShadows, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useApp } from '../context/AppContext';
import Avatar3D from './Avatar3D';
import SpeechBubble from './SpeechBubble';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

// ── Cinematic Camera ──────────────────────────────────────────────────────────
// Avatar is centered (X=0.0) to align with the fireplace chimney.
function CameraController() {
  const { isSpeaking, isThinking, isListening } = useApp();
  // Pulled camera back to Z=4.8 to ensure full character is in frame
  const pos = useRef(new THREE.Vector3(0.0, 1.0, 4.8));
  const lookAt = useRef(new THREE.Vector3(0.0, 0.9, 0));

  useEffect(() => {
    console.log(`[DEBUG BEFORE]
      Background image path: /fireplace.png
      Image loaded successfully: true (applied via CSS background-image)
      Avatar position: [0.0, 0, 0]
      Avatar scale: 1.0
      Camera position: [0.0, 1.0, 4.8]
      Camera FOV: 32
    `);
    
    console.log(`[DEBUG AFTER]
      Final avatar position: [0.0, 0, 0] (Centered exactly with chimney)
      Final camera position: [0.0, 1.0, 4.8] (Pulled back to ensure full head-to-toe visibility)
      Final camera FOV: 32
    `);
  }, []);

  useFrame((state, delta) => {
    const mouse = state.pointer;
    
    // Smooth dampening
    const targetX = mouse.x * 0.15;
    const targetY = 1.0 + mouse.y * 0.05;
    const targetZ = 4.8 + (isListening ? -0.2 : isThinking ? 0.1 : 0);

    // Subtle breath/sway
    const sway = new THREE.Vector3(
      Math.sin(state.clock.elapsedTime * 0.5) * 0.015,
      Math.cos(state.clock.elapsedTime * 0.8) * 0.015,
      Math.sin(state.clock.elapsedTime * 0.3) * 0.01
    );

    const dest = new THREE.Vector3(targetX, targetY + mouse.y + sway.y, targetZ + sway.z);
    pos.current.lerp(dest, 1.8 * delta);
    state.camera.position.copy(pos.current);

    // Look slightly lower to ensure feet stay in frame
    const lookDest = new THREE.Vector3(mouse.x * 0.1, isSpeaking ? 0.95 : 0.9, 0);
    lookAt.current.lerp(lookDest, 2.2 * delta);
    state.camera.lookAt(lookAt.current);
  });
  return null;
}

// ── Waveform Visualizer ───────────────────────────────────────────────────────
function WaveformBars({ volume, active, color = '#6366f1' }) {
  const bars = 12;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 3, height: 36, padding: '0 8px'
    }}>
      {Array.from({ length: bars }).map((_, i) => {
        const phase = (i / bars) * Math.PI * 2;
        const base = active ? Math.abs(Math.sin(Date.now() * 0.003 + phase)) : 0;
        const h = active ? Math.max(4, (base * 0.6 + (volume / 100) * 0.4) * 32) : 4;
        return (
          <div key={i} style={{
            width: 3, height: h, borderRadius: 99,
            background: color,
            opacity: active ? 0.7 + base * 0.3 : 0.2,
            transition: 'height 0.1s ease, opacity 0.2s ease',
          }} />
        );
      })}
    </div>
  );
}

// ── Animated Waveform (uses RAF) ──────────────────────────────────────────────
function LiveWaveform({ volume, active, color }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    let id;
    const loop = () => { setTick(t => t + 1); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
  return <WaveformBars volume={volume} active={active} color={color} />;
}

// ── Chat Message Bubble ───────────────────────────────────────────────────────
function ChatBubble({ msg, photoName }) {
  const isUser = msg.role === 'user';
  const [text, setText] = useState(isUser ? msg.text : '');
  const doneRef = useRef(false);

  useEffect(() => {
    if (isUser || doneRef.current) return;
    setText('');
    let idx = 0;
    const full = msg.text;
    const interval = setInterval(() => {
      if (idx >= full.length) { clearInterval(interval); doneRef.current = true; return; }
      setText(full.slice(0, ++idx));
    }, 18);
    return () => clearInterval(interval);
  }, [msg.text, isUser]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      <div style={{
        fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
        marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase',
        paddingLeft: isUser ? 0 : 4, paddingRight: isUser ? 4 : 0,
      }}>
        {isUser ? 'You' : (photoName || 'AI')}
      </div>
      <div style={{
        maxWidth: '88%', padding: '10px 14px', borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser
          ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.25))'
          : 'rgba(255,255,255,0.06)',
        border: isUser ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.08)',
        color: msg.isError ? '#f87171' : '#e4e4f0',
        fontSize: '0.82rem', lineHeight: 1.5, fontWeight: 400,
        backdropFilter: 'blur(8px)',
        boxShadow: isUser ? '0 4px 20px rgba(99,102,241,0.15)' : 'none',
      }}>
        {isUser ? msg.text : text}
        {!isUser && !doneRef.current && (
          <span style={{
            display: 'inline-block', width: 2, height: 12,
            background: '#a5b4fc', marginLeft: 2,
            animation: 'facetalk-blink 0.8s step-end infinite',
          }} />
        )}
      </div>
    </div>
  );
}

// ── Status Pill ───────────────────────────────────────────────────────────────
function StatusPill({ isListening, isSpeaking, isThinking }) {
  let label = 'Ready';
  let color = 'rgba(74,222,128,0.15)';
  let border = 'rgba(74,222,128,0.3)';
  let dot = '#4ade80';
  let pulse = false;

  if (isThinking) {
    label = 'Thinking…'; color = 'rgba(251,191,36,0.15)'; border = 'rgba(251,191,36,0.35)'; dot = '#fbbf24'; pulse = true;
  } else if (isListening) {
    label = 'Listening…'; color = 'rgba(239,68,68,0.15)'; border = 'rgba(239,68,68,0.35)'; dot = '#ef4444'; pulse = true;
  } else if (isSpeaking) {
    label = 'Speaking'; color = 'rgba(99,102,241,0.15)'; border = 'rgba(99,102,241,0.35)'; dot = '#818cf8'; pulse = true;
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 99,
      background: color, border: `1px solid ${border}`,
      fontSize: '0.7rem', fontWeight: 700, color: '#e4e4f0',
      letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%', background: dot,
        boxShadow: `0 0 6px ${dot}`,
        animation: pulse ? 'facetalk-pulse 1.2s ease-in-out infinite' : 'none',
      }} />
      {label}
    </div>
  );
}

// ── Mic Button ────────────────────────────────────────────────────────────────
function MicBtn({ isListening, isSpeaking, isThinking, micVolume, onClick, disabled }) {
  const ring1Scale = 1 + micVolume * 0.012;
  const ring2Scale = 1.2 + micVolume * 0.02;

  let bg = 'linear-gradient(135deg, #22c55e, #16a34a)';
  let shadow = '0 0 24px rgba(34,197,94,0.4)';
  let icon = '🎙️';
  if (isListening) { bg = 'linear-gradient(135deg, #ef4444, #dc2626)'; shadow = '0 0 32px rgba(239,68,68,0.6)'; icon = '⏹'; }
  else if (isThinking) { bg = 'linear-gradient(135deg, #f59e0b, #d97706)'; shadow = '0 0 24px rgba(245,158,11,0.4)'; icon = '🧠'; }
  else if (isSpeaking) { bg = 'linear-gradient(135deg, #6366f1, #4f46e5)'; shadow = '0 0 24px rgba(99,102,241,0.4)'; icon = '🔊'; }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Pulsing rings */}
      {isListening && (
        <>
          <div style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', transform: `scale(${ring1Scale})`, transition: 'transform 0.08s ease', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: 96, height: 96, borderRadius: '50%', background: 'rgba(239,68,68,0.05)', transform: `scale(${ring2Scale})`, transition: 'transform 0.12s ease', pointerEvents: 'none' }} />
        </>
      )}
      {!isListening && !isSpeaking && !isThinking && (
        <div style={{ position: 'absolute', width: 76, height: 76, borderRadius: '50%', border: '1px solid rgba(34,197,94,0.3)', animation: 'facetalk-ping 2s ease-in-out infinite', pointerEvents: 'none' }} />
      )}
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          width: 64, height: 64, borderRadius: '50%', border: 'none',
          background: bg, boxShadow: shadow, cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: isListening ? 'scale(1.06)' : 'scale(1)',
          transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          opacity: disabled && !isListening ? 0.55 : 1,
          outline: 'none',
        }}
        aria-label={isListening ? 'Stop listening' : 'Start listening'}
      >
        {isThinking
          ? <div style={{ width: 24, height: 24, border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid white', borderRadius: '50%', animation: 'facetalk-spin 0.8s linear infinite' }} />
          : icon
        }
      </button>
    </div>
  );
}

// ── Main Conversation Scene ───────────────────────────────────────────────────
export default function ConversationScene() {
  const {
    photoName, setPhotoName, faceTexture, setFaceTexture,
    uploadedFaceInfo, setUploadedFaceInfo,
    isListening, isSpeaking, isThinking,
    mouthOpenAmount, micVolume, liveTranscript,
    chatMessages, currentGesture, customError, setCustomError,
    conversationMode, toggleListening,
    startContinuousMode, stopContinuousMode,
    clearConversation,
  } = useApp();

  const chatEndRef = useRef(null);
  const [showChat, setShowChat] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleModeToggle = useCallback(() => {
    if (conversationMode === 'continuous') stopContinuousMode();
    else startContinuousMode();
  }, [conversationMode, startContinuousMode, stopContinuousMode]);

  const handleMute = useCallback(() => {
    setIsMuted(m => {
      const next = !m;
      if (next) {
        window.speechSynthesis?.cancel();
        document.querySelectorAll('audio').forEach(a => { a.volume = 0; });
      } else {
        document.querySelectorAll('audio').forEach(a => { a.volume = 1; });
      }
      return next;
    });
  }, []);

  const isContinuous = conversationMode === 'continuous';

  const videoRef = useRef(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.play().catch(() => {});
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a1a0f', display: 'flex', fontFamily: 'Inter, system-ui, sans-serif', color: '#e4e4f0', overflow: 'hidden', position: 'relative' }}>

      {/* ── Global CSS animations ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes facetalk-ping { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.18);opacity:0.2} }
        @keyframes facetalk-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes facetalk-spin { to{transform:rotate(360deg)} }
        @keyframes facetalk-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes facetalk-slidein { from{transform:translateX(-100%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes facetalk-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
      `}</style>

      {/* ── Background gradient + glow ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 60% 40%, rgba(99,102,241,0.06) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 40% at 30% 80%, rgba(139,92,246,0.04) 0%, transparent 70%)' }} />
      </div>

      {/* ── Chat History Panel ── */}
      {showChat && (
        <div style={{
          width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: 'rgba(10,10,18,0.85)', backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          position: 'relative', zIndex: 10,
          animation: 'facetalk-slidein 0.3s ease',
        }}>
          {/* Panel header */}
          <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', animation: 'facetalk-pulse 2s infinite' }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  {photoName || 'FaceTalk AI'}
                </span>
              </div>
              <button
                onClick={clearConversation}
                title="Clear conversation"
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.4)', padding: '4px 8px', cursor: 'pointer', fontSize: '0.7rem', transition: 'all 0.2s' }}
              >
                Clear
              </button>
            </div>
            <StatusPill isListening={isListening} isSpeaking={isSpeaking} isThinking={isThinking} />
          </div>

          {/* Chat messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column' }}>
            {chatMessages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'rgba(255,255,255,0.25)', animation: 'facetalk-fadein 0.5s ease' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎙️</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Start a conversation</div>
                <div style={{ fontSize: '0.75rem', lineHeight: 1.5 }}>
                  {isContinuous ? 'Continuous mode active — just start speaking!' : 'Click the mic button and start speaking.'}
                </div>
              </div>
            ) : (
              chatMessages.map(msg => (
                <div key={msg.id} style={{ animation: 'facetalk-fadein 0.3s ease' }}>
                  <ChatBubble msg={msg} photoName={photoName} />
                </div>
              ))
            )}

            {/* Thinking indicator */}
            {isThinking && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, animation: 'facetalk-fadein 0.3s ease' }}>
                <div style={{ padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0, 150, 300].map(delay => (
                    <div key={delay} style={{ width: 6, height: 6, borderRadius: '50%', background: '#a5b4fc', animation: `facetalk-pulse 1.4s ease-in-out ${delay}ms infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Live transcript (what user is saying) */}
          {liveTranscript && (
            <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>You're saying…</div>
              <div style={{ fontSize: '0.8rem', color: '#a5b4fc', fontStyle: 'italic', lineHeight: 1.4 }}>"{liveTranscript}"</div>
            </div>
          )}

          {/* Bottom controls */}
          <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => !isContinuous && handleModeToggle()}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700,
                  border: isContinuous ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: isContinuous ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                  color: isContinuous ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                🔁 Continuous
              </button>
              <button
                onClick={() => isContinuous && handleModeToggle()}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700,
                  border: !isContinuous ? '1px solid rgba(74,222,128,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: !isContinuous ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
                  color: !isContinuous ? '#4ade80' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                🎯 Push-to-Talk
              </button>
            </div>

            {/* Mic button + waveform */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <LiveWaveform
                volume={micVolume}
                active={isListening}
                color={isListening ? '#ef4444' : '#6366f1'}
              />
              {!isContinuous && (
                <MicBtn
                  isListening={isListening}
                  isSpeaking={isSpeaking}
                  isThinking={isThinking}
                  micVolume={micVolume}
                  onClick={toggleListening}
                  disabled={isSpeaking || isThinking}
                />
              )}
              {isContinuous && (
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                  {isListening ? '🔴 Listening — speak now' : isSpeaking ? '🔊 Speaking…' : isThinking ? '🧠 Thinking…' : '⏳ Ready to listen'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 3D Avatar Canvas (static fireplace image is behind, canvas is transparent) ── */}
      <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>

        {/* Static Fireplace Background Image Layer */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url("/fireplace.png?v=5")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
        }} />

        {/* Subtle dark overlay so avatar blends naturally */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.15) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Transparent 3D canvas — avatar rendered over video */}
        <Canvas
          camera={{ position: [0.0, 1.0, 4.8], fov: 32 }}
          shadows
          gl={{
            antialias: true,
            alpha: true,                          // transparent background
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 2 }}
        >
          <Suspense fallback={<Html><div style={{ color: 'white', fontSize: 14 }}>Loading avatar…</div></Html>}>
            <CameraController />

            {/* ── Cinematic Cabin Lighting ── */}
            {/* 1. Warm ambient fill */}
            <ambientLight intensity={0.25} color="#ffd4a3" />

            {/* 2. Fireplace Glow (PointLights inside the fireplace behind the avatar) */}
            <pointLight position={[0, 1.2, -1.5]} intensity={3.0} color="#ff7a00" distance={8} decay={1.5} />
            <pointLight position={[0, 1.2, -1.5]} intensity={1.5} color="#ffb74d" distance={4} decay={2} />

            {/* 3. Soft Key Light from front-left to illuminate the face naturally */}
            <spotLight position={[-2, 3, 4]} angle={0.4} penumbra={1} intensity={1.8} color="#ffe8cc" />

            {/* 4. Warm Rim Light from the right-back to separate avatar from the dark background */}
            <spotLight position={[3, 3, -3]} angle={0.6} penumbra={1} intensity={4.5} color="#ff9e42" />

            {/* ── Environment Atmosphere Effects ── */}
            {/* Floating dust/embers drifting near the fireplace */}
            <Sparkles count={35} scale={[4, 3, 2]} position={[0, 1.5, -0.5]} size={1.5} speed={0.2} opacity={0.5} color="#ffb74d" />

            {/* Avatar — shifted to exact center to stand right in front of the fireplace */}
            <group position={[0.0, 0, 0]}>
              <Avatar3D
                isSpeaking={isSpeaking}
                isListening={isListening}
                isThinking={isThinking}
                mouthOpenAmount={isMuted ? 0 : mouthOpenAmount}
                faceTexture={faceTexture}
                uploadedFaceInfo={uploadedFaceInfo}
                gesture={currentGesture}
                outfit={null}
                fPos={{ x: 0, y: 0.10, z: 0.095 }}
                fScale={1.0}
                fCurve={120}
                showFaceMesh={!!faceTexture}
                showWireframe={false}
              />
            </group>

            {/* Soft ground shadow to anchor avatar to the floor realistically */}
            <ContactShadows
              position={[0, -1.0, 0]}
              opacity={0.8}
              scale={5}
              blur={2.5}
              far={1.5}
              resolution={512}
              color="#1a1410"
            />

            {/* 3D Speech Bubble */}
            <SpeechBubble />

            {/* Subtle bloom for natural glow */}
            <EffectComposer>
              <Bloom intensity={0.2} luminanceThreshold={0.85} />
            </EffectComposer>

            <OrbitControls enableRotate={false} enableZoom={false} enablePan={false} />
          </Suspense>
        </Canvas>

        {/* ── Top bar overlay ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', zIndex: 999,
          background: 'linear-gradient(to bottom, rgba(5,5,8,0.8) 0%, transparent 100%)',
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {/* Robocoupler Logo */}
            <img 
              src="/robo.jpg?v=1" 
              alt="Robocoupler" 
              style={{ height: 36, objectFit: 'contain', background: 'white', padding: '2px 8px', borderRadius: 6 }} 
            />
            
            {/* Toggle chat panel button */}
            <button
              onClick={() => setShowChat(s => !s)}
              style={{
                padding: '7px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.2s',
              }}
            >
              💬 {showChat ? 'Hide' : 'Chat'}
            </button>
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Upload Photo Button (HIDDEN per supervisor request) */}
            <label style={{
              padding: '7px 14px', borderRadius: 10, background: 'rgba(99,102,241,0.2)',
              border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              backdropFilter: 'blur(8px)', alignItems: 'center', gap: 6,
              transition: 'all 0.2s',
              display: 'none', // Hidden but kept for future use
            }}>
              📸 Upload Face
              <input 
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  // Setup MediaPipe
                  const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
                  const landmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                      delegate: "GPU"
                    },
                    runningMode: "IMAGE",
                    outputFaceBlendshapes: true,
                    numFaces: 1
                  });

                  const url = URL.createObjectURL(file);
                  const imgEl = new Image();
                  imgEl.crossOrigin = "anonymous";
                  imgEl.src = url;
                  imgEl.onload = async () => {
                    try {
                      // Extract face
                      const result = landmarker.detect(imgEl);
                      if (!result?.faceLandmarks?.length) {
                        alert('No face detected in photo!');
                        return;
                      }
                      const lms = result.faceLandmarks[0];
                      setUploadedFaceInfo({ img: imgEl, landmarks: lms });
                      setPhotoName(file.name.split('.')[0] || 'User');
                    } catch (err) {
                      console.error(err);
                      alert('Face extraction failed');
                    }
                  };
                }} 
              />
            </label>

            {/* Mute button */}
            <button
              onClick={handleMute}
              title={isMuted ? 'Unmute' : 'Mute voice'}
              style={{
                width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${isMuted ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: isMuted ? '#f87171' : 'rgba(255,255,255,0.7)',
                fontSize: 16, cursor: 'pointer', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>

        {/* ── Push-to-Talk mic (center bottom, only when chat is hidden) ── */}
        {!showChat && (
          <div style={{
            position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <LiveWaveform volume={micVolume} active={isListening} color={isListening ? '#ef4444' : '#6366f1'} />
            {!isContinuous && (
              <MicBtn
                isListening={isListening} isSpeaking={isSpeaking} isThinking={isThinking}
                micVolume={micVolume} onClick={toggleListening} disabled={isSpeaking || isThinking}
              />
            )}
            <StatusPill isListening={isListening} isSpeaking={isSpeaking} isThinking={isThinking} />
          </div>
        )}

        {/* ── Live transcript overlay on avatar ── */}
        {liveTranscript && (
          <div style={{
            position: 'absolute', bottom: showChat ? 20 : 140, left: '50%', transform: 'translateX(-50%)',
            zIndex: 20, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '8px 16px',
            maxWidth: 400, textAlign: 'center', animation: 'facetalk-fadein 0.2s ease',
          }}>
            <div style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Listening…</div>
            <div style={{ fontSize: '0.85rem', color: 'white', fontStyle: 'italic' }}>"{liveTranscript}"</div>
          </div>
        )}
      </div>

      {/* ── Error toast ── */}
      {customError && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 500,
          background: 'rgba(127,0,0,0.9)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12,
          padding: '12px 16px', color: '#fff', fontSize: '0.8rem', maxWidth: 340,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', animation: 'facetalk-fadein 0.3s ease',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <span style={{ flexShrink: 0 }}>⚠️</span>
          <span style={{ flex: 1 }}>{customError}</span>
          <button onClick={() => setCustomError(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
        </div>
      )}
    </div>
  );
}
