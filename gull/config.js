// 定数・食べ物・ミッション・セーブ・天の声
// 単位はメートル・キログラム・秒。

export const CFG = {
    START_WEIGHT: 1.0,
    BURST_WARN: 4.3,
    BURST_WEIGHT: 5.0,
    RUN_TIME: 180,
    GRAVITY: 9.8,
    // 体重 → 体の大きさ（1kg で 1）
    scale: w => 0.85 + w * 0.2,
    // 重いほど羽ばたきが効かない
    flapPower: w => 5.2 / Math.pow(w, 0.75),
    // 口の届く範囲
    grabRadius: w => 0.85 + w * 0.1
};

// 小さい物はその場で食べる。big の物はくわえて巣まで運ぶ（need kg 以上でないと持てない）
export const FOODS = {
    fries:    { name: 'ポテト',         kg: 0.15, yen: 400,   color: 0xf6c945 },
    icecream: { name: 'ソフトクリーム', kg: 0.2,  yen: 350,   color: 0xfff6e8 },
    takoyaki: { name: 'たこ焼き',       kg: 0.15, yen: 500,   color: 0xc8813a },
    sausage:  { name: 'フランクフルト', kg: 0.12, yen: 300,   color: 0xc0472e },
    onigiri:  { name: 'おにぎり',       kg: 0.15, yen: 180,   color: 0xffffff },
    yakisoba: { name: '焼きそば',       kg: 0.25, yen: 600,   color: 0x9c5a2c },
    crepe:    { name: 'クレープ',       kg: 0.2,  yen: 550,   color: 0xf3d9a4 },
    squid:    { name: 'いか焼き',       kg: 0.4,  yen: 800,   big: true, need: 1.2, color: 0xd98a4a },
    bento:    { name: '幕の内弁当',     kg: 0.5,  yen: 1000,  big: true, need: 1.4, color: 0x2e2a30 },
    fish:     { name: 'アジ（丸ごと）', kg: 0.6,  yen: 1500,  big: true, need: 1.6, color: 0x9fb8d0 },
    burger:   { name: '特大バーガー',   kg: 0.7,  yen: 1800,  big: true, need: 2.0, color: 0xd9953a },
    tuna:     { name: '本マグロ',       kg: 2.0,  yen: 30000, big: true, need: 3.2, color: 0x3b4a6b }
};

export const MISSIONS = [
    { id: 'fries',  label: 'ポテトを盗む' },
    { id: 'airIce', label: '人の手からソフトクリームを奪う' },
    { id: 'poop',   label: 'フンを当てて食べ物を落とさせる' },
    { id: 'fish',   label: '魚を丸ごと巣に持ち帰る' },
    { id: 'kite',   label: 'トンビに追われながら巣に持ち帰る' },
    { id: 'combo',  label: '5連続で盗む（10秒以内につなぐ）' },
    { id: 'heavy',  label: '体重 3kg で空を飛ぶ' },
    { id: 'yen',    label: '1回で被害総額 ¥15,000' },
    { id: 'tuna',   label: '本マグロを巣に持ち帰る' }
];

export const RANKS = [
    [0, '見習いカモメ'],
    [3000, 'ポテト泥棒'],
    [10000, '海の家の悪夢'],
    [25000, '浜辺の災害'],
    [50000, '伝説の盗賊カモメ']
];

export const NARRATOR = {
    crash:  ['前を見て飛べ', '鳥なのに', '羽が散った', 'ドゴッ'],
    water:  ['着水。ただの浮き輪', 'カモメは泳げる', 'しょっぱい'],
    kite:   ['トンビに油揚げをさらわれる、を体験中', 'トンビは容赦しない', '空の強盗'],
    swat:   ['人間は怒っている', '手ではたかれた', '当然の報い'],
    poop:   ['最低の攻撃', '運がついた', '空からの贈り物'],
    heavy:  ['重くて浮かない', '翼が悲鳴をあげている', 'もはや飛べる重さではない'],
    steal:  ['見事な強奪', '被害届が出ました', '観光客が泣いている', '手慣れている'],
    burst:  ['食べすぎで破裂。当然の結果', '浜辺に羽毛の雪が降った'],
    start:  ['今日も浜辺はにぎわっている', '観光客は油断している', '盗め'],
    milestones: [
        [2, 'ちょっとぽっちゃり'],
        [3, '飛ぶのがつらくなってきた'],
        [4, 'もはやダチョウ'],
        [4.5, 'パンパンです。破裂注意']
    ],
    pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    }
};

export const Save = {
    data: { best: 0, runs: 0, missions: {}, maxWeight: 0 },
    load() {
        try {
            const raw = localStorage.getItem('gull_save');
            if (raw) Object.assign(this.data, JSON.parse(raw));
        } catch (e) { /* ストレージが使えなくても遊べる */ }
    },
    save() {
        try {
            localStorage.setItem('gull_save', JSON.stringify(this.data));
        } catch (e) { /* ignore */ }
    }
};
Save.load();
