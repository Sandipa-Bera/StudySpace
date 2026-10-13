/**
 * audioAlert.ts
 * ─────────────────────────────────────────────────────────────
 * Web Audio API synthesizer for the continuous Pomodoro alarm.
 * Features:
 * - High-quality dual-tone harmonic chime (clean & pleasant, not harsh)
 * - Loops indefinitely until explicitly stopped by the user
 * - Respects configurable volume level
 * - Handles AudioContext unlocking on user gestures
 * - Prevents duplicate audio loops across re-renders
 * - Safe resource cleanup on unmount
 */

class AudioAlertEngine {
  private ctx: AudioContext | null = null;
  private isRinging: boolean = false;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private volume: number = 0.7; // Default 70%

  /**
   * Initializes or gets existing AudioContext.
   * Safe to call on user interaction to unlock browser autoplay policy.
   */
  public init(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!this.ctx && AudioContextClass) {
        this.ctx = new AudioContextClass();
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {
          // Will resume on next user gesture
        });
      }
    } catch (e) {
      console.warn('Web Audio API not supported or initialization failed:', e);
    }

    return this.ctx;
  }

  /**
   * Set volume in range 0 - 100
   */
  public setVolume(volPercent: number) {
    this.volume = Math.max(0, Math.min(1, volPercent / 100));
  }

  /**
   * Plays a single melodic double-beep chime
   */
  private playChimeOnce() {
    const ctx = this.init();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);

      // Master volume scale
      const maxGain = 0.35 * this.volume;
      if (maxGain <= 0.001) return; // Muted

      // Tone 1: 587.33 Hz (D5) -> 0.18s
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);

      // Tone 2: 880.00 Hz (A5) -> 0.28s
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.16);

      // Volume envelope for tone 1
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(maxGain, now + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      // Volume envelope for tone 2
      gainNode.gain.setValueAtTime(0.0001, now + 0.18);
      gainNode.gain.exponentialRampToValueAtTime(maxGain * 1.1, now + 0.21);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      osc1.connect(gainNode);
      osc2.connect(gainNode);

      osc1.start(now);
      osc1.stop(now + 0.19);

      osc2.start(now + 0.18);
      osc2.stop(now + 0.46);

      this.activeOscillators.push(osc1, osc2);

      // Cleanup finished oscillator references
      setTimeout(() => {
        this.activeOscillators = this.activeOscillators.filter(
          (o) => o !== osc1 && o !== osc2
        );
      }, 500);
    } catch (err) {
      console.warn('Failed to play alarm chime:', err);
    }
  }

  /**
   * Starts repeating alarm chime until explicitly stopped.
   * Idempotent: safe if called multiple times.
   */
  public startAlarm(volumePercent?: number) {
    if (volumePercent !== undefined) {
      this.setVolume(volumePercent);
    }

    if (this.isRinging) return;
    this.isRinging = true;

    // Play immediately
    this.playChimeOnce();

    // Repeat every 1100ms
    if (this.loopTimer) clearInterval(this.loopTimer);
    this.loopTimer = setInterval(() => {
      if (this.isRinging) {
        this.playChimeOnce();
      }
    }, 1100);
  }

  /**
   * Stops the repeating alarm immediately and cleans up active nodes.
   */
  public stopAlarm() {
    this.isRinging = false;
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }

    // Stop any in-flight oscillators
    for (const osc of this.activeOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // already stopped
      }
    }
    this.activeOscillators = [];
  }

  /**
   * Play a quick single test beep for setting volume
   */
  public testBeep(volumePercent: number) {
    this.setVolume(volumePercent);
    this.playChimeOnce();
  }

  /**
   * Check if alarm is currently ringing
   */
  public isActive(): boolean {
    return this.isRinging;
  }
}

export const audioAlert = new AudioAlertEngine();
