const defaultVoices = {
  Adam: "pNInz6obpgq5paqqJJAx",
  Antoni: "ErXwobaYiN019PkySvjV",
  Arnold: "ODq5zmih86Woc27BG92b", // Using standard high quality male voice ID for Arnold
  Rachel: "21m00Tcm4TlvDq8ikWAM", // Standard female voice
  Bella: "EXAVITQu4vr4xnSDxMaL",  // Soft female voice
  Gandhi: "pNInz6obpgq5paqqJJAx",
  Einstein: "ErXwobaYiN019PkySvjV",
  Kalam: "ODq5zmih86Woc27BG92b"
};

export async function speakText(text, voiceId, onPlay, onEnded) {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  
  // Resolve voice ID
  let resolvedVoiceId = voiceId;
  if (defaultVoices[voiceId]) {
    resolvedVoiceId = defaultVoices[voiceId];
  } else if (!voiceId) {
    resolvedVoiceId = defaultVoices.Adam; // default fallback
  }

  // Fallback to local speechSynthesis if API key is missing
  if (!apiKey || apiKey === "your_elevenlabs_key_here" || apiKey === "") {
    console.warn("ElevenLabs API Key is missing. Falling back to browser SpeechSynthesis.");
    return speakLocalText(text, voiceId, onPlay, onEnded);
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs returned status ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    // Set up cross-origin to allow Web Audio API analysis
    audio.crossOrigin = "anonymous";
    
    audio.onplay = () => {
      if (onPlay) onPlay(audio);
    };
    audio.onended = () => {
      if (onEnded) onEnded();
    };
    audio.onerror = (e) => {
      console.error("Audio playback error, falling back to local speech synthesis:", e);
      speakLocalText(text, voiceId, onPlay, onEnded);
    };
    
    await audio.play();
    return audio;
  } catch (error) {
    console.error("ElevenLabs error, falling back to local speech synthesis:", error);
    return speakLocalText(text, voiceId, onPlay, onEnded);
  }
}

// Browser Speech Synthesis Fallback
function speakLocalText(text, voiceId, onPlay, onEnded) {
  if (!('speechSynthesis' in window)) {
    console.error("Speech Synthesis not supported in this browser.");
    if (onEnded) onEnded();
    return null;
  }

  // Stop any active speaking
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  // CRITICAL FIX: Keep utterance globally referenced to prevent Chrome garbage collection bug
  // If Chrome GC's the utterance before it finishes, onend never fires!
  window._activeUtterance = utterance;
  
  // Try to find a nice male or female voice depending on the name
  const voices = window.speechSynthesis.getVoices();
  let selectedVoice = null;
  
  if (voices && voices.length > 0) {
    // Map voices by looking at name
    if (voiceId && (voiceId.toLowerCase().includes("rachel") || voiceId.toLowerCase().includes("bella"))) {
      selectedVoice = voices.find(v => v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("samantha")) || voices.find(v => v.lang.startsWith("en"));
    } else if (voiceId && voiceId.toLowerCase().includes("antoni") || voiceId.toLowerCase().includes("einstein")) {
      selectedVoice = voices.find(v => v.name.toLowerCase().includes("google us english") || v.name.toLowerCase().includes("male") || v.lang.startsWith("en"));
    } else if (voiceId && voiceId.toLowerCase().includes("arnold") || voiceId.toLowerCase().includes("kalam")) {
      selectedVoice = voices.find(v => v.name.toLowerCase().includes("google uk english") || v.lang.startsWith("en"));
    } else {
      selectedVoice = voices.find(v => v.lang.startsWith("en"));
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  }

  // Speed and pitch settings
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // We construct a mock audio object that has similar callbacks to act as a bridge
  const mockAudio = {
    localSpeech: true,
    utterance: utterance,
    stop: () => {
      window.speechSynthesis.cancel();
    }
  };

  utterance.onstart = () => {
    if (onPlay) onPlay(mockAudio);
  };

  utterance.onend = () => {
    if (onEnded) onEnded();
  };

  utterance.onerror = (e) => {
    console.error("SpeechSynthesis error:", e);
    if (onEnded) onEnded();
  };

  window.speechSynthesis.speak(utterance);
  return mockAudio;
}

export async function getAudioDuration(audioElement) {
  if (audioElement && !audioElement.localSpeech) {
    return audioElement.duration;
  }
  return 0; // Local speech synthesis duration is calculated dynamically
}
