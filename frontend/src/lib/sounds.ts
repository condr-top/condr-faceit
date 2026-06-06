/**
 * Web Audio API sound generator — no audio files needed.
 * All sounds are synthesized programmatically.
 */

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return ctx
}

function gain(ac: AudioContext, value: number): GainNode {
  const g = ac.createGain()
  g.gain.value = value
  g.connect(ac.destination)
  return g
}

// ── Click / queue join ────────────────────────────────────────────────────────
export function playQueueJoin() {
  try {
    const ac = getCtx()
    const now = ac.currentTime

    // Short punchy click: sine sweep + small pop
    const osc = ac.createOscillator()
    const g   = gain(ac, 0)
    osc.connect(g)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, now)
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.06)
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.18, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    osc.start(now)
    osc.stop(now + 0.13)

    // Second harmonic for body
    const osc2 = ac.createOscillator()
    const g2   = gain(ac, 0)
    osc2.connect(g2)
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(880, now)
    osc2.frequency.exponentialRampToValueAtTime(660, now + 0.08)
    g2.gain.setValueAtTime(0, now)
    g2.gain.linearRampToValueAtTime(0.10, now + 0.01)
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.10)
    osc2.start(now)
    osc2.stop(now + 0.11)
  } catch {}
}

// ── Leave queue ───────────────────────────────────────────────────────────────
export function playQueueLeave() {
  try {
    const ac = getCtx()
    const now = ac.currentTime
    const osc = ac.createOscillator()
    const g   = gain(ac, 0)
    osc.connect(g)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.1)
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.14, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    osc.start(now)
    osc.stop(now + 0.15)
  } catch {}
}

// ── Match found — distinctive 3-tone ascending chime ─────────────────────────
export function playMatchFound() {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const notes = [523, 659, 784] // C5 E5 G5 — major chord arp

    notes.forEach((freq, i) => {
      const t   = now + i * 0.12
      const osc = ac.createOscillator()
      const g   = gain(ac, 0)
      osc.connect(g)
      osc.type = 'sine'
      osc.frequency.value = freq
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.22, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      osc.start(t)
      osc.stop(t + 0.31)

      // Shimmer overtone
      const osc2 = ac.createOscillator()
      const g2   = gain(ac, 0)
      osc2.connect(g2)
      osc2.type = 'triangle'
      osc2.frequency.value = freq * 2
      g2.gain.setValueAtTime(0, t)
      g2.gain.linearRampToValueAtTime(0.06, t + 0.02)
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
      osc2.start(t)
      osc2.stop(t + 0.21)
    })
  } catch {}
}

// ── Ready check pulse — urgent double-beep ───────────────────────────────────
export function playReadyCheck() {
  try {
    const ac  = getCtx()
    const now = ac.currentTime

    ;[0, 0.18].forEach(offset => {
      const t   = now + offset
      const osc = ac.createOscillator()
      const g   = gain(ac, 0)
      osc.connect(g)
      osc.type = 'square'
      osc.frequency.value = 880
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.08, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
      osc.start(t)
      osc.stop(t + 0.13)
    })
  } catch {}
}
