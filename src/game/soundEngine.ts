import { useGameStore } from '../store/useGameStore';
import type { WeaponId } from './rules';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffers: Map<number, AudioBuffer> = new Map();

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getVolumeGain(): number {
    const { masterVolume, soundEffects } = useGameStore.getState().settings;
    return Math.max(0, Math.min(1, (masterVolume / 100) * (soundEffects / 100)));
  }

  /**
   * Generates or retrieves a reusable white noise buffer for realistic transient cracks,
   * mechanical friction, and reverb tails.
   */
  private getNoiseBuffer(ctx: AudioContext, duration = 1.0): AudioBuffer {
    const durKey = Math.round(duration * 10);
    const existing = this.noiseBuffers.get(durKey);
    if (existing) return existing;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffers.set(durKey, buffer);
    return buffer;
  }

  /**
   * High-fidelity procedural gunshot audio synthesis.
   * Combines supersonic crack transient, high-pressure chamber explosion,
   * punchy sub-bass body, and environmental acoustic tail.
   */
  public playShot(weaponId: WeaponId, volumeScale = 1.0) {
    if (weaponId === 'lidl_scanner') {
      this.playLidlScannerSound();
      return;
    }
    if (weaponId === 'pan') {
      this.playPanClangSound();
      return;
    }

    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getVolumeGain() * Math.max(0.05, Math.min(1.5, volumeScale));
    if (vol <= 0.01) return;

    const now = ctx.currentTime;
    const noiseBuffer = this.getNoiseBuffer(ctx, 0.6);

    // Weapon-specific audio profiles
    let crackFilterFreq = 3200;
    let crackDuration = 0.035;
    let crackGainVal = 0.55;

    let subStartFreq = 160;
    let subEndFreq = 38;
    let subDuration = 0.14;
    let subGainVal = 0.45;

    let bodyFilterFreq = 780;
    let tailDuration = 0.32;
    let tailGainVal = 0.3;

    if (weaponId === 'assault') {
      // Crisp 5.56mm military assault rifle: punchy mechanical snap + solid thud + outdoor reflection
      crackFilterFreq = 3400;
      crackDuration = 0.04;
      crackGainVal = 0.58;
      subStartFreq = 145;
      subEndFreq = 42;
      subDuration = 0.15;
      subGainVal = 0.48;
      bodyFilterFreq = 950;
      tailDuration = 0.35;
      tailGainVal = 0.32;
    } else if (weaponId === 'sniper') {
      // Thunderous heavy .50cal sniper rifle: massive supersonic crack, deep sub-bass blast, long reverberation
      crackFilterFreq = 4200;
      crackDuration = 0.06;
      crackGainVal = 0.72;
      subStartFreq = 120;
      subEndFreq = 28;
      subDuration = 0.32;
      subGainVal = 0.75;
      bodyFilterFreq = 580;
      tailDuration = 0.58;
      tailGainVal = 0.45;
    } else if (weaponId === 'shotgun') {
      // 12-Gauge blast: wide concussive blast, deep low-end punch, multiple pellet snap
      crackFilterFreq = 2200;
      crackDuration = 0.055;
      crackGainVal = 0.68;
      subStartFreq = 130;
      subEndFreq = 32;
      subDuration = 0.24;
      subGainVal = 0.65;
      bodyFilterFreq = 480;
      tailDuration = 0.42;
      tailGainVal = 0.38;
    } else if (weaponId === 'smg') {
      // Rapid 9mm vector burst: fast snappy transient, tight pop, short clean cutoff
      crackFilterFreq = 3800;
      crackDuration = 0.024;
      crackGainVal = 0.45;
      subStartFreq = 190;
      subEndFreq = 55;
      subDuration = 0.09;
      subGainVal = 0.36;
      bodyFilterFreq = 1100;
      tailDuration = 0.18;
      tailGainVal = 0.22;
    } else if (weaponId === 'semi_sniper') {
      // 7.62mm DMR marksman rifle: sharp authoritative report, tight mechanical punch
      crackFilterFreq = 3600;
      crackDuration = 0.045;
      crackGainVal = 0.62;
      subStartFreq = 140;
      subEndFreq = 35;
      subDuration = 0.2;
      subGainVal = 0.52;
      bodyFilterFreq = 720;
      tailDuration = 0.4;
      tailGainVal = 0.35;
    }

    // 1. Initial Supersonic Crack / Transient
    const crackSource = ctx.createBufferSource();
    crackSource.buffer = noiseBuffer;
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'highpass';
    crackFilter.frequency.setValueAtTime(crackFilterFreq, now);

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(crackGainVal * vol, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + crackDuration);

    crackSource.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    crackSource.start(now);
    crackSource.stop(now + crackDuration);

    // 2. Punchy Sub-Bass Body & Chamber Impulse
    const subOsc = ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(subStartFreq, now);
    subOsc.frequency.exponentialRampToValueAtTime(subEndFreq, now + subDuration);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(subGainVal * vol, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + subDuration);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + subDuration);

    // 3. Mid-frequency Mechanical Punch & Environmental Acoustic Reverb Tail
    const tailSource = ctx.createBufferSource();
    tailSource.buffer = noiseBuffer;
    const tailFilter = ctx.createBiquadFilter();
    tailFilter.type = 'bandpass';
    tailFilter.frequency.setValueAtTime(bodyFilterFreq, now);
    tailFilter.Q.setValueAtTime(1.8, now);

    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(tailGainVal * vol, now);
    tailGain.gain.exponentialRampToValueAtTime(0.001, now + tailDuration);

    tailSource.connect(tailFilter);
    tailFilter.connect(tailGain);
    tailGain.connect(ctx.destination);
    tailSource.start(now);
    tailSource.stop(now + tailDuration);
  }

  /**
   * Authentic tactical friction slide sound:
   * Dynamic concrete friction scrape, whoosh displacement, and low thump.
   */
  public playSlideSound() {
    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getVolumeGain();
    if (vol <= 0.01) return;

    const now = ctx.currentTime;
    const noiseBuffer = this.getNoiseBuffer(ctx, 0.8);
    const duration = 0.42;

    // 1. Friction Scrape Noise with frequency sweep (tarmac/concrete scrape)
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(450, now + duration);
    filter.Q.setValueAtTime(1.4, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.38 * vol, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noiseSource.start(now);
    noiseSource.stop(now + duration);

    // 2. Low-frequency ground whoosh / weight impact
    const whooshOsc = ctx.createOscillator();
    whooshOsc.type = 'sine';
    whooshOsc.frequency.setValueAtTime(130, now);
    whooshOsc.frequency.exponentialRampToValueAtTime(45, now + 0.28);

    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.24 * vol, now);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    whooshOsc.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    whooshOsc.start(now);
    whooshOsc.stop(now + 0.31);
  }

  /**
   * Tactical flesh/armor damage impact thud when player receives damage.
   */
  public playDamageTakenSound() {
    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getVolumeGain();
    if (vol <= 0.01) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.16);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.42 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * Supermarket Barcode Scanner "BEEP!" + 4-note Lidl chime
   */
  public playLidlScannerSound() {
    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getVolumeGain();
    if (vol <= 0.01) return;

    const now = ctx.currentTime;

    const beepOsc = ctx.createOscillator();
    const beepGain = ctx.createGain();
    beepOsc.type = 'square';
    beepOsc.frequency.setValueAtTime(2650, now);
    beepGain.gain.setValueAtTime(0.26 * vol, now);
    beepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    beepOsc.connect(beepGain);
    beepGain.connect(ctx.destination);
    beepOsc.start(now);
    beepOsc.stop(now + 0.095);

    const notes = [
      { freq: 1174.66, start: 0.1, dur: 0.085 },
      { freq: 1318.51, start: 0.19, dur: 0.085 },
      { freq: 1479.98, start: 0.28, dur: 0.095 },
      { freq: 1760.0, start: 0.38, dur: 0.22 },
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, now + n.start);
      g.gain.setValueAtTime(0.22 * vol, now + n.start);
      g.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.01);
    }
  }

  /**
   * Resonant heavy cast-iron skillet melee hit clang sound!
   */
  public playPanClangSound() {
    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getVolumeGain();
    if (vol <= 0.01) return;

    const now = ctx.currentTime;
    const freqs = [520, 840, 1320, 2150];
    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freqs[i], now);
      const intensity = (0.28 / (i + 1)) * vol;
      g.gain.setValueAtTime(intensity, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35 + (3 - i) * 0.08);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
    }
  }

  public playPickupSound(itemType: 'vape_smoke' | 'kong_strong' | 'choco_croissant' | 'street_dart') {
    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getVolumeGain();
    if (vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (itemType === 'street_dart') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.35);
    } else if (itemType === 'kong_strong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(1180, now + 0.22);
    } else if (itemType === 'choco_croissant') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(720, now);
      osc.frequency.exponentialRampToValueAtTime(1040, now + 0.12);
    }

    gain.gain.setValueAtTime(0.2 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playVapeThrowAndPuffSound() {
    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getVolumeGain();
    if (vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.28);

    gain.gain.setValueAtTime(0.22 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.31);
  }

  public playScooterMountSound(mounting: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getVolumeGain();
    if (vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(mounting ? 520 : 780, now);
    osc.frequency.exponentialRampToValueAtTime(mounting ? 880 : 440, now + 0.16);

    gain.gain.setValueAtTime(0.18 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playHitmarker(headshot: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getVolumeGain();
    if (vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(headshot ? 1680 : 1120, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 2250 : 820, now + 0.055);

    gain.gain.setValueAtTime(0.24 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playReload() {
    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getVolumeGain();
    if (vol <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.setValueAtTime(590, now + 0.12);

    gain.gain.setValueAtTime(0.14 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }
}

export const soundEngine = new SoundEngine();
