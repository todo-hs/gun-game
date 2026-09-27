// アニメ調の猫（プレイヤーと町の猫で共通）
// 顔は頭の前にかぶせた「顔パーツ」に描いた絵で、表情を差し替える。
// 猫のローカル座標: +x が前、+y が上。root の位置は足元。
import * as THREE from 'three';
import { CFG } from './config.js';
import { toon, toonMap, addOutline, refreshOutlines } from './toon.js';

// 毛色
export const PALETTES = {
    player: { name: 'クリーム', base: '#ffd8a0', stripe: 'rgba(236,150,70,0.5)', belly: '#fffaf0', muzzle: '#fffaf0', ear: '#ffcf92', iris: ['#9a5a0a', '#ffc53d'], tailTip: '#fffaf0' },
    kuro: { name: '黒', base: '#34303a', stripe: null, belly: '#34303a', muzzle: '#4a4452', ear: '#34303a', iris: ['#1f6b2a', '#b7f05a'], tailTip: '#34303a', line: '#0e0c10' },
    mike: { name: '三毛', base: '#fffaf0', stripe: null, belly: '#fffaf0', muzzle: '#fffaf0', ear: '#f3a45a', iris: ['#1d5f93', '#7fd0ff'], tailTip: '#2e2724', patches: [['#f3a45a', 0.2, 0.15, 0.22], ['#2e2724', 0.62, 0.2, 0.2], ['#f3a45a', 0.8, 0.45, 0.15], ['#2e2724', 0.05, 0.4, 0.14]] },
    buchi: { name: 'グレー', base: '#a3a9b1', stripe: 'rgba(55,60,70,0.55)', belly: '#eef1f4', muzzle: '#eef1f4', ear: '#a3a9b1', iris: ['#7a6a10', '#f0da4a'], tailTip: '#55585f' },
    tora: { name: '茶トラ', base: '#f5a55a', stripe: 'rgba(190,90,30,0.6)', belly: '#fff3e0', muzzle: '#fff3e0', ear: '#f5a55a', iris: ['#2f7a2f', '#a6e05a'], tailTip: '#c9702a' },
    shiro: { name: '白', base: '#fdfdfd', stripe: null, belly: '#fdfdfd', muzzle: '#fdfdfd', ear: '#f4f4f4', iris: ['#2a6ad0', '#8fd4ff'], tailTip: '#fdfdfd' },
    hachi: { name: 'ハチワレ', base: '#2e2a30', stripe: null, belly: '#fffaf0', muzzle: '#fffaf0', ear: '#2e2a30', iris: ['#8a5a0a', '#ffd23d'], tailTip: '#2e2a30' }
};

function canvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

const texCache = {};

// 胴体: 背骨の向き（x 軸）を極にした球に貼る。u は背骨の周り（0 と 1 が背中、0.5 がお腹）、v は頭(0)からお尻(1)
function bodyTexture(p) {
    return canvas(512, 256, (ctx, w, h) => {
        ctx.fillStyle = p.base;
        ctx.fillRect(0, 0, w, h);
        (p.patches || []).forEach(([c, u, v, r]) => {
            // 背中側（u が 0 か 1 に近いところ）に模様を置く
            const cu = (u < 0.5 ? u * 0.5 : 1 - (1 - u) * 0.5);
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.ellipse(cu * w, (0.2 + v * 0.7) * h, r * w * 0.8, r * h * 1.6, 0, 0, Math.PI * 2);
            ctx.fill();
        });
        if (p.stripe) {
            // 背中を横切るトラ縞
            ctx.strokeStyle = p.stripe;
            ctx.lineCap = 'round';
            ctx.lineWidth = 13;
            for (let i = 0; i < 6; i++) {
                const y = (0.3 + i * 0.12) * h;
                [[0, 0.3], [0.7, 1]].forEach(([a, b]) => {
                    ctx.beginPath();
                    ctx.moveTo(a * w - 10, y);
                    ctx.quadraticCurveTo((a + b) / 2 * w, y + (a ? -8 : 8), b * w + 10, y);
                    ctx.stroke();
                });
            }
        }
        // お腹と胸
        ctx.fillStyle = p.belly;
        ctx.beginPath();
        ctx.ellipse(w * 0.5, h * 0.55, w * 0.2, h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(w * 0.5, 0, w * 0.26, h * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
    });
}

function headTexture(p) {
    return canvas(512, 256, (ctx, w, h) => {
        ctx.fillStyle = p.base;
        ctx.fillRect(0, 0, w, h);
        (p.patches || []).slice(0, 2).forEach(([c], i) => {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.ellipse(w * (i ? 0.72 : 0.3), h * 0.25, w * 0.14, h * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
        });
        if (p === PALETTES.hachi) {
            ctx.fillStyle = p.belly;
            ctx.beginPath();
            ctx.moveTo(w * 0.5, h * 0.25);
            ctx.lineTo(w * 0.62, h);
            ctx.lineTo(w * 0.38, h);
            ctx.fill();
        }
        if (p.stripe) {
            // おでこの M 字
            ctx.strokeStyle = p.stripe;
            ctx.lineWidth = 9;
            ctx.lineCap = 'round';
            [-30, -10, 10, 30].forEach(dx => {
                ctx.beginPath();
                ctx.moveTo(w * 0.5 + dx * 1.2, h * 0.04);
                ctx.lineTo(w * 0.5 + dx * 0.8, h * 0.24);
                ctx.stroke();
            });
        }
    });
}

function tailTexture(p) {
    return canvas(64, 256, (ctx, w, h) => {
        ctx.fillStyle = p.base;
        ctx.fillRect(0, 0, w, h);
        if (p.stripe) {
            ctx.fillStyle = p.stripe;
            for (let i = 0; i < 5; i++) ctx.fillRect(0, (i + 0.4) / 6 * h, w, h / 16);
        }
        ctx.fillStyle = p.tailTip;
        ctx.fillRect(0, h * 0.85, w, h * 0.15);
    });
}

// --- 顔（アニメの目・ω口・ほっぺ） ---
function drawEye(ctx, cx, cy, ew, eh, p, expr, pupil) {
    ctx.save();
    const line = p.line || '#241410';
    if (expr === 'blink' || expr === 'sleep') {
        ctx.strokeStyle = line;
        ctx.lineWidth = eh * 0.12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy - eh * 0.1, ew * 0.45, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
    } else if (expr === 'happy') {
        ctx.strokeStyle = line;
        ctx.lineWidth = eh * 0.12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy + eh * 0.2, ew * 0.42, 1.15 * Math.PI, 1.85 * Math.PI);
        ctx.stroke();
    } else if (expr === 'eat') {
        ctx.strokeStyle = line;
        ctx.lineWidth = eh * 0.11;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const s = cx < 256 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(cx - ew * 0.3 * s, cy - eh * 0.25);
        ctx.lineTo(cx + ew * 0.3 * s, cy);
        ctx.lineTo(cx - ew * 0.3 * s, cy + eh * 0.25);
        ctx.stroke();
    } else if (expr === 'stuck') {
        ctx.strokeStyle = line;
        ctx.lineWidth = eh * 0.07;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 6; a += 0.2) {
            const r = (a / (Math.PI * 6)) * ew * 0.45;
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 1.2;
            if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    } else {
        // ふつう・びっくり・怒り: 大きな丸い目
        ctx.fillStyle = line;
        ctx.beginPath();
        ctx.ellipse(cx, cy, ew / 2, eh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        if (expr === 'scared') {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(cx, cy, ew * 0.43, eh * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = line;
            ctx.beginPath();
            ctx.arc(cx, cy, ew * 0.1, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const g = ctx.createLinearGradient(0, cy - eh / 2, 0, cy + eh / 2);
            g.addColorStop(0, p.iris[0]);
            g.addColorStop(0.75, p.iris[1]);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(cx, cy + eh * 0.03, ew * 0.42, eh * 0.43, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = line;
            ctx.beginPath();
            ctx.ellipse(cx, cy + eh * 0.04, ew * 0.2 * pupil, eh * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cx - ew * 0.15, cy - eh * 0.18, ew * 0.17, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + ew * 0.16, cy + eh * 0.2, ew * 0.07, 0, Math.PI * 2);
            ctx.fill();
        }
        // 上まぶた
        ctx.strokeStyle = line;
        ctx.lineWidth = eh * 0.09;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.ellipse(cx, cy + eh * 0.02, ew * 0.52, eh * 0.52, 0, 1.12 * Math.PI, 1.9 * Math.PI);
        ctx.stroke();
        if (expr === 'angry') {
            ctx.lineWidth = eh * 0.12;
            const s = cx < 256 ? 1 : -1;
            ctx.beginPath();
            ctx.moveTo(cx - ew * 0.55 * s, cy - eh * 0.72);
            ctx.lineTo(cx + ew * 0.45 * s, cy - eh * 0.48);
            ctx.stroke();
        }
    }
    ctx.restore();
}

function faceTexture(p, expr) {
    return canvas(512, 512, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        const line = p.line || '#241410';
        // 口元の白
        ctx.fillStyle = p.muzzle;
        [-1, 1].forEach(s => {
            ctx.beginPath();
            ctx.ellipse(w * (0.5 + s * 0.075), h * 0.67, w * 0.11, h * 0.08, 0, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.beginPath();
        ctx.ellipse(w * 0.5, h * 0.74, w * 0.1, h * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
        // ほっぺ
        ctx.fillStyle = 'rgba(255,120,140,0.35)';
        [-1, 1].forEach(s => {
            ctx.beginPath();
            ctx.ellipse(w * (0.5 + s * 0.27), h * 0.62, w * 0.07, h * 0.035, 0, 0, Math.PI * 2);
            ctx.fill();
        });
        // 目
        const pupil = expr === 'hunt' ? 1.9 : 1;
        const e = expr === 'hunt' ? 'normal' : expr;
        [-1, 1].forEach(s => drawEye(ctx, w * (0.5 + s * 0.165), h * 0.47, w * 0.17, h * 0.21, p, e, pupil));
        // 鼻
        ctx.fillStyle = '#ff8fa3';
        ctx.strokeStyle = line;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w * 0.47, h * 0.585);
        ctx.lineTo(w * 0.53, h * 0.585);
        ctx.lineTo(w * 0.5, h * 0.615);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 口: ω。食べる・鳴く・驚くときは開く
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = line;
        if (['eat', 'meow', 'scared', 'stuck', 'angry'].includes(expr)) {
            ctx.fillStyle = '#b2303f';
            ctx.beginPath();
            ctx.ellipse(w * 0.5, h * 0.675, w * 0.04, h * (expr === 'eat' ? 0.025 : 0.04), 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(w * 0.5, h * 0.615);
            ctx.lineTo(w * 0.5, h * 0.64);
            ctx.arc(w * 0.475, h * 0.64, w * 0.025, 0, Math.PI, false);
            ctx.moveTo(w * 0.5, h * 0.64);
            ctx.arc(w * 0.525, h * 0.64, w * 0.025, Math.PI, 0, true);
            ctx.stroke();
        }
        // ひげ
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = p.line ? '#bbbbbb' : 'rgba(60,40,30,0.7)';
        [-1, 1].forEach(s => {
            for (let k = 0; k < 3; k++) {
                ctx.beginPath();
                ctx.moveTo(w * (0.5 + s * 0.13), h * (0.64 + k * 0.02));
                ctx.lineTo(w * (0.5 + s * 0.4), h * (0.6 + k * 0.045));
                ctx.stroke();
            }
        });
        if (expr === 'scared' || expr === 'stuck') {
            // 汗
            ctx.fillStyle = '#7fc8ff';
            ctx.beginPath();
            ctx.moveTo(w * 0.8, h * 0.3);
            ctx.quadraticCurveTo(w * 0.84, h * 0.4, w * 0.8, h * 0.42);
            ctx.quadraticCurveTo(w * 0.76, h * 0.4, w * 0.8, h * 0.3);
            ctx.fill();
        }
    });
}

function paletteTextures(key) {
    if (texCache[key]) return texCache[key];
    const p = PALETTES[key];
    // 表情は使うときに初めて描く（メモリ節約）
    const faces = {};
    const face = e => faces[e] || (faces[e] = faceTexture(p, e));
    texCache[key] = { body: bodyTexture(p), head: headTexture(p), tail: tailTexture(p), face };
    return texCache[key];
}

// 太さの変わるチューブ（しっぽ）。毎フレーム頂点だけ更新する
class TaperedTube {
    constructor(segments, radial) {
        this.n = segments;
        this.r = radial;
        const count = (segments + 1) * (radial + 1);
        this.geometry = new THREE.BufferGeometry();
        this.pos = new Float32Array(count * 3);
        const uv = [], idx = [];
        for (let i = 0; i <= segments; i++) for (let j = 0; j <= radial; j++) uv.push(j / radial, 1 - i / segments);
        for (let i = 0; i < segments; i++) {
            for (let j = 0; j < radial; j++) {
                const a = i * (radial + 1) + j, b = a + radial + 1;
                idx.push(a, a + 1, b, a + 1, b + 1, b);
            }
        }
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        this.geometry.setIndex(idx);
        this.t = new THREE.Vector3();
        this.nv = new THREE.Vector3();
        this.b = new THREE.Vector3();
        this.up = new THREE.Vector3(0, 0, 1);
    }

    update(points, radii) {
        const { t, nv: n, b, up } = this;
        for (let i = 0; i <= this.n; i++) {
            const p = points[i];
            t.subVectors(points[Math.min(this.n, i + 1)], points[Math.max(0, i - 1)]).normalize();
            b.crossVectors(t, up);
            if (b.lengthSq() < 1e-6) b.set(0, 1, 0);
            b.normalize();
            n.crossVectors(b, t).normalize();
            for (let j = 0; j <= this.r; j++) {
                const a = (j / this.r) * Math.PI * 2;
                const k = (i * (this.r + 1) + j) * 3;
                const c = Math.cos(a) * radii[i], s = Math.sin(a) * radii[i];
                this.pos[k] = p.x + n.x * c + b.x * s;
                this.pos[k + 1] = p.y + n.y * c + b.y * s;
                this.pos[k + 2] = p.z + n.z * c + b.z * s;
            }
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeVertexNormals();
        this.geometry.computeBoundingSphere();
    }
}

function shaded(mesh, outline = 0.006) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (outline) addOutline(mesh, outline);
    return mesh;
}

export class CatModel {
    constructor(paletteKey = 'player') {
        const p = PALETTES[paletteKey];
        this.palette = p;
        this.tex = paletteTextures(paletteKey);
        this.root = new THREE.Group();
        this.body = new THREE.Group();
        this.root.add(this.body);

        const bodyMat = toonMap(this.tex.body);
        const headMat = toonMap(this.tex.head);
        const tailMat = toonMap(this.tex.tail);
        const earMat = toon(new THREE.Color(p.ear));
        const pinkMat = toon(0xff9fb1);
        const pawMat = toon(new THREE.Color(p.belly));
        const legMat = toon(new THREE.Color(p.base));

        const sphere = new THREE.SphereGeometry(1, 40, 28);
        // 胴体は背骨の向きを極にする（縞が背中を横切るように）
        this.torso = shaded(new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28).rotateZ(-Math.PI / 2), bodyMat));
        this.body.add(this.torso);

        this.neck = new THREE.Group();
        this.body.add(this.neck);
        this.head = new THREE.Group();
        this.neck.add(this.head);
        this.skull = shaded(new THREE.Mesh(sphere, headMat));
        this.skull.scale.set(0.95, 0.88, 1.05);
        this.head.add(this.skull);
        // ほっぺのふくらみ
        this.cheeks = [-1, 1].map(s => {
            const c = shaded(new THREE.Mesh(sphere, headMat));
            c.scale.set(0.42, 0.34, 0.42);
            c.position.set(0.32, -0.38, s * 0.6);
            this.head.add(c);
            return c;
        });
        // 顔パーツ（頭の前面にかぶせる）
        const faceGeo = new THREE.SphereGeometry(1.012, 48, 40, Math.PI - 1.0, 2.0, 0.55, 1.75);
        this.faceMat = new THREE.MeshToonMaterial({ map: this.tex.face('normal'), transparent: true, alphaTest: 0.05, gradientMap: bodyMat.gradientMap });
        this.face = new THREE.Mesh(faceGeo, this.faceMat);
        this.face.scale.set(0.95, 0.88, 1.05);
        this.face.renderOrder = 2;
        this.head.add(this.face);
        this.expr = 'normal';

        this.ears = [-1, 1].map(s => {
            const ear = new THREE.Group();
            const outer = shaded(new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.6, 24), earMat));
            outer.scale.z = 0.6;
            const inner = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.42, 20), pinkMat);
            inner.scale.z = 0.3;
            inner.position.set(0.1, -0.04, 0);
            ear.add(outer, inner);
            ear.position.set(-0.05, 0.72, s * 0.5);
            ear.rotation.set(s * 0.4, 0, -0.12);
            this.head.add(ear);
            return ear;
        });

        const capsule = new THREE.CapsuleGeometry(1, 1, 6, 14);
        this.legs = [0, 1, 2, 3].map(i => {
            const front = i < 2, side = i % 2 ? 1 : -1;
            const hip = new THREE.Group();
            const leg = shaded(new THREE.Mesh(capsule, legMat), 0.005);
            const paw = shaded(new THREE.Mesh(sphere, pawMat), 0.005);
            hip.add(leg, paw);
            this.body.add(hip);
            return { hip, leg, paw, front, side };
        });

        this.tailTube = new TaperedTube(20, 12);
        this.tail = new THREE.Mesh(this.tailTube.geometry, tailMat);
        this.tail.castShadow = true;
        addOutline(this.tail, 0.006);
        this.body.add(this.tail);
        this.tailPts = Array.from({ length: 21 }, () => new THREE.Vector3());
        this.tailRadii = new Array(21).fill(0.02);

        this.contact = new THREE.Mesh(
            new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false })
        );
        this.root.add(this.contact);

        this.phase = 0;
        this.blinkT = 2;
        this.squash = 0;
        this.bodyMats = [bodyMat, headMat];
    }

    setExpression(e) {
        if (this.expr === e) return;
        this.expr = e;
        this.faceMat.map = this.tex.face(e);
        this.faceMat.needsUpdate = true;
    }

    // s: { w, t, speed, onGround, air, crouch, charge, squeeze, punch, eating, hack, loaf, sleep, high, scared, stuck, meow, lookYaw, angry, happy, height }
    update(s, dt) {
        const b = CFG.body(s.w);
        const t = s.t;
        const L = b.length, W = b.width, Hb = b.torsoH, Hr = b.head;
        const crouch = Math.max(s.crouch || 0, s.squeeze ? 0.9 : 0);
        const loaf = s.loaf || s.sleep;
        const speed = s.speed || 0;
        this.phase += dt * (speed > 0.05 ? 6 + speed * 7 : 0);
        const cyc = this.phase;

        // 着地などでつぶれて戻る（アニメらしい伸び縮み）
        this.squash += (0 - this.squash) * Math.min(1, dt * 10);
        const sq = this.squash;

        let legLen = b.leg;
        let torsoY = legLen + Hb * 0.48 * (1 - crouch * 0.35);
        if (loaf) torsoY = Hb * 0.45;
        if (s.scared) torsoY += legLen * 1.2;
        const bob = speed > 0.05 && s.onGround ? Math.abs(Math.sin(cyc)) * 0.012 : 0;
        const breath = 1 + Math.sin(t * (s.w > CFG.BURST_WARN ? 16 : s.sleep ? 1.8 : 3)) * (s.w > CFG.BURST_WARN ? 0.04 : 0.015);
        const wiggle = (s.charge || 0) > 0 ? Math.sin(t * 28) * 0.2 * s.charge : 0;
        this.body.position.y = torsoY + bob;
        this.torso.scale.set(L / 2 * (1 + sq * 0.15), Hb / 2 * breath * (1 - sq * 0.25) * (s.scared ? 1.1 : 1), W / 2 * breath * (1 + sq * 0.15));
        this.torso.rotation.set(wiggle * 0.3, wiggle * 0.25, s.air ? Math.max(-0.35, Math.min(0.35, s.airPitch || 0)) : 0);

        // 頭
        this.neck.position.set(L * 0.36, Hb * 0.3 - crouch * Hb * 0.15, 0);
        if (loaf) this.neck.position.set(L * 0.34, Hb * 0.22, 0);
        this.head.scale.setScalar(Hr);
        this.head.position.set(Hr * 0.45, Hr * 0.55, 0);
        let pitch = -(crouch * 0.1) - (s.eating ? 0.5 + Math.sin(t * 18) * 0.1 : 0) - (s.hack ? 0.35 : 0);
        if (s.sleep) pitch = -0.35;
        const yaw = s.sleep ? 0.6 : Math.max(-0.8, Math.min(0.8, s.lookYaw || 0));
        this.head.rotation.set(Math.sin(t * 0.8) * 0.06 + (s.meow ? 0.1 : 0), yaw, pitch + (s.meow ? 0.2 : 0));

        // 表情
        this.blinkT -= dt;
        if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3;
        let expr = 'normal';
        if (s.sleep) expr = 'sleep';
        else if (s.stuck) expr = 'stuck';
        else if (s.scared) expr = 'scared';
        else if (s.eating) expr = 'eat';
        else if (s.hack || s.meow) expr = 'meow';
        else if (s.angry) expr = 'angry';
        else if (s.happy || s.loaf) expr = 'happy';
        else if (crouch > 0.3 || s.high) expr = 'hunt';
        else if (this.blinkT < 0) expr = 'blink';
        this.setExpression(expr);

        this.ears.forEach((ear, i) => {
            const side = i ? 1 : -1;
            ear.rotation.set(side * (0.4 + (s.scared ? 0.8 : 0)), 0, -0.12 - (s.scared || s.stuck ? 0.6 : 0));
        });

        // 足（短くてかわいい）
        const legR = (0.026 + 0.0005 * s.w);
        this.legs.forEach((l, i) => {
            const x = (l.front ? 1 : -1) * L * 0.26;
            l.hip.visible = !loaf;
            l.hip.position.set(x, -Hb * 0.3, l.side * W * (0.28 - 0.06 * b.fat));
            const reach = Math.max(0.01, torsoY - Hb * 0.3);
            const diag = (l.front === (l.side > 0)) ? 0 : Math.PI;
            let swing = 0;
            if (s.air) swing = l.front ? 0.7 : -0.6;
            else if (speed > 0.05) swing = Math.sin(cyc + diag) * Math.min(0.55, 0.25 + speed * 0.15);
            if (s.stuck) swing = Math.sin(t * 30 + i) * 0.8;
            l.hip.rotation.set(0, 0, swing);
            if (l.front && l.side > 0 && s.punch > 0) l.hip.rotation.z = 1.9 * Math.sin(Math.PI * s.punch);
            l.leg.scale.set(legR, Math.max(0.001, reach - legR) / 2, legR);
            l.leg.position.set(0, -reach / 2, 0);
            l.paw.scale.set(legR * 1.35, legR * 0.9, legR * 1.2);
            l.paw.position.set(legR * 0.3, -reach + legR * 0.5, 0);
        });

        // しっぽ（ふさふさ）
        const n = 20;
        const tailLen = Math.min(L * 1.05, 0.3 + L * 0.35);
        const base = new THREE.Vector3(-L * 0.45, Hb * 0.05, 0);
        const r0 = Math.min(0.06, Math.max(0.028, W * 0.16)) * (s.scared ? 1.7 : 1);
        for (let i = 0; i <= n; i++) {
            const k = i / n;
            const p = this.tailPts[i];
            if (loaf) {
                const a = Math.PI + k * Math.PI * 0.9;
                const R = Math.max(W, L) * 0.55;
                p.set(Math.cos(a) * R, -torsoY + r0 + 0.005, -Math.sin(a) * R * 0.75);
                if (k < 0.12) p.lerp(base, 1 - k / 0.12);
            } else {
                const up = (s.charge > 0 || crouch > 0.3) ? 0.1 : s.scared ? 1.45 : 0.35 + k * 1.15;
                const amp = s.high ? 1.2 : s.charge > 0 ? 0.9 : 0.35;
                const spd = s.high ? 8 : s.charge > 0 ? 16 : 2.4;
                const side = Math.sin(t * spd - i * 0.25) * amp * k;
                p.set(base.x - Math.cos(up) * tailLen * k * 0.85, base.y + Math.sin(up) * tailLen * k * 0.85 - (k > 0.85 ? (k - 0.85) * tailLen * 0.5 : 0), base.z + side * tailLen * 0.35);
            }
            this.tailRadii[i] = r0 * (1 - k * 0.25) * (k > 0.85 ? Math.sqrt(Math.max(0.003, 1 - (k - 0.85) / 0.15)) : 1) * (k < 0.05 ? 0.8 : 1);
        }
        this.tailTube.update(this.tailPts, this.tailRadii);

        this.contact.position.y = 0.004 - (s.height || 0);
        this.contact.scale.set(L * 0.55, 1, W * 0.75);
        this.contact.material.opacity = 0.2 / (1 + (s.height || 0) * 3);

        const warn = (s.stuck || s.w > CFG.BURST_WARN) && Math.sin(t * 18) > 0 ? 0.35 : 0;
        this.bodyMats.forEach(m => m.emissive.setRGB(warn, 0, 0));

        refreshOutlines(this.root);
    }

    // 着地したときに呼ぶ
    land(impact) {
        this.squash = Math.min(1, impact / 6);
    }
}
