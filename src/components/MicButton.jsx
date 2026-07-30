import React, { useRef } from 'react';
import { useApp } from '../context/AppContext';

export default function MicButton() {
  const {
    isListening,
    isSpeaking,
    isThinking,
    micVolume,
    toggleListening
  } = useApp();

  const isHoldRef = useRef(false);
  const holdTimeoutRef = useRef(null);

  // Handle Press-and-Hold voice recording
  const handleMouseDown = () => {
    if (isSpeaking || isThinking) return;
    
    holdTimeoutRef.current = setTimeout(() => {
      isHoldRef.current = true;
      if (!isListening) {
        toggleListening();
      }
    }, 450); // threshold for hold vs click
  };

  const handleMouseUp = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }
    if (isHoldRef.current) {
      isHoldRef.current = false;
      if (isListening) {
        toggleListening(); // stop recording on release
      }
    }
  };

  const getButtonStateClass = () => {
    if (isThinking) return "border-yellow-500 bg-yellow-500/20 text-yellow-500 cursor-wait";
    if (isSpeaking) return "border-white/10 bg-white/5 text-white/30 cursor-not-allowed opacity-50";
    if (isListening) return "border-red-500 bg-red-600 text-white shadow-lg shadow-red-500/40 scale-105 animate-pulse";
    return "border-green-500 bg-green-600/90 text-white shadow-lg shadow-green-500/30 hover:bg-green-500 active:scale-95 hover:shadow-green-500/50";
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      
      {/* Sound wave rings expanding outward, scale with input volume */}
      {isListening && (
        <>
          <div 
            style={{ transform: `scale(${1 + micVolume * 0.015})`, opacity: 0.15 + micVolume * 0.005 }}
            className="absolute w-24 h-24 rounded-full bg-red-500/20 blur-md pointer-events-none transition-all duration-75"
          />
          <div 
            style={{ transform: `scale(${1.2 + micVolume * 0.025})`, opacity: 0.08 + micVolume * 0.003 }}
            className="absolute w-28 h-28 rounded-full bg-red-500/10 blur-xl pointer-events-none transition-all duration-75"
          />
        </>
      )}

      {/* Pulsing ring for idle green glow */}
      {!isListening && !isSpeaking && !isThinking && (
        <div className="absolute w-20 h-20 rounded-full border border-green-500/20 bg-green-500/5 animate-ping opacity-45 pointer-events-none" />
      )}

      {/* Main Trigger Button */}
      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        onClick={() => {
          if (!isHoldRef.current && !isSpeaking && !isThinking) {
            toggleListening();
          }
        }}
        disabled={isSpeaking}
        className={`relative w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${getButtonStateClass()}`}
      >
        {/* Spinning border animation for thinking state */}
        {isThinking && (
          <div className="absolute inset-0 rounded-full border-2 border-t-transparent border-yellow-500 animate-spin" />
        )}

        {/* Dynamic Center Icons */}
        {isThinking ? (
          <span className="text-xl">🧠</span>
        ) : isListening ? (
          // Stop icon (recording)
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
          </svg>
        ) : (
          // Mic icon
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
            <path d="M6 10.5a.75.75 0 0 1 .75.75 5.25 5.25 0 0 0 10.5 0 .75.75 0 0 1 1.5 0 6.75 6.75 0 0 1-6 6.709V21a.75.75 0 0 1-1.5 0v-3.791a6.75 6.75 0 0 1-6-6.709A.75.75 0 0 1 6 10.5Z" />
          </svg>
        )}
      </button>

      {/* Label Subtitle indicator */}
      <span className="text-[10px] text-white/50 font-bold uppercase mt-2.5 tracking-widest select-none pointer-events-none">
        {isThinking ? "Thinking..." : isListening ? "Listening..." : isSpeaking ? "Speaking" : "Tap or Hold"}
      </span>
    </div>
  );
}
