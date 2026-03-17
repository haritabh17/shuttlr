/**
 * Web Audio API buzzer sounds for session events.
 *
 * Two sounds:
 *   1. selectionBeep — short double-beep (800 Hz) when new round is selected
 *   2. gameOverBuzzer — longer sustained buzz (400 Hz) when game time ends
 *
 * Browser policy: AudioContext must be resumed after a user gesture.
 * Call `unlockAudio()` on the first tap/click (e.g. "Start Session" or "Join").
 */

let ctx: AudioContext | null = null;
let muted = false;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

/** Call on first user interaction to satisfy browser autoplay policy. */
export function unlockAudio(): void {
  const c = getContext();
  if (c.state === "suspended") {
    c.resume();
  }
}

export function setMuted(m: boolean): void {
  muted = m;
}

export function isMuted(): boolean {
  return muted;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "square",
  gain = 0.3
): void {
  if (muted) return;
  try {
    const c = getContext();
    if (c.state === "suspended") return; // not unlocked yet

    const osc = c.createOscillator();
    const vol = c.createGain();

    osc.type = type;
    osc.frequency.value = frequency;
    vol.gain.value = gain;

    // Fade out at the end to avoid click
    vol.gain.setValueAtTime(gain, c.currentTime + duration - 0.05);
    vol.gain.linearRampToValueAtTime(0, c.currentTime + duration);

    osc.connect(vol);
    vol.connect(c.destination);

    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch {
    // Silently fail — audio is a nice-to-have
  }
}

/**
 * Selection beep: repeating double-beeps for 3 seconds.
 * "New round selected — check who's playing!"
 */
export function selectionBeep(): void {
  if (muted) return;
  // Double-beep pattern every 600ms for 3 seconds (5 pairs)
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      playTone(800, 0.15, "square", 0.25);
      setTimeout(() => playTone(800, 0.15, "square", 0.25), 200);
    }, i * 600);
  }
}

/**
 * Game-over buzzer: repeating buzz pulses for 6 seconds.
 * "Time's up — get off the court!"
 */
export function gameOverBuzzer(): void {
  if (muted) return;
  // 0.8s buzz with 0.4s gap, repeated for 6 seconds (5 pulses)
  for (let i = 0; i < 5; i++) {
    setTimeout(() => playTone(400, 0.8, "sawtooth", 0.3), i * 1200);
  }
}
