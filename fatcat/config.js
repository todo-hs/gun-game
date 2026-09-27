// ゲーム全体の定数・体の大きさの式・セーブ・天の声
// 単位はメートル・キログラム・秒。

export const CFG = {
    START_WEIGHT: 3,
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

    // 体重 → 体の寸法。太るほど横に広がり、足は短く見える
    body(w) {
        const fat = Math.min(1, Math.max(0, (w - 3) / 45));
        return {
            fat,
            // ミヌエット: 短い足、大きめの丸い頭
            width: 0.17 + 0.018 * w,
            height: 0.21 + 0.0105 * w,
            length: 0.33 + 0.008 * w,
            head: 0.1 + 0.0006 * w,
            leg: Math.max(0.03, 0.058 - 0.0006 * w)
        };
    },
    // ためずに跳べる高さ / 最大までためたときの高さ
    jumpHeight: (w, charge) => Math.max(0.06, 1.05 - 0.02 * w) * (0.55 + 0.45 * charge),
    speed: w => Math.max(0.35, 1.9 - 0.022 * w),
    // 太るほど止まれない
    grip: w => (w < 20 ? 14 : Math.max(1.2, 14 * Math.pow(0.9, w - 20))),
    punchPower: w => 0.9 + w * 0.09,
    punchReach: w => 0.18 + CFG.body(w).width * 0.5 + CFG.body(w).head,
    spitAmount: w => Math.max(1, Math.round(w * 0.12 * 10) / 10)
};

// 物理で落ちる小物。price があるものは割れる
export const PROPS = {
    mug:      { name: 'マグカップ',   price: 1500,   shape: 'cyl', size: [0.045, 0.1],       mass: 0.3,  color: 0xf4f1e8 },
    glass:    { name: 'グラス',       price: 800,    shape: 'cyl', size: [0.035, 0.12],      mass: 0.2,  color: 0xbfe6ff, glass: true },
    vase:     { name: '花瓶',         price: 12000,  shape: 'cyl', size: [0.07, 0.26],       mass: 1.0,  color: 0x2f6fb0 },
    plant:    { name: '観葉植物',     price: 4800,   shape: 'cyl', size: [0.1, 0.24],        mass: 2.5,  color: 0xb5651d },
    phone:    { name: 'スマホ',       price: 98000,  shape: 'box', size: [0.075, 0.009, 0.15], mass: 0.2, color: 0x111111 },
    laptop:   { name: 'ノートPC',     price: 180000, shape: 'box', size: [0.32, 0.02, 0.22], mass: 1.4,  color: 0x9aa0a8 },
    frame:    { name: '写真立て',     price: 6000,   shape: 'box', size: [0.14, 0.18, 0.02], mass: 0.4,  color: 0x6b4423 },
    clock:    { name: '目覚まし時計', price: 9800,   shape: 'box', size: [0.12, 0.12, 0.06], mass: 0.5,  color: 0xd62839 },
    bottle:   { name: 'ワイン',       price: 3000,   shape: 'cyl', size: [0.04, 0.3],        mass: 1.1,  color: 0x2d4a2b, glass: true },
    plate:    { name: 'お皿',         price: 2000,   shape: 'cyl', size: [0.12, 0.02],       mass: 0.5,  color: 0xffffff },
    tv:       { name: 'テレビ',       price: 128000, shape: 'box', size: [1.1, 0.65, 0.08],  mass: 12,   color: 0x111111, breakSpeed: 2.2 },
    book:     { name: '本',           price: 0,      shape: 'box', size: [0.15, 0.22, 0.03], mass: 0.4,  color: 0x3a6ea5 },
    remote:   { name: 'リモコン',     price: 0,      shape: 'box', size: [0.05, 0.02, 0.18], mass: 0.15, color: 0x222222 },
    cushion:  { name: 'クッション',   price: 0,      shape: 'box', size: [0.4, 0.12, 0.4],   mass: 0.6,  color: 0xe9c46a },
    // 引っ越しの段ボール: pushWeight 以上の体重でないと動かせない
    heavybox: { name: '重い段ボール', price: 0,      shape: 'box', size: [0.8, 0.6, 0.6],    mass: 40,   color: 0xc49a5c, pushWeight: 25 }
};

// 食べ物: 触れると食べる
export const FOODS = {
    kibble: { name: 'カリカリ',     kg: 2,   bites: 3 },
    fish:   { name: '焼き魚',       kg: 3,   bites: 2 },
    treat:  { name: 'おやつ',       kg: 0.5, bites: 1 },
    catnip: { name: 'またたび',     kg: 0.1, bites: 1 },
    toy:    { name: 'ネズミのおもちゃ', kg: 0, bites: 1 }
};

export const DEATHS = {
    stuck:  '詰まって動けない',
    thin:   '痩せすぎて倒れた',
    burst:  '食べすぎて破裂',
    sucked: 'ルンバに吸われた',
    time:   '時間切れ'
};

// 天の声（実況のツッコミ役）
export const NARRATOR = {
    stuck:  ['猫は液体、という説は否定されました', '狭いところで食べるな', 'ソファ「重い」', 'ぴったりサイズでした'],
    thin:   ['吐きすぎ', 'ダイエット大成功（倒れた）'],
    burst:  ['食べすぎで破裂。当然の結果', '「おいしかった」が最後の言葉'],
    sucked: ['吸引力の変わらないただ一つのルンバ', 'ゴミとして処理されました'],
    time:   ['もう飼い主が帰ってくる', 'のんびりしすぎ'],
    stuckStart: ['あ、詰まった', 'はい詰まった', 'また詰まってる'],
    scared: ['猫にきゅうりはダメ、絶対', 'きゅうりは天敵', '今の跳び方は世界記録'],
    high:   ['またたびでキマってる', 'ニャハハハハ', '合法です'],
    sleep:  ['寝た。この状況で', '猫は1日14時間寝る', 'スヤァ…'],
    smash:  ['飼い主が泣いている', '猫はテーブルの物を落とす生き物', 'それ高いやつ'],
    cantJump: ['重くて跳べない', '体が浮かない', '重力には勝てない'],
    clear:  ['よくやった', 'デブの勝利', 'ごちそうさまでした', '今の、たまたまでしょ'],
    milestones: [
        [10, 'ちょっとぽっちゃり'],
        [20, 'デブの自覚が芽生えた'],
        [35, '動くのがめんどくさくなってきた'],
        [50, 'もはや猫ではない'],
        [70, '床がきしんでいる'],
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
    data: { unlocked: 0, deaths: 0, best: {}, maxWeight: 0, damageTotal: 0 },
    load() {
        try {
            const raw = localStorage.getItem('fatcat3d_save');
            if (raw) Object.assign(this.data, JSON.parse(raw));
        } catch (e) { /* ストレージが使えなくても遊べる */ }
    },
    save() {
        try {
            localStorage.setItem('fatcat3d_save', JSON.stringify(this.data));
        } catch (e) { /* ignore */ }
    }
};
Save.load();
