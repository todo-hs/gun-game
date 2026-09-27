// WebAudio で鳴らす効果音（音声ファイル不要）

export const SFX = {
    ctx: null,
    muted: false,

    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) this.ctx = new AC();
        } catch (e) { this.ctx = null; }
    },

    tone(f1, f2, dur, type = 'square', vol = 0.06, delay = 0) {
        const c = this.ctx;
        const t = c.currentTime + delay;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f1, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(c.destination);
        o.start(t);
        o.stop(t + dur + 0.02);
    },

    noise(dur, vol = 0.08, filter = 0, type = 'highpass', delay = 0) {
        const c = this.ctx;
        const t = c.currentTime + delay;
        const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = c.createBufferSource();
        const g = c.createGain();
        g.gain.value = vol;
        src.buffer = buf;
        if (filter) {
            const f = c.createBiquadFilter();
            f.type = type;
            f.frequency.value = filter;
            src.connect(f).connect(g).connect(c.destination);
        } else {
            src.connect(g).connect(c.destination);
        }
        src.start(t);
    },

    // ノコギリ波をフォルマント風のバンドパスに通して「ニャー」
    meow(pitch = 1, len = 0.55) {
        const c = this.ctx;
        const t = c.currentTime;
        const o = c.createOscillator();
        const f1 = c.createBiquadFilter();
        const f2 = c.createBiquadFilter();
        const g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(480 * pitch, t);
        o.frequency.linearRampToValueAtTime(700 * pitch, t + len * 0.3);
        o.frequency.linearRampToValueAtTime(420 * pitch, t + len);
        [f1, f2].forEach(f => { f.type = 'bandpass'; f.Q.value = 6; });
        f1.frequency.setValueAtTime(800, t);
        f1.frequency.linearRampToValueAtTime(1300, t + len * 0.35);
        f1.frequency.linearRampToValueAtTime(700, t + len);
        f2.frequency.setValueAtTime(2400, t);
        f2.frequency.linearRampToValueAtTime(3000, t + len * 0.35);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.3, t + 0.06);
        g.gain.setValueAtTime(0.3, t + len * 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(f1).connect(g);
        o.connect(f2).connect(g);
        g.connect(c.destination);
        o.start(t);
        o.stop(t + len + 0.05);
    },

    play(name, arg) {
        if (!this.ctx || this.muted) return;
        try {
            switch (name) {
                case 'meow': this.meow(arg || 1); break;
                case 'hiss': this.noise(0.5, 0.14, 2500); break;
                case 'swipe': this.noise(0.08, 0.1, 3500); break;
                case 'hit': this.tone(260, 120, 0.08, 'triangle', 0.08); break;
                case 'jump': this.noise(0.08, 0.04, 800, 'lowpass'); break;
                case 'land': this.tone(110 - (arg || 0), 40, 0.15, 'sine', 0.12 + Math.min(0.2, (arg || 0) / 400)); break;
                case 'eat':
                    for (let i = 0; i < 3; i++) this.noise(0.05, 0.08, 1500, 'bandpass', i * 0.09);
                    break;
                case 'gulp': this.tone(300, 900, 0.18, 'sine', 0.1); break;
                case 'hack':
                    for (let i = 0; i < 3; i++) this.noise(0.09, 0.12, 900, 'bandpass', i * 0.12);
                    this.tone(200, 70, 0.2, 'sawtooth', 0.05, 0.35);
                    break;
                case 'shatter':
                    this.noise(0.35, 0.16, 3000);
                    [2600, 3300, 2900, 3800].forEach((f, i) => this.tone(f, f * 0.8, 0.07, 'triangle', 0.05, i * 0.04));
                    break;
                case 'thud': this.tone(90, 35, 0.25, 'sine', 0.22); this.noise(0.12, 0.08, 400, 'lowpass'); break;
                case 'squeak': this.tone(2200, 3200, 0.07, 'sine', 0.05); break;
                case 'stuck': this.tone(140, 110, 0.4, 'square', 0.06); break;
                case 'pop': this.tone(200, 1200, 0.12, 'sine', 0.12); break;
                case 'boom': this.noise(0.6, 0.2, 600, 'lowpass'); this.tone(120, 30, 0.5, 'sawtooth', 0.12); break;
                case 'warn': this.tone(90, 70, 0.12, 'sine', 0.15); break;
                case 'meowNpc': this.meow(1.3 + Math.random() * 0.3, 0.35); break;
                case 'crow': this.tone(700, 450, 0.18, 'sawtooth', 0.05); this.tone(650, 420, 0.2, 'sawtooth', 0.05, 0.25); break;
                case 'bark': this.tone(420, 180, 0.12, 'square', 0.08); this.noise(0.08, 0.06, 1200, 'bandpass'); break;
                case 'whine': this.tone(900, 1400, 0.4, 'sine', 0.06); break;
                case 'horn': this.tone(392, 392, 0.25, 'square', 0.07); this.tone(330, 330, 0.25, 'square', 0.07); this.tone(392, 392, 0.4, 'square', 0.07, 0.35); break;
                case 'angry': this.tone(180, 120, 0.3, 'sawtooth', 0.08); break;
                case 'fail': this.tone(420, 60, 0.8, 'sawtooth', 0.09); break;
                case 'clear':
                    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.14, 'square', 0.06, i * 0.1));
                    break;
            }
        } catch (e) { /* ignore */ }
    }
};
