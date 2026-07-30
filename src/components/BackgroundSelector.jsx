import React from 'react';
import { useApp } from '../context/AppContext';

export default function BackgroundSelector() {
  const { selectedBackground, setSelectedBackground } = useApp();

  const backgrounds = [
    { id: "space", name: "Cosmic Space", icon: "🌌" },
    { id: "living_room", name: "Living Room", icon: "🔥" },
    { id: "park", name: "Sunny Park", icon: "🌳" },
    { id: "beach", name: "Warm Beach", icon: "🏖️" },
    { id: "city", name: "City Night", icon: "🏙️" }
  ];

  return (
    <div className="flex flex-col items-center space-y-1.5 w-full">
      <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Locations</span>
      <div className="flex space-x-2 bg-black/40 backdrop-blur-sm border border-white/5 px-3 py-1.5 rounded-full max-w-full overflow-x-auto scrollbar-none">
        {backgrounds.map((bg) => (
          <button
            key={bg.id}
            onClick={() => setSelectedBackground(bg.id)}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 whitespace-nowrap ${
              selectedBackground === bg.id
                ? "bg-green-500 text-black shadow shadow-green-500/20"
                : "bg-white/5 hover:bg-white/10 text-white/70"
            }`}
          >
            <span>{bg.icon}</span>
            <span>{bg.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
