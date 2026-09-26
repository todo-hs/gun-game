// ゲーム全体の定数・セーブ・効果音

const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif';

const FC = {
    TILE: 32,
    START_WEIGHT: 3,
    MIN_WEIGHT: 1,
    FIRE_INTERVAL: 0.28,
    SPIT_INTERVAL: 0.17,
    STUCK_TIME: 3.5,

    // 体重(kg) → 当たり判定の直径(px)。1マス = 32px
    diameter: w => 10 + 3 * w,
    speed: w => Math.max(70, 240 - 5 * w),
    bulletDamage: w => 4 + w,
    bulletScale: w => Math.min(3, 0.8 + w * 0.05),
    spitAmount: w => Math.max(1, Math.round(w * 0.12 * 10) / 10),
    // n マス幅の穴を通れる最大体重
    maxWeightForTiles: n => Math.floor(((n * 32 - 10) / 3 - 0.01) * 10) / 10,

    ENEMIES: {
        mouse:  { tex: 'fc_mouse',  size: 14,  hp: 8,   speed: 115, eat: 0.6, drop: 0.5, dmg: 0 },
        dog:    { tex: 'fc_dog',    size: 40,  hp: 45,  speed: 95,  eat: 3,   drop: 2,   dmg: 2 },
        bigdog: { tex: 'fc_bigdog', size: 72,  hp: 130, speed: 80,  eat: 6,   drop: 4,   dmg: 3.5 },
        boss:   { tex: 'fc_boss',   size: 150, hp: 700, speed: 70,  eat: 20,  drop: 0,   dmg: 5 }
    },

    DEATHS: {
        stuck:  ['詰まって死亡', '猫は液体じゃなかった'],
        vacuum: ['掃除機に吸われた', 'ゴミとして処理されました'],
        thin:   ['痩せすぎて消滅', '吐きすぎ注意'],
        eaten:  ['かじられ尽くした', '犬のおやつになった'],
        door:   ['ドアに挟まれた', '体重計はウソをつかない']
    }
};

const Save = {
    data: { unlocked: 0, deaths: 0, best: {} },
    load() {
        try {
            const raw = localStorage.getItem('fatcat_save');
            if (raw) Object.assign(this.data, JSON.parse(raw));
        } catch (e) { /* ストレージが使えなくても遊べる */ }
    },
    save() {
        try {
            localStorage.setItem('fatcat_save', JSON.stringify(this.data));
        } catch (e) { /* ignore */ }
    }
};
Save.load();

// WebAudio で鳴らす簡易効果音（音声ファイル不要）
const SFX = {
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

    noise(dur, vol = 0.08) {
        const c = this.ctx;
        const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = c.createBufferSource();
        const g = c.createGain();
        g.gain.value = vol;
        src.buffer = buf;
        src.connect(g).connect(c.destination);
        src.start();
    },

    play(name) {
        if (!this.ctx || this.muted) return;
        try {
            switch (name) {
                case 'shoot': this.tone(900, 500, 0.04, 'square', 0.02); break;
                case 'eat': this.tone(300, 750, 0.1, 'square', 0.05); break;
                case 'bigeat': this.tone(160, 900, 0.25, 'sawtooth', 0.07); break;
                case 'spit': this.noise(0.12, 0.08); this.tone(220, 70, 0.15, 'sawtooth', 0.05); break;
                case 'hit': this.tone(200, 120, 0.05, 'square', 0.03); break;
                case 'kill': this.tone(500, 150, 0.12, 'triangle', 0.06); break;
                case 'hurt': this.tone(320, 90, 0.25, 'sawtooth', 0.08); break;
                case 'stuck': this.tone(140, 110, 0.4, 'square', 0.08); this.tone(150, 100, 0.4, 'square', 0.05, 0.2); break;
                case 'pop': this.tone(200, 1200, 0.12, 'sine', 0.1); break;
                case 'gate': this.tone(500, 500, 0.08, 'square', 0.05); this.tone(750, 750, 0.12, 'square', 0.05, 0.09); break;
                case 'die': this.tone(420, 50, 0.7, 'sawtooth', 0.1); break;
                case 'clear':
                    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.14, 'square', 0.06, i * 0.1));
                    break;
            }
        } catch (e) { /* ignore */ }
    }
};
