import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { askGroq } from '../ai/groq';
import { askGemini } from '../ai/gemini';
import { speakText } from '../voice/elevenLabs';
import { LipSyncAnalyzer } from '../voice/lipSync';
import { VoiceRecorder } from '../voice/speechInput';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [screen, setScreen] = useState('avatar');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedFaceInfo, setUploadedFaceInfo] = useState(null);
  const [photoName, setPhotoName] = useState('');
  const [faceTexture, setFaceTexture] = useState(null);
  const [selectedOutfit, setSelectedOutfit] = useState('casual');
  const [selectedBackground, setSelectedBackground] = useState('space');

  // ── Conversation States ────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [speechBubbleText, setSpeechBubbleText] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentGesture, setCurrentGesture] = useState('idle');
  const [mouthOpenAmount, setMouthOpenAmount] = useState(0);
  const [micVolume, setMicVolume] = useState(0);
  const [customError, setCustomError] = useState(null);
  const [conversationMode, setConversationMode] = useState('push-to-talk');
  const [avatarPersona, setAvatarPersona] = useState('');

  // ── Refs (avoid stale closures) ────────────────────────────────────────────
  const voiceRecorderRef = useRef(null);
  const activeLipSyncRef = useRef(null);
  const activeAudioRef = useRef(null);

  // Mutable ref mirrors so callbacks always see latest values
  const continuousModeRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const photoNameRef = useRef('');
  const avatarPersonaRef = useRef('');
  const conversationHistoryRef = useRef([]);

  // Keep refs in sync
  useEffect(() => { continuousModeRef.current = conversationMode === 'continuous'; }, [conversationMode]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { photoNameRef.current = photoName; }, [photoName]);
  useEffect(() => { avatarPersonaRef.current = avatarPersona; }, [avatarPersona]);
  useEffect(() => { conversationHistoryRef.current = conversationHistory; }, [conversationHistory]);

  // Function refs to break circular dependencies
  const startListeningInternalRef = useRef(null);
  const handleSpeakRef = useRef(null);

  // ── Audio Cleanup ──────────────────────────────────────────────────────────
  const cleanupAudio = useCallback(() => {
    if (activeLipSyncRef.current) {
      activeLipSyncRef.current.stopLoop();
      activeLipSyncRef.current = null;
    }
    if (activeAudioRef.current) {
      if (activeAudioRef.current.stop) {
        activeAudioRef.current.stop();
      } else {
        try { activeAudioRef.current.pause(); } catch(e) {}
      }
      activeAudioRef.current = null;
    }
    setMouthOpenAmount(0);
  }, []);

  // ── Initialize VoiceRecorder ───────────────────────────────────────────────
  useEffect(() => {
    try {
      voiceRecorderRef.current = new VoiceRecorder();
    } catch (e) {
      console.warn('Failed to initialize voice recorder:', e);
    }
    return () => {
      if (voiceRecorderRef.current) voiceRecorderRef.current.stopListening();
      if (activeLipSyncRef.current) activeLipSyncRef.current.stopLoop();
      if (activeAudioRef.current) {
        try { activeAudioRef.current.pause?.(); } catch(e) {}
      }
    };
  }, []);

  // ── Start Listening (internal, stable reference) ───────────────────────────
  const startListeningInternal = useCallback(() => {
    if (!voiceRecorderRef.current) {
      setCustomError('Speech Recognition not supported. Please use Chrome or Edge.');
      return;
    }
    setIsListening(true);
    setLiveTranscript('');

    voiceRecorderRef.current.startListening(
      (result) => {
        // Show interim transcript as user speaks
        if (result.interim) setLiveTranscript(result.interim);
        // When sentence is finalized, send to AI
        if (result.final && result.final.trim()) {
          setLiveTranscript('');
          handleSpeakRef.current?.(result.final.trim());
        }
      },
      (volume) => setMicVolume(volume),
      (err) => {
        console.error('Speech Recognition Error:', err);
        setCustomError(err.message || 'Microphone error. Please check permissions.');
        setIsListening(false);
        setLiveTranscript('');
      }
    );
  }, []);

  // Keep ref updated
  startListeningInternalRef.current = startListeningInternal;

  // ── Main AI Interaction Loop ───────────────────────────────────────────────
  const handleSpeak = useCallback(async (transcript) => {
    if (!transcript || transcript.trim() === '') return;

    // Stop any current audio/listening
    cleanupAudio();
    if (voiceRecorderRef.current) voiceRecorderRef.current.stopListening();
    setIsListening(false);
    setLiveTranscript('');

    // Detect gesture from keywords
    if (voiceRecorderRef.current) {
      const kw = voiceRecorderRef.current.detectKeywords(transcript);
      if (kw) setCurrentGesture(kw);
    }

    // Add user message to chat UI
    const userMsg = { role: 'user', text: transcript, id: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);

    // Transition to thinking state
    setIsThinking(true);
    setSpeechBubbleText('...');

    try {
      // Call Groq (primary — ultra-fast), fallback to Gemini
      const persona = photoNameRef.current || avatarPersonaRef.current || '';
      const history = conversationHistoryRef.current;
      let response;
      const groqKey = import.meta.env.VITE_GROQ_API_KEY;
      if (groqKey && groqKey.trim() !== '') {
        response = await askGroq(transcript, persona, history);
      } else {
        response = await askGemini(transcript, persona, history);
      }

      // Update history
      const newHistory = [
        ...history,
        { role: 'user', text: transcript },
        { role: 'model', text: response }
      ];
      setConversationHistory(newHistory);

      // Add AI message to chat UI
      const aiMsg = { role: 'model', text: response, id: Date.now() + 1 };
      setChatMessages(prev => [...prev, aiMsg]);

      // Handle speech end
      const onEnded = () => {
        setIsSpeaking(false);
        setCurrentGesture('idle');
        setMouthOpenAmount(0);
        if (activeLipSyncRef.current) {
          activeLipSyncRef.current.stopLoop();
          activeLipSyncRef.current = null;
        }
        activeAudioRef.current = null;
        // Auto-restart in continuous mode
        if (continuousModeRef.current) {
          setTimeout(() => startListeningInternalRef.current?.(), 350);
        }
      };

      // Keep thinking state active while fetching the ElevenLabs audio stream
      // Speak via ElevenLabs (or browser TTS fallback)
      const audio = await speakText(
        response, 
        'Rachel', 
        (audioObj) => {
          // This callback fires EXACTLY when the audio physically begins playing!
          setIsThinking(false);
          setSpeechBubbleText(response);
          setIsSpeaking(true);
          
          // Start lip sync analyzer perfectly in sync with playback
          const lipSync = new LipSyncAnalyzer(audioObj);
          activeLipSyncRef.current = lipSync;
          lipSync.startLoop((amount) => setMouthOpenAmount(amount));
        },
        onEnded // Pass onEnded callback so elevenLabs.js handles it when audio finishes!
      );

      if (!audio) {
        setIsThinking(false);
        setSpeechBubbleText(response);
        setIsSpeaking(false);
        if (continuousModeRef.current) {
          setTimeout(() => startListeningInternalRef.current?.(), 400);
        }
        return;
      }

      activeAudioRef.current = audio;

    } catch (err) {
      console.error('Interaction Loop Error:', err);
      const errText = err.message?.includes('API Key') || err.message?.includes('API_KEY')
        ? '⚠️ Gemini API key missing. Add VITE_GEMINI_API_KEY to your .env file.'
        : '❌ Something went wrong. Please try again.';
      setSpeechBubbleText(errText);
      setChatMessages(prev => [...prev, { role: 'model', text: errText, id: Date.now() + 2, isError: true }]);
      setIsThinking(false);
      setIsSpeaking(false);
    }
  }, [cleanupAudio]);

  // Keep handleSpeak ref updated
  handleSpeakRef.current = handleSpeak;

  // ── Toggle Listening ───────────────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    if (isListening) {
      if (voiceRecorderRef.current) voiceRecorderRef.current.stopListening();
      setIsListening(false);
      setLiveTranscript('');
    } else {
      if (isSpeakingRef.current) return;
      cleanupAudio();
      startListeningInternal();
    }
  }, [isListening, cleanupAudio, startListeningInternal]);

  // ── Continuous Mode Controls ───────────────────────────────────────────────
  const startContinuousMode = useCallback(() => {
    setConversationMode('continuous');
    continuousModeRef.current = true;
    if (!isListening && !isSpeakingRef.current) {
      setTimeout(() => startListeningInternalRef.current?.(), 150);
    }
  }, [isListening]);

  const stopContinuousMode = useCallback(() => {
    setConversationMode('push-to-talk');
    continuousModeRef.current = false;
    if (isListening) {
      if (voiceRecorderRef.current) voiceRecorderRef.current.stopListening();
      setIsListening(false);
      setLiveTranscript('');
    }
  }, [isListening]);

  // ── Clear / Reset ──────────────────────────────────────────────────────────
  const clearConversation = useCallback(() => {
    cleanupAudio();
    if (voiceRecorderRef.current) voiceRecorderRef.current.stopListening();
    setChatMessages([]);
    setConversationHistory([]);
    setSpeechBubbleText('');
    setCurrentGesture('idle');
    setLiveTranscript('');
    setIsListening(false);
    setIsThinking(false);
    setIsSpeaking(false);
  }, [cleanupAudio]);

  const resetSession = useCallback(() => {
    cleanupAudio();
    if (voiceRecorderRef.current) voiceRecorderRef.current.stopListening();
    setUploadedImage(null);
    setPhotoName('');
    setFaceTexture(null);
    setChatMessages([]);
    setConversationHistory([]);
    setSpeechBubbleText('');
    setCurrentGesture('idle');
    setLiveTranscript('');
    setIsListening(false);
    setIsThinking(false);
    setIsSpeaking(false);
    setConversationMode('push-to-talk');
    setScreen('upload');
  }, [cleanupAudio]);

  return (
    <AppContext.Provider value={{
      screen, setScreen,
      uploadedImage, setUploadedImage,
      uploadedFaceInfo, setUploadedFaceInfo,
      photoName, setPhotoName,
      faceTexture, setFaceTexture,
      selectedOutfit, setSelectedOutfit,
      selectedBackground, setSelectedBackground,
      isListening, setIsListening,
      isSpeaking, setIsSpeaking,
      isThinking, setIsThinking,
      speechBubbleText, setSpeechBubbleText,
      liveTranscript,
      chatMessages,
      conversationHistory, setConversationHistory,
      currentGesture, setCurrentGesture,
      mouthOpenAmount, setMouthOpenAmount,
      micVolume, setMicVolume,
      customError, setCustomError,
      conversationMode, setConversationMode,
      avatarPersona, setAvatarPersona,
      toggleListening,
      handleSpeak,
      startContinuousMode,
      stopContinuousMode,
      clearConversation,
      resetSession,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
