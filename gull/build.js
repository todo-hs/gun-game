// 建物づくりの道具: 当たり判定の箱・升目・テクスチャ・まとめ描画・看板
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { outlineMaterial } from './toon.js';

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
        this.cell = 6;
        this.x0 = -30;
        this.z0 = -30;
        this.nx = 36;
        this.nz = 30;
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

export function tex(size, draw, h = size) {
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

export function speckle(g, s, colors, n, r) {
    for (let i = 0; i < n; i++) {
        g.fillStyle = colors[i % colors.length];
        g.fillRect(Math.random() * s, Math.random() * s, r, r);
    }
}

export function facadeTex(color, trim) {
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

export function stripeTex(a, b) {
    return tex(128, (g, s) => {
        for (let i = 0; i < 4; i++) {
            g.fillStyle = i % 2 ? b : a;
            g.fillRect(i * s / 4, 0, s / 4, s);
        }
    });
}


export function boxGeo(x0, y0, z0, x1, y1, z1, tile) {
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

export class Builder {
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
            const t = opt.t || Math.min(0.06, Math.max(0.01, Math.min(x1 - x0, y1 - y0, z1 - z0) * 0.05));
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
            om.userData.thick.value = 0.04;
            group.add(new THREE.Mesh(mergeGeometries(this.smoothLines.map(g => g.clone()), false), om));
        }
        scene.add(group);
        return group;
    }
}

// 看板（文字のテクスチャを貼った板）
export function signMesh(text, w, h, bg, fg, opt = {}) {
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
