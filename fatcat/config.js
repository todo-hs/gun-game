// ゲーム全体の定数・セーブ・効果音

const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif';

const FC = {
    TILE: 32,
    START_WEIGHT: 3,
    MIN_WEIGHT: 1,
    SPIT_INTERVAL: 0.17,
    SPIT_JET: 380,
    STUCK_TIME: 3.5,
    FRAGILE_LIMIT: 10,
    BOX_BREAK: 25,
    ROLL_WEIGHT: 40,
    BURST_WARN: 85,
    BURST_WEIGHT: 100,

    // 体重(kg) → 当たり判定の直径(px)。1マス = 32px
    diameter: w => 10 + 3 * w,
    speed: w => Math.max(80, 240 - 5 * w),
    // 太るほど止まれない（大きいほど滑る）
    grip: w => (w < 20 ? 30 : Math.max(1.2, 30 * Math.pow(0.9, w - 20))),
    // 猫パンチ
    PUNCH_COOLDOWN: 0.28,
    punchDamage: w => 6 + w * 0.8,
    punchReach: (w, d) => d / 2 + 26 + w * 0.3,
    // 飛びかかり: 長押しでためて離す。太るほど飛べない
    POUNCE_HOLD: 0.18,
    POUNCE_CHARGE: 0.7,
    pounceMax: w => Phaser.Math.Clamp(320 - 4 * w, 50, 320),
    pounceDamage: w => 15 + w * 1.5,
    SLAM_WEIGHT: 30,
    SLEEP_AFTER: 6,
    HIGH_TIME: 6,
    SCARE_JUMP: 230,
    spitAmount: w => Math.max(1, Math.round(w * 0.12 * 10) / 10),
    // n マス幅の穴を通れる最大体重
    maxWeightForTiles: n => Math.floor(((n * 32 - 10) / 3 - 0.01) * 10) / 10,

    // 棚の上の物（叩き落とすと被害総額が増える）
    PROPS: {
        v: { tex: 'fc_vase',  name: '花瓶',       price: 12000 },
        u: { tex: 'fc_mug',   name: 'マグカップ', price: 1500 },
        p: { tex: 'fc_plant', name: '観葉植物',   price: 4800 },
        q: { tex: 'fc_phone', name: 'スマホ',     price: 98000 }
    },

    ENEMIES: {
        mouse:  { tex: 'fc_mouse',  size: 14,  hp: 8,    speed: 160, eat: 0.6, drop: 0.5, dmg: 0 },
        dog:    { tex: 'fc_dog',    size: 40,  hp: 45,   speed: 95,  eat: 3,   drop: 2,   dmg: 2 },
        bigdog: { tex: 'fc_bigdog', size: 72,  hp: 130,  speed: 80,  eat: 6,   drop: 4,   dmg: 3.5 },
        boss:   { tex: 'fc_boss',   size: 150, hp: 500,  speed: 70,  eat: 20,  drop: 0,   dmg: 5, boss: true },
        // ルンバは魚を吸って大きくなる（テクスチャ 300px、当たり半径 130 を基準にスケール）
        roomba: { tex: 'fc_roomba', size: 180, hp: 2000, speed: 55,  eat: 15,  drop: 0,   dmg: 8, boss: true, bodyR: 130, maxSize: 260 }
    },

    DEATHS: {
        stuck:  '詰まって死亡',
        vacuum: '掃除機に吸われた',
        thin:   '痩せすぎて消滅',
        eaten:  'かじられ尽くした',
        door:   'ドアに挟まれた',
        fall:   '床が抜けた',
        burst:  '食べすぎて破裂'
    }
};

// 天の声（実況のツッコミ役）
const NARRATOR = {
    stuck:  ['猫は液体、という説は否定されました', '穴の中で食べるな。何度言えば', 'ぴったりサイズでした', '詰まる猫、初めて見た'],
    vacuum: ['吸引力の変わらない、ただひとつの掃除機', '今日は燃えるゴミの日でした', 'ゴミとして処理されました'],
    thin:   ['吐きすぎて毛玉になった', 'ダイエット大成功（死亡）', '猫、消滅'],
    eaten:  ['犬の方がデカかった', '犬のおやつになった', '体格差を考えろ'],
    door:   ['体重計はウソをつかない', 'ドアは閉まるものです'],
    fall:   ['床「重い」', '体重を考えろ', '床が泣いていた'],
    burst:  ['食べすぎで破裂。当然の結果', '「おいしかった」が最後の言葉', '100kgの壁は越えられなかった'],
    stuckStart: ['あ、詰まった', 'はい詰まった', 'また詰まってる'],
    scared: ['猫にきゅうりはダメ、絶対', 'きゅうりは天敵', '今の跳び方は世界記録'],
    high:   ['またたびでキマってる', 'ニャハハハハ', '合法です'],
    sleep:  ['寝た。この状況で', '猫は1日14時間寝る', 'スヤァ…'],
    smash:  ['飼い主が泣いている', '猫はテーブルの物を落とす生き物', 'それ高いやつ'],
    clear:  ['よく痩せた', 'デブの勝利', 'ごちそうさまでした', '今の、たまたまでしょ'],
    start:  ['さあ、食え', '今日のテーマ：食べすぎ注意', '健康診断の前日です'],
    milestones: [
        [20, 'デブの自覚が芽生えた'],
        [35, '動くのがめんどくさくなってきた'],
        [50, 'もはや猫ではない'],
        [70, '体重計が逃げ出した'],
        [85, 'パンパンです。破裂注意']
    ],
    pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    },
    death(reason, deaths) {
        if (deaths > 0 && deaths % 10 === 0) return `${deaths}回目の死。もはや芸`;
        return this.pick(this[reason] || ['死んだ']);
    }
};

const Save = {
    data: { unlocked: 0, deaths: 0, best: {}, maxWeight: 0, damageTotal: 0 },
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

    noise(dur, vol = 0.08, highpass = 0) {
        const c = this.ctx;
        const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = c.createBufferSource();
        const g = c.createGain();
        g.gain.value = vol;
        src.buffer = buf;
        if (highpass) {
            const f = c.createBiquadFilter();
            f.type = 'highpass';
            f.frequency.value = highpass;
            src.connect(f).connect(g).connect(c.destination);
        } else {
            src.connect(g).connect(c.destination);
        }
        src.start();
    },

    // ノコギリ波をバンドパスに通して「ニャー」っぽくする
    meow(pitch = 1) {
        const c = this.ctx;
        const t = c.currentTime;
        const o = c.createOscillator();
        const f = c.createBiquadFilter();
        const g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(420 * pitch, t);
        o.frequency.linearRampToValueAtTime(620 * pitch, t + 0.18);
        o.frequency.linearRampToValueAtTime(380 * pitch, t + 0.5);
        f.type = 'bandpass';
        f.Q.value = 4;
        f.frequency.setValueAtTime(700, t);
        f.frequency.linearRampToValueAtTime(1500, t + 0.2);
        f.frequency.linearRampToValueAtTime(600, t + 0.5);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        o.connect(f).connect(g).connect(c.destination);
        o.start(t);
        o.stop(t + 0.6);
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
                case 'boom': this.noise(0.5, 0.18); this.tone(120, 30, 0.5, 'sawtooth', 0.12); break;
                case 'crack': this.noise(0.08, 0.1); this.tone(900, 300, 0.08, 'square', 0.03); break;
                case 'fall': this.tone(700, 60, 0.9, 'sine', 0.1); break;
                case 'jet': this.noise(0.2, 0.06); break;
                case 'warn': this.tone(90, 70, 0.12, 'sine', 0.15); break;
                case 'evolve': [392, 523, 659].forEach((f, i) => this.tone(f, f * 1.5, 0.1, 'square', 0.05, i * 0.07)); break;
                case 'meow': this.meow(1); break;
                case 'meowHigh': this.meow(1.4); break;
                case 'hiss': this.noise(0.45, 0.12, 2500); break;
                case 'swipe': this.noise(0.07, 0.08, 4000); break;
                case 'thud': this.tone(140, 40, 0.2, 'sine', 0.2); this.noise(0.1, 0.06); break;
                case 'shatter':
                    this.noise(0.3, 0.12, 3000);
                    [2400, 3100, 2700].forEach((f, i) => this.tone(f, f * 0.8, 0.08, 'triangle', 0.04, i * 0.05));
                    break;
                case 'clear':
                    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.14, 'square', 0.06, i * 0.1));
                    break;
            }
        } catch (e) { /* ignore */ }
    }
};
