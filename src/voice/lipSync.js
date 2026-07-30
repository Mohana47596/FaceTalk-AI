export class LipSyncAnalyzer {
  constructor(audioElement) {
    this.audioElement = audioElement;
    this.animationId = null;
    this.isSimulated = false;

    // Check if we are using the browser local speech fallback
    if (audioElement && (audioElement.localSpeech || !audioElement.tagName)) {
      this.isSimulated = true;
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      // Connect HTML5 Audio Element to analyzer
      this.source = this.audioContext.createMediaElementSource(audioElement);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    } catch (e) {
      console.warn("LipSync fallback mode activated:", e);
      this.isSimulated = true;
    }
  }

  getMouthOpen() {
    let targetVol = 0;

    if (this.isSimulated) {
      // Procedural fallback: generate speaking syllables based on slower sine waves and minimal noise
      const time = Date.now() * 0.008; // slower time scale
      const baseWave = Math.sin(time * 1.5) * Math.sin(time * 0.5);
      const randomJitter = Math.random() * 0.05; // heavily reduced jitter
      let val = Math.abs(baseWave) + randomJitter;
      val = 0.05 + val * 0.6; // map to softer range
      targetVol = Math.min(Math.max(val, 0), 1);
    } else {
      if (!this.analyser || !this.dataArray) return this.smoothedVolume || 0;
      try {
        this.analyser.getByteFrequencyData(this.dataArray);
        // Average the vocal frequency bands (roughly 100Hz - 2000Hz)
        const avg = this.dataArray.slice(1, 15).reduce((a, b) => a + b, 0) / 14;
        
        // Filter out low hums and amplify speech frequencies with a non-linear curve
        if (avg < 5) {
          targetVol = 0;
        } else {
          // Pow curve makes loud sounds pop more and quiet sounds less dominant
          const normalized = avg / 110;
          targetVol = Math.min(Math.pow(normalized, 1.2), 1.0);
        }
      } catch (e) {
        targetVol = 0;
      }
    }

    // Initialize if empty
    if (this.smoothedVolume === undefined) this.smoothedVolume = 0;

    // Apply Exponential Moving Average with Fast Attack and Fast Decay
    // Opening mouth is very fast, closing is slightly slower but still snappy
    const lerpSpeed = targetVol > this.smoothedVolume ? 0.6 : 0.4;
    this.smoothedVolume += (targetVol - this.smoothedVolume) * lerpSpeed;

    // Hard clamp to 0 if almost closed so the mouth doesn't "float" open between words
    if (this.smoothedVolume < 0.05) this.smoothedVolume = 0;

    return this.smoothedVolume;
  }

  startLoop(callback) {
    const loop = () => {
      callback(this.getMouthOpen());
      this.animationId = requestAnimationFrame(loop);
    };
    loop();
  }

  stopLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        this.audioContext.close();
      } catch (e) {}
    }
  }
}
