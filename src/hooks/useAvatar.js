import { useApp } from '../context/AppContext';

export function useAvatar() {
  const {
    faceTexture,
    selectedOutfit,
    setSelectedOutfit,
    selectedBackground,
    setSelectedBackground,
    currentGesture,
    setCurrentGesture,
    mouthOpenAmount,
    setMouthOpenAmount
  } = useApp();

  return {
    faceTexture,
    selectedOutfit,
    setSelectedOutfit,
    selectedBackground,
    setSelectedBackground,
    currentGesture,
    setCurrentGesture,
    mouthOpenAmount,
    setMouthOpenAmount
  };
}
