// 海辺の観光地: 街並み・遊歩道の屋台・砂浜・海の家・魚市場・桟橋・灯台（巣）
// 座標: x が東、z が南（海側）、y が上（メートル）。
import * as THREE from 'three';
import { toon, toonMap } from './toon.js';
import { Box, Grid, Builder, tex, speckle, facadeTex, stripeTex, signMesh } from './build.js';

export const WORLD = { x0: -20, x1: 160, z0: -15, z1: 150, top: 60, sea: 52 };

function makeMaterials() {
    const M = {};
    const T = (name, t, tile, extra) => {
        M[name] = toonMap(t, extra);
        M[name].userData.tile = tile;
    };
    T('asphalt', tex(256, (g, s) => {
        g.fillStyle = '#80858f';
        g.fillRect(0, 0, s, s);
        speckle(g, s, ['#737882', '#8d929b'], 700, 2);
    }), [4, 4]);
    T('sand', tex(256, (g, s) => {
        g.fillStyle = '#f3dfa8';
        g.fillRect(0, 0, s, s);
        speckle(g, s, ['#e6cf92', '#fbeec6', '#e9d49c'], 1400, 2);
    }), [3, 3]);
    T('boards', tex(128, (g, s) => {
        g.fillStyle = '#c9965f';
        g.fillRect(0, 0, s, s);
        g.fillStyle = '#a97a47';
        for (let i = 0; i < 4; i++) g.fillRect(i * s / 4, 0, 3, s);
        g.fillStyle = 'rgba(255,255,255,0.12)';
        for (let i = 0; i < 4; i++) g.fillRect(i * s / 4 + 8, 0, 6, s);
    }), [1.2, 1.2]);
    T('concrete', tex(128, (g, s) => {
        g.fillStyle = '#cfcac0';
        g.fillRect(0, 0, s, s);
        speckle(g, s, ['#bdb8ae', '#dcd8cf'], 500, 2);
        g.strokeStyle = '#b3ada2';
        g.lineWidth = 2;
        g.strokeRect(0, 0, s, s);
    }), [2, 2]);
    T('rock', tex(128, (g, s) => {
        g.fillStyle = '#8f8a82';
        g.fillRect(0, 0, s, s);
        speckle(g, s, ['#7c776f', '#a39e95', '#6e6a63'], 600, 5);
    }), [2, 2]);
    T('stripeRed', stripeTex('#e0524a', '#ffffff'), [1.2, 1.2]);
    T('stripeBlue', stripeTex('#3d7fd6', '#ffffff'), [1.2, 1.2]);
    T('stripeYellow', stripeTex('#f2b632', '#ffffff'), [1.2, 1.2]);
    T('stripeGreen', stripeTex('#3aa36b', '#fff6dc'), [1.2, 1.2]);
    T('stripePink', stripeTex('#f28bb0', '#ffffff'), [1.2, 1.2]);
    T('lighthouse', tex(64, (g, s) => {
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, s, s);
        g.fillStyle = '#e0453a';
        g.fillRect(0, 0, s, s / 2);
    }), [1, 8]);
    [['facCream', '#f7ecd4', '#c9b48e'], ['facPink', '#fad9d5', '#d5a39c'], ['facMint', '#d5f0e3', '#8fc2a8'],
        ['facBlue', '#d4e7f7', '#8fb2d4'], ['facYellow', '#f9efbd', '#d0bd6e'], ['facWhite', '#fbfbf7', '#8fb2d4'],
        ['facCoral', '#ffd8c2', '#e39a78']].forEach(([n, c, t]) => T(n, facadeTex(c, t), [3, 3]));
    const C = (name, color, extra) => { M[name] = toon(color, extra); };
    C('white', 0xfafaf5);
    C('wood', 0xb07a45);
    C('darkWood', 0x7a5232);
    C('metal', 0x9aa4ae);
    C('dark', 0x3c4048);
    C('red', 0xe0453a);
    C('roofBlue', 0x4f79b8);
    C('roofOrange', 0xe38a4a);
    C('roofTeal', 0x3f9e9a);
    C('leaf', 0x5fbf5a, { flatShading: true });
    C('palm', 0x3fa35a, { flatShading: true });
    C('trunk', 0x9a6b44);
    C('boat', 0xf4f1e8);
    C('boatBlue', 0x2f6fb0);
    C('glass', 0xbfe8ff, { emissive: 0x335566 });
    C('towelA', 0xf28bb0);
    C('towelB', 0x5cc0e8);
    C('towelC', 0xf6d04a);
    C('towelD', 0x8fd46b);
    M.line = new THREE.MeshBasicMaterial({ color: 0x3b2f2a, side: THREE.BackSide });
    return M;
}

// 海（テクスチャを流して波に見せる）
function makeSea(scene) {
    const t = tex(256, (g, s) => {
        g.fillStyle = '#3ea7d8';
        g.fillRect(0, 0, s, s);
        g.strokeStyle = 'rgba(255,255,255,0.55)';
        g.lineWidth = 4;
        g.lineCap = 'round';
        for (let i = 0; i < 18; i++) {
            const x = Math.random() * s, y = Math.random() * s, w = 20 + Math.random() * 30;
            g.beginPath();
            g.moveTo(x, y);
            g.quadraticCurveTo(x + w / 2, y - 6, x + w, y);
            g.stroke();
        }
    });
    t.repeat.set(60, 30);
    const m = new THREE.MeshToonMaterial({ color: 0xffffff, map: t });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 450).rotateX(-Math.PI / 2), m);
    sea.position.set(70, -0.05, WORLD.sea + 225);
    sea.receiveShadow = true;
    scene.add(sea);
    // 波打ち際の白い泡
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(900, 1.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    foam.position.set(70, 0.01, WORLD.sea + 0.4);
    scene.add(foam);
    return { tex: t, foam };
}

export function buildWorld(scene) {
    const M = makeMaterials();
    const B = new Builder(M);
    const deco = new THREE.Group();
    scene.add(deco);
    const sign = (text, x, y, z, rotY, w, h, bg = '#fffaf0', fg = '#3b2f2a', opt) => {
        const m = signMesh(text, w, h, bg, fg, opt);
        m.position.set(x, y, z);
        m.rotation.y = rotY;
        deco.add(m);
        return m;
    };
    const SOUTH = 0;
    const sp = {
        counters: [], vendors: [], walkers: [], towels: [], guards: [], fishermen: [],
        nest: new THREE.Vector3(122.4, 20.3, 70.6),
        start: { pos: new THREE.Vector3(72, 14, 36), vel: new THREE.Vector3(-10, 0, 0) },
        kites: [new THREE.Vector3(40, 28, 38), new THREE.Vector3(100, 30, 50)],
        // 上昇気流: 入ると羽ばたかなくても上がれる
        updrafts: [
            { x: 113, z: 66, r: 7, top: 26, power: 15 },
            { x: 69, z: 17, r: 6, top: 32, power: 15 },
            { x: 47, z: 44, r: 5, top: 16, power: 13 }
        ],
        areas: []
    };

    // ---------------- 地面
    const land = new THREE.Mesh(new THREE.PlaneGeometry(400, 200).rotateX(-Math.PI / 2), M.sand.clone());
    land.material.map = M.sand.map.clone();
    land.material.map.repeat.set(133, 66);
    land.material.map.needsUpdate = true;
    land.position.set(70, 0, WORLD.sea - 100);
    land.receiveShadow = true;
    scene.add(land);
    const sea = makeSea(scene);

    B.flat(-60, -15, 200, 20, 0.01, M.asphalt, '#80858f');
    // 街並み（北側）。屋上には降りられる
    const bld = (x0, x1, z0, z1, h, fac, roof, name) => {
        B.box(x0, 0, z0, x1, h, z1, fac, { name, map: '#d9cdb8' });
        B.box(x0 - 0.2, h, z0 - 0.2, x1 + 0.2, h + 0.35, z1 + 0.2, roof, { name: 'roof' });
    };
    bld(-20, -4, -2, 13, 10, M.facMint, M.roofTeal);
    bld(-2, 12, 0, 13, 8, M.facCoral, M.roofOrange);
    bld(14, 26, 1, 13, 12, M.facBlue, M.roofBlue);
    bld(28, 42, 0, 13, 9, M.facYellow, M.roofOrange);
    bld(44, 58, 1, 13, 11, M.facPink, M.roofTeal);
    bld(60, 78, 0, 13, 24, M.facWhite, M.roofBlue, 'hotel');
    sign('HOTEL SEAGULL', 69, 21, 13.3, SOUTH, 9, 1.4, '#2f6fb0', '#ffffff');
    bld(80, 92, 1, 13, 10, M.facCream, M.roofOrange);
    bld(94, 108, 0, 13, 13, M.facMint, M.roofTeal);
    bld(110, 124, 1, 13, 8, M.facCoral, M.roofBlue);
    bld(126, 142, 0, 13, 11, M.facYellow, M.roofOrange);
    bld(144, 160, -2, 13, 9, M.facPink, M.roofTeal);
    // 屋上の室外機・給水塔
    [[20, 12, 6], [35, 9, 5], [51, 11, 7], [85, 10, 6], [101, 13, 5], [134, 11, 6]].forEach(([x, h, z]) => {
        B.box(x - 1, h + 0.35, z - 0.7, x + 1, h + 1.3, z + 0.7, M.metal, { name: 'ac' });
    });
    B.box(66, 24.35, 3, 72, 27, 8, M.white, { name: 'tank' });
    // 街灯
    for (let x = 6; x < 140; x += 14) {
        B.shape(new THREE.CylinderGeometry(0.1, 0.13, 5, 10).translate(x, 2.5, 19.6), M.dark);
        B.box(x - 0.5, 5, 19.35, x + 0.5, 5.2, 19.85, M.dark, { name: 'lamp' });
        B.colliders.push(Object.assign(new Box(x - 0.15, 0, 19.45, x + 0.15, 5, 19.75, 'lamppost'), { thin: true }));
    }

    // ---------------- 遊歩道と屋台
    B.box(-20, 0, 20, 160, 0.3, 27, M.boards, { name: 'boardwalk', map: '#c9965f', t: 0.02 });
    const stall = (x, name, awning, type, bg, fg) => {
        const y0 = 0.3;
        B.box(x - 1.8, y0, 20.3, x + 1.8, y0 + 2.4, 20.6, M.wood, { name: 'stall' });
        B.box(x - 1.8, y0, 20.3, x - 1.6, y0 + 2.4, 22.0, M.wood, { name: 'stall' });
        B.box(x + 1.6, y0, 20.3, x + 1.8, y0 + 2.4, 22.0, M.wood, { name: 'stall' });
        B.box(x - 1.6, y0, 22.4, x + 1.6, y0 + 1.0, 23.2, M.white, { name: 'counter', map: '#ffffff' });
        B.box(x - 2.0, y0 + 2.4, 20.1, x + 2.0, y0 + 2.7, 22.0, awning, { name: 'awning' });
        sign(name, x, y0 + 2.2, 22.01, SOUTH, 3.0, 0.5, bg, fg);
        sp.counters.push({ type, x: x - 0.8, y: y0 + 1.0, z: 22.8 }, { type, x: x + 0.8, y: y0 + 1.0, z: 22.8 });
        sp.vendors.push({ x, z: 21.5 });
    };
    stall(12, 'ポテト', M.stripeYellow, 'fries', '#f2b632', '#ffffff');
    stall(22, 'ソフトクリーム', M.stripePink, 'icecream', '#f28bb0', '#ffffff');
    stall(34, 'たこ焼き', M.stripeRed, 'takoyaki', '#8c1c13', '#ffe9b0');
    stall(84, 'クレープ', M.stripePink, 'crepe', '#ffffff', '#f28bb0');
    stall(100, 'いか焼き', M.stripeBlue, 'squid', '#1f5fa8', '#ffffff');
    stall(112, 'フランクフルト', M.stripeRed, 'sausage', '#e0524a', '#ffffff');
    stall(124, 'おにぎり', M.stripeGreen, 'onigiri', '#3aa36b', '#ffffff');
    // 遊歩道を歩く観光客
    const hand = ['fries', 'icecream', 'crepe', 'sausage', 'takoyaki', 'icecream', 'fries', null];
    for (let i = 0; i < 16; i++) {
        sp.walkers.push({ x0: 0, x1: 140, z: 23.8 + (i % 3) * 1.1, x: 5 + i * 8.5, hold: hand[i % hand.length] });
    }
    for (let i = 0; i < 6; i++) {
        sp.walkers.push({ x0: 26, x1: 118, z: 47 + (i % 2) * 2.5, x: 30 + i * 14, hold: ['icecream', 'fries', null][i % 3] });
    }

    // ---------------- 砂浜: パラソルとレジャーシート
    const towelMats = [M.towelA, M.towelB, M.towelC, M.towelD];
    const parasolMats = [M.stripeRed, M.stripeBlue, M.stripeYellow, M.stripeGreen];
    const towel = (x, z, items, k) => {
        B.box(x - 1, 0, z - 0.7, x + 1, 0.03, z + 0.7, towelMats[k % 4], { collide: false, line: false });
        const px = x - 1.2, pz = z - 0.9;
        B.shape(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 8).translate(px, 1.15, pz), M.white);
        B.shape(new THREE.ConeGeometry(1.5, 0.6, 12, 1, true).translate(px, 2.4, pz), parasolMats[k % 4]);
        B.colliders.push(Object.assign(new Box(px - 0.08, 0, pz - 0.08, px + 0.08, 2.2, pz + 0.08, 'parasolPole'), { thin: true }));
        B.colliders.push(Object.assign(new Box(px - 1.1, 2.15, pz - 1.1, px + 1.1, 2.55, pz + 1.1, 'parasol'), { bouncy: true }));
        sp.towels.push({ x, z, items });
    };
    towel(62, 34, ['bento', 'onigiri'], 0);
    towel(74, 42, ['burger', 'fries'], 1);
    towel(86, 36, ['onigiri', 'icecream'], 2);
    towel(104, 44, ['bento', 'crepe'], 3);
    towel(116, 36, ['burger', 'takoyaki'], 0);
    towel(66, 47, ['yakisoba'], 3);

    // ---------------- 海の家
    B.box(38, 0, 30, 56, 0.5, 38, M.boards, { name: 'deck', map: '#c9965f' });
    [[38.3, 30.3], [55.7, 30.3], [38.3, 37.7], [55.7, 37.7], [47, 30.3], [47, 37.7]].forEach(([x, z]) => {
        B.box(x - 0.15, 0.5, z - 0.15, x + 0.15, 3.3, z + 0.15, M.darkWood, { name: 'post' });
    });
    B.box(37.5, 3.3, 29.5, 56.5, 3.7, 38.5, M.stripeBlue, { name: 'hutroof', map: '#3d7fd6' });
    sign('海の家 かもめ', 47, 3.0, 38.52, SOUTH, 5, 0.8, '#ffffff', '#2f6fb0', { border: '#2f6fb0' });
    B.box(39, 0.5, 30.5, 46, 1.5, 31.5, M.wood, { name: 'hutcounter' });
    [[42, 34.5], [48, 34.5], [53, 34.5]].forEach(([x, z]) => B.box(x - 1, 0.5, z - 0.6, x + 1, 1.25, z + 0.6, M.white, { name: 'table' }));
    sp.counters.push({ type: 'yakisoba', x: 41, y: 1.5, z: 31 }, { type: 'yakisoba', x: 44, y: 1.5, z: 31 },
        { type: 'burger', x: 48, y: 1.25, z: 34.5 }, { type: 'bento', x: 53, y: 1.25, z: 34.5 }, { type: 'fries', x: 42, y: 1.25, z: 34.5 });
    sp.vendors.push({ x: 42.5, z: 30.8, deck: 0.5 });
    sp.towels.push({ x: 48, z: 35.6, items: [], seatY: 0.5 }, { x: 53, z: 35.6, items: [], seatY: 0.5 });

    // ---------------- 魚市場（西）: 屋根付き。魚屋は常に警戒している
    B.box(-20, 0, 27, 24, 0.4, 52, M.concrete, { name: 'quay', map: '#cfcac0' });
    [[2, 30], [12, 30], [22, 30], [2, 44], [12, 44], [22, 44]].forEach(([x, z]) => {
        B.box(x - 0.2, 0.4, z - 0.2, x + 0.2, 5, z + 0.2, M.metal, { name: 'pillar' });
    });
    B.box(1, 5, 29, 23, 5.4, 45, M.roofTeal, { name: 'marketroof', map: '#3f9e9a' });
    sign('魚市場', 12, 4.6, 45.05, SOUTH, 3, 0.7, '#ffffff', '#1f5fa8');
    [[5, 34], [5, 40], [19, 34], [19, 40]].forEach(([x, z]) => {
        B.box(x - 1.5, 0.4, z - 0.8, x + 1.5, 1.3, z + 0.8, M.white, { name: 'table' });
        sp.counters.push({ type: 'fish', x: x - 0.6, y: 1.3, z }, { type: 'fish', x: x + 0.6, y: 1.3, z });
    });
    B.box(9.5, 0.4, 36, 14.5, 1.2, 38.5, M.white, { name: 'tunatable' });
    sp.counters.push({ type: 'tuna', x: 12, y: 1.2, z: 37.2, respawn: 60 });
    sign('本マグロ 時価', 12, 1.5, 38.52, SOUTH, 2.2, 0.4, '#ffffff', '#d62839');
    sp.guards.push({ x0: 3, x1: 21, z: 32 }, { x0: 3, x1: 21, z: 42 });
    // 漁船
    [[6, 57], [16, 60], [-6, 58]].forEach(([x, z], i) => {
        B.box(x - 1.6, -0.5, z - 4, x + 1.6, 1.0, z + 4, i % 2 ? M.boatBlue : M.boat, { name: 'boat' });
        B.box(x - 1, 1.0, z - 1.5, x + 1, 2.6, z + 0.5, M.white, { name: 'cabin' });
    });

    // ---------------- 桟橋（釣り人）
    B.box(92, 1.2, 50, 96, 1.5, 100, M.boards, { name: 'pier', map: '#c9965f', t: 0.03 });
    B.box(88, 1.2, 96, 100, 1.5, 104, M.boards, { name: 'pier', map: '#c9965f', t: 0.03 });
    for (let z = 54; z < 104; z += 6) {
        [92.2, 95.8].forEach(x => B.shape(new THREE.CylinderGeometry(0.2, 0.2, 2.5, 8).translate(x, 0, z), M.darkWood, false));
    }
    B.box(91.5, 0, 46, 96.5, 1.5, 50, M.concrete, { name: 'pierstep' });
    sp.fishermen.push({ x: 89.5, z: 101, dir: 1 }, { x: 98.5, z: 102, dir: 1 }, { x: 93, z: 76, dir: 1 });

    // ---------------- 防波堤と灯台（巣）
    B.box(112, 0, 64, 140, 1.4, 80, M.rock, { name: 'breakwater', map: '#8f8a82' });
    B.box(100, 0, 52, 112, 1.0, 68, M.rock, { name: 'breakwater', map: '#8f8a82' });
    const lh = new THREE.CylinderGeometry(1.8, 2.4, 18.6, 24, 1, true).translate(125, 1.4 + 9.3, 72);
    {
        const uv = lh.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 6);
    }
    B.shape(lh, M.lighthouse);
    B.colliders.push(new Box(123.2, 1.4, 70.2, 126.8, 20, 73.8, 'lighthouse'));
    B.shape(new THREE.CylinderGeometry(3.3, 3.3, 0.3, 28).translate(125, 20.15, 72), M.white);
    B.colliders.push(new Box(121.8, 19.9, 68.8, 128.2, 20.3, 75.2, 'gallery'));
    B.shape(new THREE.CylinderGeometry(1.3, 1.3, 2.4, 16).translate(125, 21.5, 72), M.glass);
    B.colliders.push(new Box(123.7, 20.3, 70.7, 126.3, 22.7, 73.3, 'lantern'));
    B.shape(new THREE.ConeGeometry(1.7, 1.4, 16).translate(125, 23.4, 72), M.red);
    sign('巣', 123.68, 21.2, 71.4, -Math.PI / 2, 0.8, 0.4, '#ffd166', '#3b2f2a');
    // 巣（わらのリング）
    B.shape(new THREE.TorusGeometry(0.7, 0.22, 8, 20).rotateX(Math.PI / 2).translate(sp.nest.x, 20.4, sp.nest.z), M.trunk);

    // ヤシの木
    const palm = (x, z, h = 7) => {
        B.shape(new THREE.CylinderGeometry(0.22, 0.32, h, 8).translate(x, h / 2, z), M.trunk);
        B.colliders.push(Object.assign(new Box(x - 0.3, 0, z - 0.3, x + 0.3, h, z + 0.3, 'palm'), { thin: true }));
        for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            const g = new THREE.SphereGeometry(1, 8, 5).scale(2.2, 0.3, 0.7).rotateY(-a).translate(x + Math.cos(a) * 1.6, h - 0.2, z + Math.sin(a) * 1.6);
            B.shape(g, M.palm);
        }
    };
    [[30, 29], [60, 29], [80, 29], [108, 29], [132, 30], [26, 49]].forEach(([x, z]) => palm(x, z));

    // 遠くの島
    [[40, 240, 30], [160, 260, 45], [-60, 230, 25]].forEach(([x, z, r]) => {
        const island = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.6, 0.5, 1), toon(0x7fb28a));
        island.position.set(x, -1, z);
        deco.add(island);
    });

    sp.areas = [
        { name: '灯台（巣）', x0: 112, z0: 60, x1: 140, z1: 84 },
        { name: '魚市場', x0: -20, z0: 27, x1: 24, z1: 52 },
        { name: '桟橋', x0: 86, z0: 50, x1: 102, z1: 106 },
        { name: '海の家', x0: 37, z0: 29, x1: 57, z1: 39 },
        { name: '遊歩道', x0: -20, z0: 19, x1: 160, z1: 27 },
        { name: '砂浜', x0: -20, z0: 27, x1: 160, z1: 52 },
        { name: '海', x0: -200, z0: 52, x1: 400, z1: 400 },
        { name: '街', x0: -200, z0: -100, x1: 400, z1: 19 }
    ];

    // 上昇気流の見た目（のぼっていく白い線）
    sp.updrafts.forEach(u => {
        const n = 36;
        const pos = new Float32Array(n * 6);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
        lines.frustumCulled = false;
        u.seeds = Array.from({ length: n }, () => ({ a: Math.random() * Math.PI * 2, r: Math.sqrt(Math.random()) * u.r * 0.9, y: Math.random() * u.top }));
        u.lines = lines;
        deco.add(lines);
        const ring = new THREE.Mesh(new THREE.RingGeometry(u.r - 0.25, u.r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
        ring.position.set(u.x, 0.05, u.z);
        deco.add(ring);
    });

    B.finish(scene);
    const colliders = B.colliders;
    return { colliders, grid: new Grid(colliders), sp, map: B.map, sea, M };
}
