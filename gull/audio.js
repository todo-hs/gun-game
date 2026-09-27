// WebAudio で鳴らす効果音（音声ファイル不要）。風切り音は速さに合わせて鳴り続ける

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

    // カモメの鳴き声「ミャーオ」
    gull(pitch = 1) {
        const c = this.ctx;
        const t = c.currentTime;
        for (let k = 0; k < 3; k++) {
            const o = c.createOscillator();
            const f = c.createBiquadFilter();
            const g = c.createGain();
            const t0 = t + k * 0.16;
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(1500 * pitch, t0);
            o.frequency.exponentialRampToValueAtTime(900 * pitch, t0 + 0.14);
            f.type = 'bandpass';
            f.frequency.value = 2200;
            f.Q.value = 3;
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
            o.connect(f).connect(g).connect(c.destination);
            o.start(t0);
            o.stop(t0 + 0.17);
        }
    },

    // 風切り音（ループするノイズ）
    startWind() {
        if (!this.ctx || this.wind) return;
        const c = this.ctx;
        const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 400;
        const g = c.createGain();
        g.gain.value = 0;
        src.connect(f).connect(g).connect(c.destination);
        src.start();
        this.wind = { f, g };
    },

    setWind(speed) {
        if (!this.wind) return;
        const k = Math.min(1, speed / 22);
        const t = this.ctx.currentTime;
        this.wind.g.gain.setTargetAtTime(this.muted ? 0 : k * k * 0.12, t, 0.1);
        this.wind.f.frequency.setTargetAtTime(300 + k * 1500, t, 0.1);
    },

    play(name, arg) {
        if (!this.ctx || this.muted) return;
        try {
            switch (name) {
                case 'flap': this.noise(0.09, 0.07 + (arg || 0) * 0.03, 700, 'lowpass'); break;
                case 'gull': this.gull(arg || 1); break;
                case 'grab': this.tone(500, 1400, 0.1, 'triangle', 0.1); break;
                case 'gulp': this.tone(300, 900, 0.18, 'sine', 0.1); break;
                case 'cash': [1318, 1568].forEach((f, i) => this.tone(f, f, 0.1, 'square', 0.05, i * 0.07)); break;
                case 'crash': this.noise(0.25, 0.2, 500, 'lowpass'); this.tone(160, 50, 0.25, 'square', 0.08); break;
                case 'splash': this.noise(0.5, 0.15, 1200, 'bandpass'); break;
                case 'shout': this.tone(300, 520, 0.25, 'sawtooth', 0.06); break;
                case 'swat': this.noise(0.1, 0.18, 2000); break;
                case 'kite':
                    this.tone(2400, 2600, 0.25, 'sine', 0.06);
                    [0, 1, 2].forEach(i => this.tone(2500, 1800, 0.09, 'sine', 0.05, 0.3 + i * 0.1));
                    break;
                case 'poop': this.tone(600, 200, 0.12, 'sine', 0.08); break;
                case 'splat': this.noise(0.12, 0.14, 900, 'bandpass'); break;
                case 'warn': this.tone(90, 70, 0.12, 'sine', 0.15); break;
                case 'boom': this.noise(0.6, 0.2, 600, 'lowpass'); this.tone(120, 30, 0.5, 'sawtooth', 0.12); break;
                case 'mission': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, f, 0.12, 'square', 0.05, i * 0.08)); break;
                case 'end': [523, 392, 330, 262].forEach((f, i) => this.tone(f, f, 0.2, 'square', 0.06, i * 0.15)); break;
                case 'tick': this.tone(1000, 1000, 0.04, 'square', 0.04); break;
            }
        } catch (e) { /* ignore */ }
    }
};
