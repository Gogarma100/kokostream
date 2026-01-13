// Base64 decoding helper
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Decodes raw PCM data from Gemini into an AudioBuffer
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert Int16 PCM to Float32 [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

let audioContext: AudioContext | null = null;

export const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000, // Gemini default for TTS
    });
  }
  return audioContext;
};

// Procedural Music Generator
// Uses oscillators to create ambient drones without external assets
export class AmbientGenerator {
  private ctx: AudioContext;
  private nodes: AudioNode[] = [];
  private masterGain: GainNode;

  constructor() {
    this.ctx = getAudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.05; // Default low background volume
  }

  setVolume(volume: number) {
    this.masterGain.gain.setValueAtTime(volume, this.ctx.currentTime);
  }

  play(mood: string) {
    this.stop();
    if (mood === 'none' || !mood) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    
    // Ramp up volume
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0, now);
    this.masterGain.gain.linearRampToValueAtTime(0.08, now + 2);

    if (mood === 'ethereal') {
        // Major chord pad (A Major 7)
        // A3, C#4, E4, G#4
        this.createOscillator(220.00, 'sine', 0); 
        this.createOscillator(277.18, 'sine', 0.1); 
        this.createOscillator(329.63, 'sine', 0.2); 
        this.createOscillator(415.30, 'triangle', 0.1, true); // Low pass on the 7th
    } else if (mood === 'suspense') {
        // Dark, dissonant drone
        // Low rumble + tritone
        this.createOscillator(55.00, 'sawtooth', 0, true); // A1
        this.createOscillator(110.00, 'triangle', 0); // A2
        this.createOscillator(116.50, 'sine', 0.1); // Dissonant beating
    } else if (mood === 'scifi') {
        // Futuristic texture
        // Filtered sawtooth with LFO
        this.createOscillator(110, 'sawtooth', 0, true, true);
        this.createOscillator(220, 'square', 0, true);
    }
  }

  private createOscillator(freq: number, type: OscillatorType, delay: number = 0, filter = false, lfo = false) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      
      const gain = this.ctx.createGain();
      gain.gain.value = 0.15;
      
      let lastNode: AudioNode = osc;

      if (filter) {
          const biquad = this.ctx.createBiquadFilter();
          biquad.type = "lowpass";
          biquad.frequency.value = 400;
          lastNode.connect(biquad);
          lastNode = biquad;
      }

      if (lfo) {
         const lfoOsc = this.ctx.createOscillator();
         lfoOsc.type = 'sine';
         lfoOsc.frequency.value = 0.5; // 0.5 Hz
         const lfoGain = this.ctx.createGain();
         lfoGain.gain.value = 200; // Modulate filter frequency
         
         if (lastNode instanceof BiquadFilterNode) {
             lfoOsc.connect(lfoGain);
             lfoGain.connect(lastNode.frequency);
             lfoOsc.start();
             this.nodes.push(lfoOsc);
             this.nodes.push(lfoGain);
         }
      }
      
      lastNode.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(this.ctx.currentTime + delay);
      
      this.nodes.push(osc);
      this.nodes.push(gain);
      if (lastNode !== osc) this.nodes.push(lastNode);
  }

  stop() {
     const now = this.ctx.currentTime;
     // Fade out
     this.masterGain.gain.cancelScheduledValues(now);
     this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
     this.masterGain.gain.linearRampToValueAtTime(0, now + 1);

     setTimeout(() => {
        this.nodes.forEach(node => {
            try {
                if (node instanceof OscillatorNode) node.stop();
                node.disconnect();
            } catch(e) {}
        });
        this.nodes = [];
     }, 1100);
  }
}