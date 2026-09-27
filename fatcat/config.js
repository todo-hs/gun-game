// ゲーム全体の定数・体の大きさの式・食べ物・ボス・セーブ・天の声
// 単位はメートル・キログラム・秒。

export const CFG = {
    START_WEIGHT: 4,
    MIN_WEIGHT: 1,
    BURST_WARN: 85,
    BURST_WEIGHT: 100,
    STUCK_TIME: 3.5,
    GRAVITY: 14,
    SPIT_TIME: 0.45,
    PUNCH_COOLDOWN: 0.3,
    SIT_AFTER: 3,
    SLEEP_AFTER: 10,
    HIGH_TIME: 7,
    CROUCH_RATIO: 0.68, // 狭いところでは体を低くして潜り込む
    STEP_UP: 0.16, // 階段や縁石くらいは歩いて登れる

    // 体重 → 体の寸法（アニメ調の二頭身ミヌエット）。太るほど横に広がる
    body(w) {
        const fat = Math.min(1, Math.max(0, (w - 3) / 45));
        const torsoH = 0.16 + 0.009 * w;
        const head = 0.115 + 0.0009 * w;
        const leg = Math.max(0.03, 0.05 - 0.0004 * w);
        return {
            fat, torsoH, head, leg,
            width: 0.2 + 0.018 * w,
            length: 0.36 + 0.008 * w,
            height: leg + torsoH * 0.9 + head * 1.1
        };
    },
    // ためずに跳べる高さ / 最大までためたときの高さ
    jumpHeight: (w, charge) => Math.max(0.06, 1.05 - 0.02 * w) * (0.55 + 0.45 * charge),
    speed: w => Math.max(0.6, 2.6 - 0.025 * w),
    // 太るほど止まれない
    grip: w => (w < 20 ? 14 : Math.max(1.2, 14 * Math.pow(0.9, w - 20))),
    punchReach: w => 0.2 + CFG.body(w).width * 0.5 + CFG.body(w).head,
    spitAmount: w => Math.max(1, Math.round(w * 0.12 * 10) / 10),
    // この体重までの猫が通れる隙間の幅
    gapFor: kg => CFG.body(kg).width + 0.012,
    // 最大ジャンプで乗れる段差の高さ → 乗れる最大体重
    climbLimit: h => Math.floor((1.05 - h - 0.03) / 0.02)
};

// 食べ物: 触れると食べる。respawn 秒後にまた出てくる（0 なら一度きり）
export const FOODS = {
    fish:     { name: '鮮魚',         kg: 3,   bites: 2, respawn: 25 },
    yakitori: { name: '焼き鳥',       kg: 1.5, bites: 1, respawn: 15 },
    melonpan: { name: 'メロンパン',   kg: 2,   bites: 2, respawn: 20 },
    kibble:   { name: 'カリカリ',     kg: 2,   bites: 3, respawn: 20 },
    treat:    { name: 'ちゅ〜る',     kg: 0.5, bites: 1, respawn: 0 },
    ramen:    { name: '食べ残しラーメン', kg: 4, bites: 2, respawn: 30 },
    zanpan:   { name: '残飯',         kg: 3,   bites: 2, respawn: 30 },
    bone:     { name: '魚の骨',       kg: 1,   bites: 1, respawn: 20 },
    himono:   { name: '干物',         kg: 2,   bites: 1, respawn: 30 },
    mouse:    { name: 'ネズミ',       kg: 1,   bites: 1, respawn: 0 },
    dogfood:  { name: 'ドッグフード', kg: 2.5, bites: 2, respawn: 25 },
    catnip:   { name: 'またたび',     kg: 0.1, bites: 1, respawn: 30 },
    bento:    { name: '捨てられた弁当', kg: 3, bites: 2, respawn: 0 }
};

// 町のボス猫。体重が近くないとパンチが効かない
export const BOSSES = {
    mike:  { name: 'ミケ姐さん', w: 12, palette: 'mike',  where: '住宅街の屋上', hint: '屋上へは物置→室外機→ベランダ。18kg を超えると跳べない' },
    buchi: { name: 'ブチ',       w: 25, palette: 'buchi', where: '公園の砂場',   hint: '25kg の巨漢。こっちも太らないとパンチが効かない' },
    kuro:  { name: 'クロ',       w: 40, palette: 'kuro',  where: '路地裏',       hint: '入口の隙間は 8kg まで。中で太ってから戦え' }
};

export const DEATHS = {
    stuck: '詰まって動けない',
    thin:  '痩せすぎて倒れた',
    burst: '食べすぎて破裂',
    car:   'トラックにはねられた'
};

// 天の声（実況のツッコミ役）
export const NARRATOR = {
    stuck:  ['猫は液体、という説は否定されました', '狭いところで食べるな', 'ぴったりサイズでした', '町内の新しい名所'],
    thin:   ['吐きすぎ', 'ダイエット大成功（倒れた）'],
    burst:  ['食べすぎで破裂。当然の結果', '「おいしかった」が最後の言葉', '町内に猫の雨が降った'],
    car:    ['左右をよく見て渡りましょう', '交通ルールは猫にも適用されます', '運転手さんは悪くない'],
    stuckStart: ['あ、詰まった', 'はい詰まった', 'また詰まってる'],
    scared: ['今の跳び方は世界記録', 'びっくりしすぎ'],
    broom:  ['魚屋のおやじは容赦しない', '商売道具に手を出すな'],
    high:   ['またたびでキマってる', 'ニャハハハハ', '合法です'],
    sleep:  ['寝た。道のど真ん中で', '猫は1日14時間寝る', 'スヤァ…'],
    cantJump: ['重くて跳べない', '体が浮かない', '重力には勝てない'],
    respawn: ['家（段ボール）から再スタート', '何事もなかったかのように', '猫には9つの命がある'],
    milestones: [
        [10, 'ちょっとぽっちゃり'],
        [20, 'デブの自覚が芽生えた'],
        [35, '動くのがめんどくさくなってきた'],
        [50, 'もはや猫ではない'],
        [70, '道路がきしんでいる'],
        [85, 'パンパンです。破裂注意']
    ],
    pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    },
    death(reason, deaths) {
        if (deaths > 0 && deaths % 10 === 0) return `${deaths}回目の失敗。もはや芸`;
        return this.pick(this[reason] || ['おしまい']);
    }
};

export const Save = {
    data: { deaths: 0, maxWeight: 0, bosses: {}, badges: [], playTime: 0, cleared: false, started: false },
    load() {
        try {
            const raw = localStorage.getItem('fatcat_town_save');
            if (raw) Object.assign(this.data, JSON.parse(raw));
        } catch (e) { /* ストレージが使えなくても遊べる */ }
    },
    save() {
        try {
            localStorage.setItem('fatcat_town_save', JSON.stringify(this.data));
        } catch (e) { /* ignore */ }
    },
    reset() {
        const deaths = this.data.deaths;
        this.data = { deaths, maxWeight: 0, bosses: {}, badges: [], playTime: 0, cleared: false, started: false };
        this.save();
    }
};
Save.load();
