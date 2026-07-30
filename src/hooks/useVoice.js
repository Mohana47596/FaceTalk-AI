import { useApp } from '../context/AppContext';

export function useVoice() {
  const {
    isListening,
    isSpeaking,
    isThinking,
    speechBubbleText,
    conversationHistory,
    micVolume,
    toggleListening,
    handleSpeak
  } = useApp();

  return {
    isListening,
    isSpeaking,
    isThinking,
    speechBubbleText,
    conversationHistory,
    micVolume,
    toggleListening,
    handleSpeak
  };
}
