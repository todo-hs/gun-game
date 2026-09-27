// 猫目線の町: 商店街・住宅街・路地裏・公園・神社
// 座標: x が東、z が南、y が上（メートル）。町は x 0〜64、z 0〜48。
// 動かない建物は材質ごとに 1 つのメッシュにまとめて描画を軽くする。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, toonMap, outlineMaterial } from './toon.js';
import { CFG } from './config.js';

export const TOWN = { w: 64, d: 48 };

// 当たり判定の箱。off にすると一時的に無効（開いた扉・倒れたゴミ箱）
export class Box {
    constructor(x0, y0, z0, x1, y1, z1, name) {
        this.min = new THREE.Vector3(x0, y0, z0);
        this.max = new THREE.Vector3(x1, y1, z1);
        this.name = name || '';
        this.off = false;
    }
}

// 箱を 4m 四方のマスに登録して、近くの箱だけ調べる
export class Grid {
    constructor(boxes) {
        this.cell = 4;
        this.x0 = -8;
        this.z0 = -8;
        this.nx = 22;
        this.nz = 18;
        this.cells = Array.from({ length: this.nx * this.nz }, () => []);
        this.stamp = 0;
        this.seen = new Uint32Array(boxes.length);
        boxes.forEach((b, i) => {
            b.index = i;
            this.forCells(b.min.x, b.min.z, b.max.x, b.max.z, c => c.push(b));
        });
    }

    forCells(x0, z0, x1, z1, fn) {
        const i0 = Math.max(0, Math.floor((x0 - this.x0) / this.cell));
        const i1 = Math.min(this.nx - 1, Math.floor((x1 - this.x0) / this.cell));
        const j0 = Math.max(0, Math.floor((z0 - this.z0) / this.cell));
        const j1 = Math.min(this.nz - 1, Math.floor((z1 - this.z0) / this.cell));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(this.cells[j * this.nx + i]);
    }

    // 範囲に重なるかもしれない箱
    query(x0, z0, x1, z1, out) {
        out.length = 0;
        this.stamp++;
        this.forCells(x0, z0, x1, z1, cell => {
            for (const b of cell) {
                if (this.seen[b.index] === this.stamp) continue;
                this.seen[b.index] = this.stamp;
                out.push(b);
            }
        });
        return out;
    }
}

// ---------------------------------------------------------------- テクスチャ

function tex(size, draw, h = size) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = h;
    draw(c.getContext('2d'), size, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
}

function speckle(g, s, colors, n, r) {
    for (let i = 0; i < n; i++) {
        g.fillStyle = colors[i % colors.length];
        g.fillRect(Math.random() * s, Math.random() * s, r, r);
    }
}

function facadeTex(color, trim) {
    return tex(256, (g, s) => {
        g.fillStyle = color;
        g.fillRect(0, 0, s, s);
        g.fillStyle = trim;
        g.fillRect(0, 0, s, s * 0.035);
        g.fillStyle = '#ffffff';
        g.fillRect(s * 0.22, s * 0.2, s * 0.56, s * 0.48);
        g.fillStyle = '#9fd3f0';
        g.fillRect(s * 0.25, s * 0.23, s * 0.5, s * 0.42);
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.beginPath();
        g.moveTo(s * 0.3, s * 0.23);
        g.lineTo(s * 0.4, s * 0.23);
        g.lineTo(s * 0.25, s * 0.47);
        g.lineTo(s * 0.25, s * 0.33);
        g.fill();
        g.fillStyle = '#ffffff';
        g.fillRect(s * 0.49, s * 0.23, s * 0.02, s * 0.42);
        g.fillStyle = trim;
        g.fillRect(s * 0.19, s * 0.68, s * 0.62, s * 0.035);
    });
}

function stripeTex(a, b) {
    return tex(128, (g, s) => {
        for (let i = 0; i < 4; i++) {
            g.fillStyle = i % 2 ? b : a;
            g.fillRect(i * s / 4, 0, s / 4, s);
        }
    });
}

function makeMaterials() {
    const M = {};
    const T = (name, t, tile, extra) => {
        M[name] = toonMap(t, extra);
        M[name].userData.tile = tile;
    };
    T('asphalt', tex(256, (g, s) => {
        g.fillStyle = '#80858f';
        g.fillRect(0, 0, s, s);
        speckle(g, s, ['#737882', '#8d929b', '#6c717a'], 900, 2);
    }), [4, 4]);
    T('asphaltDark', tex(256, (g, s) => {
        g.fillStyle = '#6a6862';
        g.fillRect(0, 0, s, s);
        speckle(g, s, ['#5c5a55', '#77746d', '#4f4d49'], 900, 3);
        g.fillStyle = 'rgba(40,50,60,0.25)';
        g.beginPath();
        g.ellipse(s * 0.6, s * 0.4, s * 0.2, s * 0.08, 0.3, 0, Math.PI * 2);
        g.fill();
    }), [3, 3]);
    T('sidewalk', tex(128, (g, s) => {
        g.fillStyle = '#e4dccb';
        g.fillRect(0, 0, s, s);
        g.strokeStyle = '#c9bfa9';
        g.lineWidth = 3;
        g.strokeRect(1, 1, s / 2 - 2, s / 2 - 2);
        g.strokeRect(s / 2 + 1, 1, s / 2 - 2, s / 2 - 2);
        g.strokeRect(1, s / 2 + 1, s / 2 - 2, s / 2 - 2);
        g.strokeRect(s / 2 + 1, s / 2 + 1, s / 2 - 2, s / 2 - 2);
    }), [1, 1]);
    T('grass', tex(256, (g, s) => {
        g.fillStyle = '#98d56e';
        g.fillRect(0, 0, s, s);
        g.strokeStyle = '#7cc05a';
        g.lineWidth = 2;
        for (let i = 0; i < 160; i++) {
            const x = Math.random() * s, y = Math.random() * s;
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + 2, y - 7);
            g.stroke();
        }
    }), [2.5, 2.5]);
    T('sand', tex(128, (g, s) => {
        g.fillStyle = '#f0dca6';
        g.fillRect(0, 0, s, s);
        speckle(g, s, ['#e2c98d', '#f7e8bf'], 500, 2);
    }), [2, 2]);
    T('dirt', tex(128, (g, s) => {
        g.fillStyle = '#d3bd90';
        g.fillRect(0, 0, s, s);
        speckle(g, s, ['#c7b083', '#dccaa3', '#c2aa7c'], 700, 2);
    }), [2, 2]);
    T('gravel', tex(128, (g, s) => {
        g.fillStyle = '#d8d3c8';
        g.fillRect(0, 0, s, s);
        speckle(g, s, ['#c2bcaf', '#ece8df', '#aca597'], 900, 3);
    }), [1.5, 1.5]);
    T('block', tex(128, (g, s) => {
        g.fillStyle = '#cfcbc2';
        g.fillRect(0, 0, s, s);
        g.strokeStyle = '#aaa59a';
        g.lineWidth = 3;
        for (let r = 0; r < 4; r++) {
            g.beginPath();
            g.moveTo(0, r * s / 4);
            g.lineTo(s, r * s / 4);
            g.stroke();
            for (let k = 0; k < 2; k++) {
                const x = (k + (r % 2) * 0.5) * s / 2;
                g.beginPath();
                g.moveTo(x, r * s / 4);
                g.lineTo(x, (r + 1) * s / 4);
                g.stroke();
            }
        }
    }), [0.8, 0.8]);
    T('stone', tex(128, (g, s) => {
        g.fillStyle = '#bdb6a8';
        g.fillRect(0, 0, s, s);
        g.strokeStyle = '#968e7e';
        g.lineWidth = 3;
        for (let r = 0; r < 3; r++) {
            g.strokeRect(((r % 2) * 0.33) * s - s * 0.66, r * s / 3, s * 0.66, s / 3);
            g.strokeRect(((r % 2) * 0.33) * s, r * s / 3, s * 0.66, s / 3);
            g.strokeRect(((r % 2) * 0.33) * s + s * 0.66, r * s / 3, s * 0.66, s / 3);
        }
    }), [1.2, 1.2]);
    T('wood', tex(128, (g, s) => {
        g.fillStyle = '#c08a58';
        g.fillRect(0, 0, s, s);
        g.strokeStyle = '#a3703f';
        g.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            g.beginPath();
            g.moveTo(0, i * s / 8 + 4);
            g.bezierCurveTo(s * 0.3, i * s / 8, s * 0.6, i * s / 8 + 8, s, i * s / 8 + 4);
            g.stroke();
        }
    }), [1, 1]);
    T('roofTile', tex(128, (g, s) => {
        g.fillStyle = '#56647e';
        g.fillRect(0, 0, s, s);
        g.fillStyle = '#48546b';
        for (let i = 0; i < 4; i++) g.fillRect(0, i * s / 4, s, s / 12);
    }), [1, 1]);
    T('shutter', tex(128, (g, s) => {
        g.fillStyle = '#b9bec4';
        g.fillRect(0, 0, s, s);
        g.fillStyle = '#a2a7ad';
        for (let i = 0; i < 16; i++) g.fillRect(0, i * s / 16, s, 2);
    }), [1, 1]);
    T('awningBlue', stripeTex('#3d7fd6', '#ffffff'), [1, 1]);
    T('awningRed', stripeTex('#e0524a', '#ffffff'), [1, 1]);
    T('awningGreen', stripeTex('#3aa36b', '#fff6dc'), [1, 1]);
    [['facCream', '#f4e8cf', '#c9b48e'], ['facPink', '#f8d9d5', '#d5a39c'], ['facMint', '#d8efe0', '#9cc4aa'],
        ['facBlue', '#d9e6f4', '#9fb4cc'], ['facYellow', '#f7edbf', '#cdbd7a'], ['facGrey', '#dedcd8', '#a9a59e'],
        ['facKonbini', '#fbfbf8', '#46a3d8']].forEach(([n, c, t]) => T(n, facadeTex(c, t), [3, 3]));

    const C = (name, color, extra) => { M[name] = toon(color, extra); };
    C('white', 0xfafaf5);
    C('concrete', 0xc9c5bc);
    C('vermilion', 0xe2482f);
    C('black', 0x2c2a2e);
    C('metal', 0x9aa4ae);
    C('darkMetal', 0x4b5058);
    C('hedge', 0x5fb04f);
    C('leaf', 0x72c65a, { flatShading: true });
    C('leaf2', 0x57ab4d, { flatShading: true });
    C('trunk', 0x8a5b3b);
    C('roofRed', 0xc2594b);
    C('roofGreen', 0x4f8f6a);
    C('pipe', 0xb9b5ac);
    C('vendRed', 0xd9363f);
    C('vendBlue', 0x2f73d6);
    C('car', 0xf2f2f0);
    C('carDark', 0x3c4a5c);
    C('tire', 0x222222);
    C('crate', 0xe4b93a);
    C('crateBlue', 0x3a86c8);
    C('ice', 0xdff4ff);
    C('lantern', 0xff6b4a, { emissive: 0x552010 });
    C('grill', 0x3d3a38);
    C('cardboard', 0xc99a5f);
    C('water', 0x7cc6f0);
    C('slide', 0xf2a93b);
    C('bench', 0x9a6b44);
    C('bin', 0x3b7fc4);
    M.glass = new THREE.MeshBasicMaterial({ color: 0xbfe3f5, transparent: true, opacity: 0.45 });
    M.line = new THREE.MeshBasicMaterial({ color: 0x3b2f2a, side: THREE.BackSide });
    return M;
}

// ---------------------------------------------------------------- 組み立て

// 箱の UV を実寸に合わせて繰り返す（窓や模様がつぶれないように）
function boxGeo(x0, y0, z0, x1, y1, z1, tile) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const g = new THREE.BoxGeometry(w, h, d);
    if (tile) {
        const uv = g.attributes.uv;
        const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
        for (let f = 0; f < 6; f++) {
            for (let k = 0; k < 4; k++) {
                const i = f * 4 + k;
                uv.setXY(i, uv.getX(i) * dims[f][0] / tile[0], uv.getY(i) * dims[f][1] / tile[1]);
            }
        }
    }
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return g;
}

class Builder {
    constructor(M) {
        this.M = M;
        this.buckets = new Map();
        this.boxLines = [];
        this.smoothLines = [];
        this.colliders = [];
        this.map = [];
    }

    add(geo, mat) {
        if (!this.buckets.has(mat)) this.buckets.set(mat, []);
        this.buckets.get(mat).push(geo);
    }

    // 箱（当たり判定・輪郭線つき）
    box(x0, y0, z0, x1, y1, z1, mat, opt = {}) {
        this.add(boxGeo(x0, y0, z0, x1, y1, z1, mat.userData.tile), mat);
        if (opt.line !== false) {
            const t = opt.t || Math.min(0.03, Math.max(0.008, Math.min(x1 - x0, y1 - y0, z1 - z0) * 0.05));
            this.boxLines.push(boxGeo(x0 - t, y0 - t, z0 - t, x1 + t, y1 + t, z1 + t));
        }
        let c = null;
        if (opt.collide !== false) {
            c = new Box(x0, y0, z0, x1, y1, z1, opt.name);
            if (opt.noCam) c.noCam = true;
            this.colliders.push(c);
        }
        if (opt.map) this.map.push({ x0, z0, x1, z1, color: opt.map });
        return c;
    }

    // 地面に貼る面（当たり判定なし）
    flat(x0, z0, x1, z1, y, mat, map) {
        const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
        const tile = mat.userData.tile;
        if (tile) {
            const uv = g.attributes.uv;
            for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / tile[0], uv.getY(i) * (z1 - z0) / tile[1]);
        }
        g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
        this.add(g, mat);
        if (map) this.map.push({ x0, z0, x1, z1, color: map, ground: true });
    }

    // 丸いもの（木・柱など）。輪郭線は法線方向に膨らませる
    shape(geo, mat, line = true) {
        this.add(geo, mat);
        if (line) this.smoothLines.push(geo);
    }

    finish(scene) {
        const group = new THREE.Group();
        for (const [mat, list] of this.buckets) {
            const mesh = new THREE.Mesh(mergeGeometries(list.map(g => (g.index ? g : g)), false), mat);
            mesh.castShadow = !mat.transparent;
            mesh.receiveShadow = true;
            group.add(mesh);
        }
        if (this.boxLines.length) {
            group.add(new THREE.Mesh(mergeGeometries(this.boxLines, false), this.M.line));
        }
        if (this.smoothLines.length) {
            const om = outlineMaterial(0x3b2f2a);
            om.userData.thick.value = 0.025;
            group.add(new THREE.Mesh(mergeGeometries(this.smoothLines.map(g => g.clone()), false), om));
        }
        scene.add(group);
        return group;
    }
}

// 看板（文字のテクスチャを貼った板）
function signMesh(text, w, h, bg, fg, opt = {}) {
    const px = 128;
    const c = document.createElement('canvas');
    c.width = Math.round(px * w / h);
    c.height = px;
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    if (opt.border) {
        g.strokeStyle = opt.border;
        g.lineWidth = 10;
        g.strokeRect(5, 5, c.width - 10, c.height - 10);
    }
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = px * 0.62;
    g.font = `800 ${size}px "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif`;
    while (g.measureText(text).width > c.width * 0.9 && size > 10) {
        size -= 2;
        g.font = `800 ${size}px "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif`;
    }
    g.fillText(text, c.width / 2, c.height / 2 + 4);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
    return m;
}

// ---------------------------------------------------------------- 町

export function buildTown(scene) {
    const M = makeMaterials();
    const B = new Builder(M);
    const signs = new THREE.Group();
    scene.add(signs);
    const sign = (text, x, y, z, rotY, w, h, bg = '#fffaf0', fg = '#3b2f2a', opt) => {
        const m = signMesh(text, w, h, bg, fg, opt);
        m.position.set(x, y, z);
        m.rotation.y = rotY;
        signs.add(m);
        return m;
    };
    // 向き: 北(-z)を向く面は rotY=π、南(+z)は 0、東(+x)は π/2、西(-x)は -π/2
    const N = Math.PI, S = 0, E = Math.PI / 2, W = -Math.PI / 2;

    const spawns = {
        foods: [], trash: [], badges: [], npcs: [], bosses: {}, humans: [], crows: [], mice: null,
        dog: null, door: null, seat: null, home: new THREE.Vector3(3.2, 0, 40.4), homeHeading: -0.8,
        truckZ: [32.1, 33.9], grills: [], poles: []
    };
    const food = (type, x, y, z) => spawns.foods.push({ type, x, y, z });

    // ---------------- 地面
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2), M.asphalt.clone());
    ground.material.map = M.asphalt.map.clone();
    ground.material.map.repeat.set(65, 65);
    ground.material.map.needsUpdate = true;
    ground.position.set(32, 0, 24);
    ground.receiveShadow = true;
    scene.add(ground);

    const Y1 = 0.006, Y2 = 0.012;
    // 歩道と区画
    B.flat(0, 30, 64, 31, Y1, M.sidewalk, '#e4dccb');
    B.flat(0, 35, 64, 36.5, Y1, M.sidewalk, '#e4dccb');
    B.flat(9, 36.5, 48, 38.6, Y1, M.sidewalk, '#e4dccb');
    B.flat(0, 36, 9, 46, Y1, M.dirt, '#cdb68a');
    B.flat(1, 14, 13, 29.5, Y1, M.asphaltDark, '#77736b');
    B.flat(16, 13, 30, 30, Y1, M.grass, '#98d56e');
    B.flat(34, 13, 46, 30, Y1, M.dirt, '#cdb68a');
    B.flat(48, 13, 64, 30, Y1, M.grass, '#98d56e');
    B.flat(46, 13, 48, 30, Y1, M.sidewalk, '#e4dccb');
    B.flat(22, 0, 42, 10, Y1, M.grass, '#98d56e');
    B.flat(55.2, 20.2, 60.8, 25.8, Y2 + 0.19, M.sand, '#f0dca6');
    B.flat(22, 0, 42, 7, 1.4 + Y1, M.gravel);
    B.flat(52, 14, 58, 30, Y2, M.sand);
    // 白線
    for (let x = 1; x < 64; x += 3) {
        if (x > 29 && x < 35) continue;
        B.flat(x, 32.93, x + 1.6, 33.07, Y2, M.white);
    }
    B.flat(0, 31.15, 64, 31.25, Y2, M.white);
    B.flat(0, 34.75, 64, 34.85, Y2, M.white);
    for (let k = 0; k < 7; k++) B.flat(30.2, 31.3 + k * 0.5, 33.8, 31.55 + k * 0.5, Y2 + 0.002, M.white);
    for (let x = 49; x < 64; x += 2.6) B.flat(x, 36.8, x + 0.1, 41, Y2, M.white);
    B.flat(48, 36, 64, 46, Y1, M.asphalt, '#80858f');

    // ---------------- 外周（町の端）
    const wall = (x0, z0, x1, z1, h, mat = M.block) => B.box(x0, 0, z0, x1, h, z1, mat, { map: '#b7b2a8' });
    wall(-0.3, 13.8, 0.8, 30, 2.4);
    wall(-0.3, 36, 0.15, 46.3, 1.8);
    wall(0, 46, 64, 46.3, 1.8);
    wall(63.7, 13, 64.2, 30, 1.2, M.hedge);
    wall(63.85, 36, 64.2, 46.3, 1.4);
    // 北側の家並み
    const building = (x0, z0, x1, z1, h, fac, roof = M.roofTile, name) => {
        B.box(x0, 0, z0, x1, h, z1, fac, { map: '#c9b9a0', name });
        B.box(x0 - 0.15, h, z0 - 0.15, x1 + 0.15, h + 0.25, z1 + 0.15, roof, { map: '#8d8f9a' });
    };
    building(0, 0.5, 7, 9.6, 6, M.facCream);
    building(7.4, 1, 14, 9.6, 5, M.facBlue);
    building(14.4, 0.5, 21.6, 9.6, 7, M.facPink);
    building(42.4, 0.5, 49, 9.6, 6.5, M.facMint);
    building(49.4, 1, 56, 9.6, 5, M.facYellow);
    building(56.4, 0.5, 64, 9.6, 6, M.facGrey);
    // 遠景のビル（町の外。当たり判定なし）
    const far = (x0, z0, x1, z1, h, fac) => B.box(x0, 0, z0, x1, h, z1, fac, { collide: false, t: 0.06 });
    far(-14, -12, 2, -1, 14, M.facGrey);
    far(4, -14, 20, -2, 18, M.facBlue);
    far(24, -16, 40, -8, 10, M.facCream);
    far(44, -13, 60, -2, 16, M.facMint);
    far(62, -12, 78, 4, 12, M.facPink);
    far(68, 6, 80, 28, 15, M.facYellow);
    far(68, 38, 82, 56, 13, M.facGrey);
    far(40, 49, 62, 60, 11, M.facCream);
    far(10, 49, 36, 58, 14, M.facBlue);
    far(-16, 38, -3, 58, 12, M.facMint);
    far(-16, 4, -4, 28, 16, M.facCream);

    // ---------------- 商店街（南側の店）
    // 空き地の家（段ボール）と土管
    const hx = 2.2, hz = 43.2;
    B.box(hx - 0.35, 0, hz - 0.02, hx + 0.35, 0.02, hz + 0.5, M.cardboard, { collide: false });
    B.box(hx - 0.35, 0, hz + 0.45, hx + 0.35, 0.45, hz + 0.5, M.cardboard, { name: 'homebox' });
    B.box(hx - 0.35, 0, hz - 0.02, hx - 0.3, 0.45, hz + 0.5, M.cardboard, { name: 'homebox' });
    B.box(hx + 0.3, 0, hz - 0.02, hx + 0.35, 0.45, hz + 0.5, M.cardboard, { name: 'homebox' });
    sign('ねこのいえ', hx, 0.3, hz + 0.44, N, 0.5, 0.14, '#c99a5f', '#5a3a1a');
    const pipeGeo = (x, y, z, len, r) => {
        const g = new THREE.CylinderGeometry(r, r, len, 24, 1, false).rotateZ(Math.PI / 2).translate(x, y, z);
        B.shape(g, M.pipe);
    };
    pipeGeo(6.5, 0.45, 42.3, 1.8, 0.45);
    pipeGeo(6.5, 0.45, 43.3, 1.8, 0.45);
    pipeGeo(6.5, 1.22, 42.8, 1.8, 0.45);
    B.colliders.push(Object.assign(new Box(5.6, 0, 41.85, 7.4, 0.8, 43.75, 'pipes'), { noCam: true }));
    B.colliders.push(new Box(5.6, 0.8, 42.4, 7.4, 1.62, 43.2, 'pipes'));
    B.map.push({ x0: 5.6, z0: 41.85, x1: 7.4, z1: 43.75, color: '#b9b5ac' });
    B.box(1.2, 0, 44.6, 2.6, 0.35, 45.6, M.wood, { name: 'pallet' });

    // 魚屋
    building(9, 38.6, 17, 46, 5.5, M.facCream, M.roofTile, 'fishshop');
    B.box(10, 0, 37.0, 16, 0.8, 38.0, M.wood, { name: 'counter', map: '#c08a58' });
    B.box(10.05, 0.8, 37.05, 15.95, 0.82, 37.95, M.ice, { collide: false, line: false });
    B.box(9, 2.3, 37.2, 17, 2.4, 38.6, M.awningBlue, { name: 'awning' });
    sign('鮮魚 うおまさ', 13, 3.1, 38.58, N, 3.6, 0.7, '#1f5fa8', '#ffffff');
    [[11, 37.5], [13, 37.5], [15, 37.5]].forEach(([x, z]) => food('fish', x, 0.82, z));
    // 日よけに登るためのビールケース
    B.box(9.1, 0, 35.6, 9.6, 0.55, 36.1, M.crate);
    B.box(9.1, 0, 36.15, 9.6, 1.1, 36.65, M.crate);
    B.box(9.1, 0, 36.7, 9.6, 1.65, 37.15, M.crateBlue);
    spawns.humans.push({ kind: 'fishmonger', x0: 10.6, x1: 15.4, z: 38.3 });

    // 焼き鳥屋
    building(17, 38.6, 23, 46, 5, M.facYellow, M.roofRed);
    B.box(18, 0, 37.3, 22, 0.9, 38.1, M.grill, { name: 'grill', map: '#3d3a38' });
    spawns.grills.push(new Box(18, 0.85, 37.3, 22, 1.3, 38.1));
    B.box(17, 2.4, 37.6, 23, 2.5, 38.6, M.awningRed, { name: 'awning' });
    sign('やきとり とり吉', 20, 3.1, 38.58, N, 3.2, 0.7, '#8c1c13', '#ffe9b0');
    [[19, 37.4], [20, 37.4], [21, 37.4]].forEach(([x, z]) => food('yakitori', x, 0.9, z));
    [18.4, 21.6].forEach(x => {
        const g = new THREE.SphereGeometry(0.2, 16, 12).scale(1, 1.3, 1).translate(x, 2.2, 37.7);
        B.shape(g, M.lantern);
    });
    spawns.humans.push({ kind: 'yakitori', x0: 19.5, x1: 20.5, z: 38.35 });

    // パン屋（隣のコンビニとの間に 12kg までの隙間）
    const gap12 = CFG.gapFor(12);
    building(23, 38.6, 31 - gap12, 46, 5, M.facPink, M.roofRed);
    B.box(24, 0, 36.9, 30, 0.6, 37.6, M.wood, { name: 'shelf', map: '#c08a58' });
    B.box(23, 2.4, 37.6, 30.5, 2.5, 38.6, M.awningGreen, { name: 'awning' });
    sign('ベーカリー こむぎ', 27, 3.1, 38.58, N, 3.4, 0.7, '#fff3e0', '#a0522d', { border: '#e79a9a' });
    [[25, 37.25], [27, 37.25], [29, 37.25]].forEach(([x, z]) => food('melonpan', x, 0.6, z));
    sign('← 12kgまで', 30.1, 0.7, 38.57, N, 0.9, 0.22, '#ffffff', '#d62839');
    B.box(31 - gap12, 0, 45.8, 31, 1.8, 46, M.block);

    // コンビニ
    building(31, 38.6, 41, 46, 4, M.facKonbini, M.roofGreen);
    B.box(31, 3.2, 38.5, 41, 3.6, 38.62, M.crateBlue, { collide: false });
    sign('にゃ〜マート', 36, 3.4, 38.45, N, 3.2, 0.42, '#2f8fd0', '#ffffff');
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.2), M.glass);
    glass.position.set(35, 1.2, 38.58);
    glass.rotation.y = N;
    signs.add(glass);
    B.box(36.5, 0, 37.6, 38, 0.9, 38.55, M.white, { name: 'freezer', map: '#ffffff' });
    B.box(38.05, 0, 37.9, 38.95, 1.35, 38.55, M.cardboard, { name: 'boxes' });
    B.box(39, 0, 37.7, 39.95, 1.8, 38.55, M.vendRed, { name: 'vending', map: '#d9363f' });
    B.box(39.95, 0, 37.7, 40.9, 1.8, 38.55, M.vendBlue, { name: 'vending', map: '#2f73d6' });
    sign('つめた〜い', 39.47, 1.5, 37.69, N, 0.8, 0.2, '#2f73d6', '#ffffff');
    spawns.trash.push({ x: 32.4, z: 38.1 });

    // 空き店舗
    building(41, 38.6, 48, 46, 5, M.facGrey, M.roofTile);
    B.box(41.3, 0, 38.55, 47.7, 2.6, 38.62, M.shutter, { collide: false });
    sign('テナント募集', 44.5, 3.2, 38.58, N, 2.4, 0.5, '#ffffff', '#666666');

    // 駐車場の車（車の下は 6kg 以下なら潜れる）
    const car = (x, z, mat) => {
        B.box(x - 2, 0.26, z - 0.85, x + 2, 0.82, z + 0.85, mat, { name: 'car', map: '#9fb2c8' });
        B.box(x - 1.1, 0.82, z - 0.78, x + 1.2, 1.4, z + 0.78, M.carDark, { name: 'car' });
        [[-1.35, -0.8], [1.35, -0.8], [-1.35, 0.8], [1.35, 0.8]].forEach(([dx, dz]) => {
            const g = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 20).rotateX(Math.PI / 2).translate(x + dx, 0.3, z + dz);
            B.shape(g, M.tire);
            B.colliders.push(new Box(x + dx - 0.3, 0, z + dz - 0.11, x + dx + 0.3, 0.26, z + dz + 0.11, 'tire'));
        });
    };
    car(54, 39.9, M.car);
    car(60.5, 42.8, M.vendBlue);
    sign('P 月極', 50, 1.6, 36.2, N, 0.8, 0.8, '#1f5fa8', '#ffffff');

    // ---------------- 電柱と電線
    const poleAt = [];
    [6, 18, 30, 42, 54].forEach(x => poleAt.push([x, 30.35], [x + 6, 35.65]));
    [[12, 12.7], [24, 12.7], [44, 12.7], [56, 12.7], [30.3, 20], [33.7, 26]].forEach(p => poleAt.push(p));
    poleAt.forEach(([x, z]) => {
        B.shape(new THREE.CylinderGeometry(0.1, 0.13, 7, 12).translate(x, 3.5, z), M.concrete);
        B.box(x - 0.6, 6.3, z - 0.05, x + 0.6, 6.4, z + 0.05, M.darkMetal, { collide: false });
        B.colliders.push(Object.assign(new Box(x - 0.12, 0, z - 0.12, x + 0.12, 7, z + 0.12, 'pole'), { noCam: true }));
        spawns.poles.push(new THREE.Vector3(x, 7.05, z));
    });
    const wires = new THREE.Group();
    const wireMat = new THREE.LineBasicMaterial({ color: 0x2a2a2a });
    const linkPoles = (a, b) => {
        const pts = [];
        for (let k = 0; k <= 12; k++) {
            const t = k / 12;
            pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, 6.35 - Math.sin(Math.PI * t) * 0.4, a[1] + (b[1] - a[1]) * t));
        }
        wires.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    };
    for (let i = 0; i + 2 < 10; i += 2) {
        linkPoles(poleAt[i], poleAt[i + 2]);
        linkPoles(poleAt[i + 1], poleAt[i + 3]);
    }
    scene.add(wires);
    spawns.crows.push({ perch: 0 }, { perch: 5 });

    // ---------------- 路地裏（入口は 8kg までの隙間、出口は 35kg で押せる重い扉）
    const gap8 = CFG.gapFor(8);
    const gz = 21.5;
    wall(0.8, 13.8, 13.2, 14, 2.4);
    wall(13, 14, 13.2, gz, 2.4);
    wall(13, gz + gap8, 13.2, 29.7, 2.4);
    wall(0.8, 29.5, 6, 29.7, 2.4);
    wall(7.2, 29.5, 13.2, 29.7, 2.4);
    B.box(6, 2.2, 29.5, 7.2, 2.4, 29.7, M.block, { collide: false });
    const door = new Box(6, 0, 29.45, 7.2, 2.2, 29.75, 'door');
    B.colliders.push(door);
    spawns.door = { box: door, hinge: new THREE.Vector3(6, 0, 29.6), width: 1.2, height: 2.2 };
    sign('この先 路地裏　8kgまで', 13.21, 1.0, gz + gap8 / 2, E, 1.6, 0.3, '#ffffff', '#3b2f2a', { border: '#d62839' });
    sign('重い扉 →35kgで押せる', 6.6, 2.35, 29.44, N, 1.4, 0.2, '#ffe066', '#3b2f2a');
    sign('関係者以外立入禁止', 6.6, 1.6, 29.76, S, 1.2, 0.22, '#ffffff', '#d62839');
    // 路地裏の中: 室外機・木箱・ゴミ
    B.box(1, 0, 14.2, 3, 0.6, 15.8, M.cardboard, { name: 'crates' });
    B.box(1, 0.6, 14.2, 2, 1.1, 15.2, M.cardboard, { name: 'crates' });
    B.box(1, 0, 20, 1.7, 0.7, 21.2, M.metal, { name: 'ac' });
    B.box(1, 0, 25, 1.7, 0.7, 26.2, M.metal, { name: 'ac' });
    B.box(9.5, 0, 14.2, 12.8, 1.2, 15, M.darkMetal, { name: 'dumpster', map: '#4b5058' });
    B.box(4.5, 0, 17.5, 6, 0.45, 18.6, M.crateBlue, { name: 'crate' });
    B.box(9.8, 0, 26.5, 11.3, 0.45, 27.6, M.crate, { name: 'crate' });
    [[3.5, 16.5], [11.5, 17], [8.5, 24.5], [3, 27.8]].forEach(([x, z]) => food('ramen', x, 0, z));
    [[6.5, 20], [11.8, 22.5], [2.5, 23.5]].forEach(([x, z]) => food('zanpan', x, 0, z));
    [[5, 26.5], [10.5, 19.5]].forEach(([x, z]) => food('bone', x, 0, z));
    spawns.trash.push({ x: 3.4, z: 19 }, { x: 12.2, z: 25.5 });
    spawns.mice = { x0: 2, z0: 16, x1: 12, z1: 28.5, count: 3 };
    spawns.bosses.kuro = { x: 7, y: 0, z: 22.5, arena: [1.8, 16, 12.4, 28.9] };

    // 裏道
    B.flat(13.2, 13, 16, 30, Y2, M.asphalt, '#80858f');
    spawns.trash.push({ x: 15.5, z: 29.4 });
    spawns.npcs.push({ palette: 'hachi', x: 14.6, z: 20.2, lines: [
        '路地裏のクロは 40kg の大物だよ',
        'この隙間、8kg までしか通れないんだ。F で吐けば痩せられる',
        '中で太りすぎると出られない…でも内側の重い扉は 35kg あれば押せるらしい',
        '詰まったら、とにかく F 連打だ'
    ] });

    // ---------------- 住宅街: ミケ姐さんの家（屋上まで段々に登れる）
    const R = 3.65;
    B.box(16.5, 0, 14.5, 28, R - 0.1, 26.5, M.facBlue, { map: '#a9b8d0', name: 'house' });
    B.box(16.4, R - 0.1, 14.4, 28.1, R, 26.6, M.concrete, { name: 'roof' });
    // 屋上のふち・貯水タンク・干物の網
    B.box(16.4, R, 14.4, 28.1, R + 0.08, 14.5, M.concrete, { name: 'parapet' });
    B.box(16.4, R, 14.4, 16.5, R + 0.08, 26.6, M.concrete, { name: 'parapet' });
    B.box(28, R, 14.4, 28.1, R + 0.08, 26.6, M.concrete, { name: 'parapet' });
    B.box(25, R, 15.2, 27, R + 1.1, 17, M.white, { name: 'tank' });
    [[18, 17], [18.8, 17], [18, 17.8], [18.8, 17.8]].forEach(([x, z]) => food('himono', x, R, z));
    B.box(17.6, R, 16.6, 17.66, R + 0.7, 16.66, M.metal, { collide: false });
    B.box(19.2, R, 18.2, 19.26, R + 0.7, 18.26, M.metal, { collide: false });
    spawns.bosses.mike = { x: 23, y: R, z: 21, arena: [16.9, 14.9, 27.6, 26.2] };
    // 登る道: 植木鉢台 → 物置 → 室外機 → ベランダ → 室外機 → 屋上
    B.box(17, 0, 26.6, 17.8, 0.5, 27.3, M.wood, { name: 'potstand' });
    B.box(17.9, 0, 26.55, 19.4, 1.1, 27.6, M.facGrey, { name: 'shed' });
    B.box(17.85, 1.1, 26.5, 19.45, 1.16, 27.65, M.roofGreen, { name: 'shed' });
    B.box(19.5, 1.4, 26.5, 20.5, 1.75, 27.4, M.metal, { name: 'ac' });
    B.box(20.9, 2.3, 26.5, 24.5, 2.4, 27.7, M.concrete, { name: 'balcony' });
    B.box(20.9, 2.4, 27.6, 24.5, 3.0, 27.7, M.white, { name: 'rail', t: 0.01 });
    B.box(24.4, 2.4, 26.5, 24.5, 3.0, 27.7, M.white, { name: 'rail', t: 0.01 });
    B.box(23.5, 2.4, 26.5, 24.4, 3.0, 27.35, M.metal, { name: 'ac' });
    sign('屋上へは 18kgまで', 18.65, 0.75, 27.61, S, 0.9, 0.2, '#ffffff', '#3b2f2a');
    // 庭の生け垣
    B.box(16, 0, 29.6, 21, 0.5, 30, M.hedge, { map: '#5fb04f' });
    B.box(24, 0, 29.6, 29.5, 0.5, 30, M.hedge, { map: '#5fb04f' });
    const tree = (x, z, s = 1) => {
        B.shape(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1.8 * s, 10).translate(x, 0.9 * s, z), M.trunk);
        B.colliders.push(Object.assign(new Box(x - 0.16 * s, 0, z - 0.16 * s, x + 0.16 * s, 1.8 * s, z + 0.16 * s, 'tree'), { noCam: true }));
        B.shape(new THREE.SphereGeometry(1.0 * s, 9, 7).scale(1, 0.85, 1).translate(x, 2.2 * s, z), M.leaf);
        B.shape(new THREE.SphereGeometry(0.7 * s, 9, 7).translate(x + 0.55 * s, 2.7 * s, z - 0.2 * s), M.leaf2);
        B.shape(new THREE.SphereGeometry(0.6 * s, 9, 7).translate(x - 0.5 * s, 2.8 * s, z + 0.3 * s), M.leaf);
        B.map.push({ x0: x - s, z0: z - s, x1: x + s, z1: z + s, color: '#5fae4f', round: true });
    };
    tree(29, 15.5, 0.9);
    tree(29, 28, 0.8);

    // ---------------- 坂道（南北の道）と神社
    B.flat(30, 13, 34, 30, Y2, M.asphalt, '#80858f');
    B.flat(0, 10, 64, 13, Y1, M.asphalt, '#80858f');
    const PL = 1.4;
    B.box(22, 0, 0, 30, PL, 7, M.stone, { map: '#bdb6a8', name: 'plateau' });
    B.box(34, 0, 0, 42, PL, 7, M.stone, { map: '#bdb6a8', name: 'plateau' });
    B.box(30, 0, 0, 34, PL, 6.95, M.stone, { name: 'plateau' });
    for (let i = 0; i < 10; i++) {
        B.box(30, 0, 10 - 0.3 * (i + 1), 34, 0.14 * (i + 1), 10 - 0.3 * i, M.stone, { name: 'stairs', t: 0.01, map: '#d0c9bb' });
    }
    B.box(29.7, 0, 7, 30, PL + 0.5, 10, M.stone, { name: 'stairwall' });
    B.box(34, 0, 7, 34.3, PL + 0.5, 10, M.stone, { name: 'stairwall' });
    // 鳥居
    [30.7, 33.3].forEach(x => {
        B.shape(new THREE.CylinderGeometry(0.16, 0.18, 3.6, 16).translate(x, PL + 1.8, 5.8), M.vermilion);
        B.colliders.push(Object.assign(new Box(x - 0.18, PL, 5.62, x + 0.18, PL + 3.6, 5.98, 'torii'), { noCam: true }));
    });
    B.box(29.9, PL + 3.6, 5.6, 34.1, PL + 3.85, 6.0, M.black, { name: 'torii' });
    B.box(30.2, PL + 3.1, 5.68, 33.8, PL + 3.28, 5.92, M.vermilion, { name: 'torii' });
    sign('猫神社', 32, PL + 3.35, 6.01, S, 0.8, 0.3, '#1c1c1c', '#ffd166');
    // 拝殿
    B.box(28.5, PL, 0.6, 35.5, PL + 0.5, 3.6, M.wood, { name: 'haiden', map: '#a3703f' });
    B.box(29, PL + 0.5, 0.8, 35, PL + 2.8, 3.2, M.wood, { name: 'haiden' });
    B.box(28.4, PL + 2.8, 0.4, 35.6, PL + 3.1, 3.8, M.roofGreen, { name: 'haiden' });
    B.box(29.2, PL + 3.1, 0.8, 34.8, PL + 3.6, 3.4, M.roofGreen, { name: 'haiden' });
    B.box(31.2, PL + 0.5, 3.25, 32.8, PL + 1.9, 3.3, M.vermilion, { collide: false });
    B.box(31.3, PL, 3.7, 32.7, PL + 0.6, 4.2, M.wood, { name: 'saisen' });
    sign('賽銭', 32, PL + 0.4, 4.21, S, 0.5, 0.16, '#6b4423', '#ffffff');
    // 町内会長の座（座布団）
    B.box(31.45, PL, 4.5, 32.55, PL + 0.35, 5.3, M.stone, { name: 'seatbase' });
    const zab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.6), toon(0xc0282e));
    zab.position.set(32, PL + 0.39, 4.9);
    zab.castShadow = true;
    signs.add(zab);
    sign('町内会長の座', 32, PL + 0.18, 5.31, S, 0.9, 0.2, '#ffffff', '#c0282e');
    spawns.seat = { x0: 31.45, x1: 32.55, z0: 4.5, z1: 5.3, y: PL + 0.35 };
    // 灯籠
    [[26.5, 5], [37.5, 5]].forEach(([x, z]) => {
        B.box(x - 0.35, PL, z - 0.35, x + 0.35, PL + 0.5, z + 0.35, M.stone, { name: 'lantern' });
        B.box(x - 0.14, PL + 0.5, z - 0.14, x + 0.14, PL + 1.0, z + 0.14, M.stone, { name: 'lantern' });
        B.box(x - 0.3, PL + 1.0, z - 0.3, x + 0.3, PL + 1.3, z + 0.3, M.stone, { name: 'lantern' });
    });
    tree(24, 2.5, 1.2);
    tree(40, 2, 1.1);
    tree(24.5, 8.6, 0.7);
    tree(39.5, 8.6, 0.7);
    food('catnip', 40.5, PL, 5.5);

    // ---------------- 犬のいる家
    B.box(36, 0, 14, 45.5, 5, 22, M.facMint, { map: '#a9c9b4', name: 'house' });
    const roofGeo = new THREE.CylinderGeometry(0.01, 5.6, 2, 4, 1).rotateY(Math.PI / 4).scale(1.35, 1, 1).translate(40.75, 6, 18);
    B.shape(roofGeo, M.roofRed);
    B.box(34.3, 0, 22, 34.45, 1.1, 25, M.block, { map: '#b7b2a8', name: 'yardwall' });
    B.box(34.3, 0, 26.2, 34.45, 1.1, 29.6, M.block, { map: '#b7b2a8', name: 'yardwall' });
    B.box(34.3, 0, 29.45, 45.8, 1.1, 29.6, M.block, { map: '#b7b2a8', name: 'yardwall' });
    B.box(45.65, 0, 22, 45.8, 1.1, 29.6, M.block, { map: '#b7b2a8', name: 'yardwall' });
    sign('猛犬注意', 40, 0.75, 29.61, S, 0.8, 0.26, '#ffe066', '#d62839');
    B.box(44.6, 0, 29.7, 45.2, 0.55, 30.3, M.crateBlue, { name: 'bucket' });
    // 犬小屋
    B.box(40, 0, 23.2, 41.2, 0.8, 24.2, M.wood, { name: 'doghouse' });
    B.box(39.9, 0.8, 23.1, 41.3, 0.95, 24.3, M.roofRed, { name: 'doghouse' });
    spawns.dog = { x: 40.6, z: 24.9, anchor: new THREE.Vector3(40.6, 0, 24.4), chain: 3.4 };
    food('dogfood', 42.2, 0, 24.6);

    // ---------------- 公園
    B.box(47.6, 0, 13, 48, 0.6, 18, M.hedge, { map: '#5fb04f' });
    B.box(47.6, 0, 20, 48, 0.6, 27, M.hedge, { map: '#5fb04f' });
    B.box(48, 0, 29.6, 54, 0.6, 30, M.hedge, { map: '#5fb04f' });
    B.box(58, 0, 29.6, 63.7, 0.6, 30, M.hedge, { map: '#5fb04f' });
    B.box(48, 0, 13, 54, 0.6, 13.4, M.hedge, { map: '#5fb04f' });
    B.box(58, 0, 13, 63.7, 0.6, 13.4, M.hedge, { map: '#5fb04f' });
    sign('ねこじゃらし公園', 51, 0.85, 30.02, S, 1.8, 0.4, '#3aa36b', '#ffffff');
    [50.2, 51.8].forEach(x => B.box(x - 0.04, 0.6, 30.0, x + 0.04, 0.65, 30.06, M.wood, { collide: false, line: false }));
    // ベンチ（おばあちゃん）
    B.box(49.8, 0, 14.6, 52, 0.42, 15.2, M.bench, { name: 'bench', map: '#9a6b44' });
    B.box(49.8, 0.42, 14.5, 52, 0.95, 14.6, M.bench, { name: 'bench' });
    spawns.humans.push({ kind: 'grandma', x: 50.9, z: 14.95 });
    food('kibble', 50.9, 0, 16.0);
    // 砂場（ブチの縄張り）
    B.box(55, 0, 20, 61, 0.2, 20.2, M.wood, { name: 'sandbox', t: 0.01 });
    B.box(55, 0, 25.8, 61, 0.2, 26, M.wood, { name: 'sandbox', t: 0.01 });
    B.box(55, 0, 20.2, 55.2, 0.2, 25.8, M.wood, { name: 'sandbox', t: 0.01 });
    B.box(60.8, 0, 20.2, 61, 0.2, 25.8, M.wood, { name: 'sandbox', t: 0.01 });
    B.colliders.push(new Box(55.2, 0, 20.2, 60.8, 0.19, 25.8, 'sandfloor'));
    spawns.bosses.buchi = { x: 58, y: 0.19, z: 23, arena: [54.2, 19.2, 61.8, 26.8] };
    // すべり台
    B.box(60, 0, 14.4, 61.2, 1.5, 15.6, M.slide, { name: 'slide', map: '#f2a93b' });
    [0.4, 0.8, 1.15].forEach((h, i) => B.box(61.25 + i * 0.001, 0, 14.6, 61.25 + (3 - i) * 0.3, h, 15.4, M.metal, { name: 'ladder' }));
    const slide = new THREE.BoxGeometry(2.6, 0.06, 1).rotateZ(0.5).translate(58.9, 0.8, 15);
    B.shape(slide, M.slide);
    B.box(57.2, 0, 14.5, 58.1, 0.18, 15.5, M.slide, { name: 'slideend', t: 0.01 });
    // 水飲み場・木・またたび
    B.box(50, 0, 24, 50.6, 0.8, 24.6, M.concrete, { name: 'fountain' });
    B.box(49.95, 0.8, 23.95, 50.65, 0.86, 24.65, M.water, { collide: false });
    tree(50, 20, 1.1);
    tree(62, 18, 1);
    tree(52.5, 27.5, 0.9);
    tree(62.2, 27.2, 1.1);
    food('catnip', 61.4, 0, 28.5);
    spawns.npcs.push({ palette: 'shiro', x: 53, z: 28.6, lines: [
        'ブチは砂場にいるよ。25kg だから、軽いとパンチが効かないんだ',
        'ベンチのおばあちゃんに E で鳴いてごらん。おやつをくれるよ',
        'すべり台の上に何か光ってたよ',
        'またたびは…ほどほどにね'
    ] });

    // ---------------- 空き地の猫・横断歩道のそば
    spawns.npcs.push({ palette: 'tora', x: 5.2, z: 38.8, lines: [
        'この町の「町内会長の座」は、3匹のボスを倒した猫のものさ',
        'ミケ姐さんは住宅街の屋上。太ってると登れない（18kg まで）',
        '食べるほど強くなる。でも太りすぎると隙間を通れないし、100kg で破裂する',
        '大通りのトラックには気をつけな。まともに当たったら終わりだよ'
    ] });
    spawns.trash.push({ x: 46.8, z: 12.6 }, { x: 26, z: 12.6 });

    // ---------------- 猫缶バッジ（10個）
    spawns.badges = [
        [27, R, 25.5], [40.4, 1.8, 38.1], [54, 0, 39.9], [45.72, 1.1, 22.3], [60.6, 1.5, 15],
        [1.5, 1.1, 14.7], [37.5, PL + 1.3, 5], [13, 2.4, 37.9], [31 - gap12 / 2, 0, 45.4], [6.5, 1.67, 42.8]
    ];

    // 地域の名前（地図の見出し）
    spawns.areas = [
        { name: '屋上', x0: 16.4, z0: 14.4, x1: 28.1, z1: 26.6, y: 3 },
        { name: '路地裏', x0: 0.8, z0: 13.8, x1: 13.2, z1: 29.7 },
        { name: '神社', x0: 22, z0: 0, x1: 42, z1: 10 },
        { name: 'ねこじゃらし公園', x0: 47.6, z0: 13, x1: 64, z1: 30 },
        { name: '空き地（おうち）', x0: 0, z0: 36, x1: 9, z1: 46 },
        { name: '駐車場', x0: 48, z0: 36, x1: 64, z1: 46 },
        { name: '商店街', x0: 0, z0: 30, x1: 64, z1: 46 },
        { name: '犬のいる家', x0: 34, z0: 13, x1: 46, z1: 30 },
        { name: '住宅街', x0: 0, z0: 0, x1: 64, z1: 30 }
    ];

    const group = B.finish(scene);
    const colliders = B.colliders;
    return { group, colliders, grid: new Grid(colliders), spawns, map: B.map, M };
}
