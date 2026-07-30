import React from 'react';
import { useApp } from '../context/AppContext';

export default function OutfitSelector() {
  const { selectedOutfit, setSelectedOutfit } = useApp();

  const outfits = [
    { id: "casual", name: "Casual", icon: "👕" },
    { id: "formal", name: "Formal", icon: "👔" },
    { id: "kurta", name: "Kurta", icon: "🧥" },
    { id: "hoodie", name: "Hoodie", icon: "🧥" },
    { id: "superhero", name: "Superhero", icon: "🦸" }
  ];

  return (
    <div className="flex flex-col items-center space-y-1.5 w-full">
      <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Outfits</span>
      <div className="flex space-x-2 bg-black/40 backdrop-blur-sm border border-white/5 px-3 py-1.5 rounded-full max-w-full overflow-x-auto scrollbar-none">
        {outfits.map((o) => (
          <button
            key={o.id}
            onClick={() => setSelectedOutfit(o.id)}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 whitespace-nowrap ${
              selectedOutfit === o.id
                ? "bg-green-500 text-black shadow shadow-green-500/20"
                : "bg-white/5 hover:bg-white/10 text-white/70"
            }`}
          >
            <span>{o.icon}</span>
            <span>{o.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
