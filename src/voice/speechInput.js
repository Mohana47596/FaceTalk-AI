export class VoiceRecorder {
  constructor() {
    // Obtain browser speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = SpeechRecognition ? new SpeechRecognition() : null;
    
    if (this.recognition) {
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-IN";
    }

    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.dataArray = null;
    this.stream = null;
    this.isListening = false;
    this.onResultCallback = null;
    this.onVolumeCallback = null;
    this.onErrorCallback = null;
    this.animationFrameId = null;
  }

  startListening(onResult, onVolume, onError) {
    if (!this.recognition) {
      if (onError) onError(new Error("Speech Recognition not supported in this browser. Please use Chrome or Edge."));
      return;
    }

    this.onResultCallback = onResult;
    this.onVolumeCallback = onVolume;
    this.onErrorCallback = onError;

    this.recognition.onstart = () => {
      this.isListening = true;
      window.dispatchEvent(new CustomEvent("mic_active"));
      this.setupVolumeAnalyzer();
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (this.onResultCallback) {
        this.onResultCallback({
          interim: interimTranscript,
          final: finalTranscript
        });
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      window.dispatchEvent(new CustomEvent("mic_inactive"));
      this.stopVolumeAnalyzer();
    };

    this.recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error(`Speech recognition error: ${event.error}`));
      }
      this.stopListening();
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
      if (onError) onError(e);
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
    this.stopVolumeAnalyzer();
  }

  async setupVolumeAnalyzer() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!this.isListening || !this.analyser) return;
        this.analyser.getByteFrequencyData(this.dataArray);
        const average = this.dataArray.reduce((a, b) => a + b, 0) / this.dataArray.length;
        
        // Convert to a nice 0 - 100 range
        const volumeLevel = Math.min(Math.round((average / 128) * 100), 100);
        if (this.onVolumeCallback) {
          this.onVolumeCallback(volumeLevel);
        }
        this.animationFrameId = requestAnimationFrame(checkVolume);
      };
      
      checkVolume();
    } catch (err) {
      console.warn("Could not access microphone for volume animation:", err);
    }
  }

  stopVolumeAnalyzer() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    if (this.onVolumeCallback) {
      this.onVolumeCallback(0);
    }
  }

  detectKeywords(transcript) {
    if (!transcript) return null;
    const lower = transcript.toLowerCase();

    const keywords = {
      sad: ["sad", "depressed", "upset", "lonely", "sorrow", "crying"],
      funny: ["funny", "joke", "laugh", "haha", "humor", "hilarious"],
      hello: ["hello", "hi", "hey", "namaste", "greetings"],
      bye: ["bye", "goodbye", "see you", "farewell", "quit"]
    };

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => lower.includes(word))) {
        return category;
      }
    }

    return null;
  }
}
