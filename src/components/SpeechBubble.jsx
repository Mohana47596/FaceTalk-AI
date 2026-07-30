import React, { useState, useEffect } from 'react';
import { Html } from '@react-three/drei';
import { useApp } from '../context/AppContext';

export default function SpeechBubble() {
  const {
    photoName,
    speechBubbleText,
    isThinking,
    isSpeaking
  } = useApp();

  const [displayedText, setDisplayedText] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isThinking) {
      setDisplayedText("");
      setVisible(true);
      return;
    }

    if (!speechBubbleText || speechBubbleText.trim() === "") {
      const timer = setTimeout(() => setVisible(false), 800);
      return () => clearTimeout(timer);
    }

    setVisible(true);
    setVisible(true);
    setDisplayedText(speechBubbleText);
  }, [speechBubbleText, isThinking]);

  if (!visible) return null;

  return (
    <Html position={[0, 1.4, 0]} center distanceFactor={6.5}>
      <div className="flex flex-col items-center select-text pointer-events-auto min-w-[240px] max-w-[320px]">
        
        {/* iPhone Glass Notification Box */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          borderRadius: '24px',
        }} className="p-4 text-white relative">
          
          {/* Header Row (App-like icon & Name) */}
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center shadow-inner">
              <span className="text-[10px]">✨</span>
            </div>
            <span className="text-[11px] font-medium tracking-wide uppercase">
              {photoName || "FaceTalk AI"}
            </span>
          </div>

          {/* Text Message or Loading Pulsing Dots */}
          <div className="text-[14px] font-normal leading-snug tracking-tight text-white/95">
            {isThinking ? (
              <span className="flex space-x-1.5 justify-start items-center h-5 py-1">
                <span className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            ) : (
              <>
                <span>{displayedText}</span>
                {/* Blinking typing cursor */}
                {isSpeaking && displayedText.length < speechBubbleText.length && (
                  <span className="inline-block w-1.5 h-3.5 bg-amber-400 ml-1 rounded-full animate-pulse" />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Html>
  );
}
