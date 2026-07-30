import React from 'react';

export default function LoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-[#0a0a0af0] backdrop-blur-md z-40 flex flex-col items-center justify-center text-white p-6 select-none animate-fadeIn">
      
      {/* Animated spinner rings */}
      <div className="relative w-28 h-28 flex items-center justify-center mb-6">
        <div className="absolute inset-0 border-4 border-t-green-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
        <div className="absolute w-[80%] h-[80%] border-4 border-b-emerald-600 border-t-transparent border-r-transparent border-l-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.2s' }} />
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <span className="text-3xl">👤</span>
        </div>
      </div>

      {/* Progress Message */}
      <h2 className="text-lg font-bold tracking-wider text-white">
        Initializing 3D Workspace
      </h2>
      <p className="text-[10px] text-white/50 font-bold uppercase mt-1.5 tracking-widest">
        Loading glTF Model & Textures...
      </p>

    </div>
  );
}
