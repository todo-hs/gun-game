// 3D 描画（Three.js）
// ゲームの中身は Phaser の GameScene が持ち、ここでは毎フレームその状態を読んで 3D で描く。
// 座標: ゲームの (x, y) ピクセル → 3D の (x / 32, 高さ, y / 32)。1 マス = 1 ユニット。

const U = 1 / 32;
const WALL_H = 0.8;
const SHELF_H = 0.42;

// ---------------------------------------------------------------- テクスチャ

function canvasTexture(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    if (repeat) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
    }
    return t;
}

// 毛並みのざらつき
function furNoise(ctx, w, h, n, light, dark) {
    for (let i = 0; i < n; i++) {
        ctx.strokeStyle = Math.random() < 0.5 ? light : dark;
        ctx.lineWidth = 1;
        const x = Math.random() * w, y = Math.random() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 3, y + 3 + Math.random() * 4);
        ctx.stroke();
    }
}

const Tex = {
    build() {
        // 茶トラの胴体: 横縞（体に巻きつく輪になる）
        this.furBody = canvasTexture(512, 256, (ctx, w, h) => {
            ctx.fillStyle = '#e39b4a';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#b5652a';
            for (let i = 1; i < 11; i++) {
                const y0 = (i / 11) * h;
                ctx.beginPath();
                for (let x = 0; x <= w; x += 8) {
                    const y = y0 + Math.sin(x * 0.05 + i) * 3;
                    if (x === 0) ctx.moveTo(x, y - 5); else ctx.lineTo(x, y - 5);
                }
                for (let x = w; x >= 0; x -= 8) ctx.lineTo(x, y0 + Math.sin(x * 0.05 + i) * 3 + 5 + Math.sin(x * 0.13) * 2);
                ctx.fill();
            }
            furNoise(ctx, w, h, 4000, 'rgba(255,225,180,0.18)', 'rgba(120,60,20,0.14)');
        });
        this.furPlain = canvasTexture(256, 128, (ctx, w, h) => {
            ctx.fillStyle = '#e39b4a';
            ctx.fillRect(0, 0, w, h);
            furNoise(ctx, w, h, 2000, 'rgba(255,225,180,0.18)', 'rgba(120,60,20,0.14)');
        });
        // 頭: 球の u=0.5 が顔の正面。おでこの M 字模様と白い口元
        this.furHead = canvasTexture(512, 256, (ctx, w, h) => {
            ctx.fillStyle = '#e39b4a';
            ctx.fillRect(0, 0, w, h);
            const cx = w / 2;
            const grad = ctx.createRadialGradient(cx, h * 0.72, 4, cx, h * 0.72, h * 0.3);
            grad.addColorStop(0, '#fbf1e1');
            grad.addColorStop(1, 'rgba(251,241,225,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#a95a22';
            ctx.lineCap = 'round';
            ctx.lineWidth = 7;
            [-24, -8, 8, 24].forEach((dx, i) => {
                ctx.beginPath();
                ctx.moveTo(cx + dx * 1.4, h * 0.12);
                ctx.quadraticCurveTo(cx + dx * 1.1, h * 0.25, cx + dx * 0.7, h * (i === 1 || i === 2 ? 0.36 : 0.32));
                ctx.stroke();
            });
            ctx.lineWidth = 5;
            [-1, 1].forEach(sd => {
                for (let k = 0; k < 2; k++) {
                    ctx.beginPath();
                    ctx.moveTo(cx + sd * 70, h * (0.5 + k * 0.08));
                    ctx.lineTo(cx + sd * 110, h * (0.46 + k * 0.1));
                    ctx.stroke();
                }
            });
            furNoise(ctx, w, h, 2500, 'rgba(255,225,180,0.15)', 'rgba(120,60,20,0.12)');
        });
        this.wood = canvasTexture(128, 128, (ctx, w, h) => {
            const colors = ['#a06e40', '#976639', '#a8764a', '#8f6035'];
            for (let r = 0; r < 4; r++) {
                ctx.fillStyle = colors[r];
                ctx.fillRect(0, r * 32, w, 32);
                ctx.strokeStyle = 'rgba(60,35,15,0.25)';
                for (let k = 0; k < 6; k++) {
                    ctx.beginPath();
                    const y = r * 32 + 4 + k * 5;
                    ctx.moveTo(0, y);
                    ctx.bezierCurveTo(40, y + 2, 80, y - 2, w, y + 1);
                    ctx.stroke();
                }
                ctx.fillStyle = 'rgba(50,28,10,0.6)';
                ctx.fillRect(0, r * 32, w, 1.5);
                ctx.fillRect(((r * 53) % 100) + 10, r * 32, 1.5, 32);
            }
        });
        this.oldWood = canvasTexture(128, 128, (ctx, w, h) => {
            ctx.fillStyle = '#6e5a44';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = 'rgba(20,10,5,0.8)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) {
                ctx.beginPath();
                ctx.moveTo(Math.random() * w, Math.random() * h);
                for (let k = 0; k < 3; k++) ctx.lineTo(Math.random() * w, Math.random() * h);
                ctx.stroke();
            }
            for (let r = 0; r < 4; r++) {
                ctx.fillStyle = 'rgba(30,18,8,0.7)';
                ctx.fillRect(0, r * 32, w, 2);
            }
        });
        this.cardboard = canvasTexture(128, 128, (ctx, w, h) => {
            ctx.fillStyle = '#c49a5c';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#e8d9a8';
            ctx.fillRect(w * 0.4, 0, w * 0.2, h);
            ctx.strokeStyle = 'rgba(90,60,30,0.5)';
            ctx.strokeRect(2, 2, w - 4, h - 4);
            ctx.fillStyle = '#5a3d1f';
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText('FRAGILE', 20, 100);
        });
        this.wall = canvasTexture(64, 64, (ctx, w, h) => {
            ctx.fillStyle = '#ece3d0';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 200; i++) {
                ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.3)';
                ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
            }
        });
        this.rug = canvasTexture(256, 256, (ctx, w, h) => {
            ctx.fillStyle = '#8e2c3a';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#e9c46a';
            ctx.lineWidth = 6;
            for (let r = 30; r < 128; r += 28) {
                ctx.beginPath();
                ctx.arc(128, 128, r, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
    }
};

// 文字の板（常にカメラを向く）
function textSprite(text, opt = {}) {
    const px = opt.px || 48;
    const lines = String(text).split('\n');
    const font = `bold ${px}px "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif`;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = font;
    const pad = opt.bg ? px * 0.4 : px * 0.2;
    const lineH = px * 1.25;
    const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
    c.width = Math.ceil(tw + pad * 2);
    c.height = Math.ceil(lines.length * lineH + pad * 2);
    ctx.font = font;
    if (opt.bg) {
        ctx.fillStyle = opt.bg;
        ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    lines.forEach((l, i) => {
        const y = pad + lineH * (i + 0.5);
        if (!opt.bg) {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = px * 0.18;
            ctx.strokeText(l, pad, y);
        }
        ctx.fillStyle = opt.color || '#fff';
        ctx.fillText(l, pad, y);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 100;
    s.userData.aspect = c.width / c.height;
    s.userData.lines = lines.length;
    const h = (opt.height || 0.5) * lines.length;
    s.scale.set(h * s.userData.aspect, h, 1);
    return s;
}

function disposeTree(obj) {
    obj.traverse(o => {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach(m => {
                if (m.userData.shared) return;
                if (m.map && !m.map.userData.shared) m.map.dispose();
                m.dispose();
            });
        }
    });
}

// ---------------------------------------------------------------- 共有の形と材質

const Geo = {};
const Mat = {};

function buildShared() {
    const sh = g => { g.userData.shared = true; return g; };
    Geo.sphere = sh(new THREE.SphereGeometry(1, 24, 16));
    Geo.sphereLo = sh(new THREE.SphereGeometry(1, 12, 8));
    // 極が前後（x 軸）を向いた球。胴体の縞が輪になる
    Geo.bodySphere = sh(new THREE.SphereGeometry(1, 32, 20).rotateZ(Math.PI / 2));
    Geo.cone = sh(new THREE.ConeGeometry(1, 1, 4));
    Geo.cyl = sh(new THREE.CylinderGeometry(1, 1, 1, 14));
    Geo.box = sh(new THREE.BoxGeometry(1, 1, 1));
    Geo.capsule = sh(new THREE.CapsuleGeometry(0.5, 1, 6, 12));
    Geo.torus = sh(new THREE.TorusGeometry(1, 0.25, 8, 20));

    const std = (o) => { const m = new THREE.MeshStandardMaterial(o); m.userData.shared = true; return m; };
    Mat.fur = std({ map: Tex.furBody, roughness: 0.95 });
    Mat.furPlain = std({ map: Tex.furPlain, roughness: 0.95 });
    Mat.furHead = std({ map: Tex.furHead, roughness: 0.95 });
    Mat.furDark = std({ color: 0xb5652a, roughness: 0.95 });
    Mat.white = std({ color: 0xfaf0e0, roughness: 0.9 });
    Mat.pink = std({ color: 0xf2a0a8, roughness: 0.6 });
    Mat.eye = std({ color: 0x9bd35a, roughness: 0.15, metalness: 0.1 });
    Mat.black = std({ color: 0x111111, roughness: 0.2 });
    Mat.shine = std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 });
    Mat.wood = std({ map: Tex.wood, roughness: 0.7 });
    Mat.oldWood = std({ map: Tex.oldWood, roughness: 0.9 });
    Mat.crack = std({ map: Tex.oldWood, color: 0xff7777, roughness: 0.9 });
    Mat.wall = std({ map: Tex.wall, roughness: 0.95 });
    Mat.wallTop = std({ color: 0xa89878, roughness: 0.95 });
    Mat.cardboard = std({ map: Tex.cardboard, roughness: 0.95 });
    Mat.shelf = std({ color: 0x5b3a1e, roughness: 0.6 });
    Mat.gate = std({ color: 0xd62839, emissive: 0x5a0010, roughness: 0.4, transparent: true, opacity: 0.85 });
    Mat.gateOpen = std({ color: 0x3fdc7f, emissive: 0x145a2a, roughness: 0.5 });
    Mat.fish = std({ color: 0x4fa3e0, roughness: 0.3, metalness: 0.3 });
    Mat.fishGold = std({ color: 0xffc93c, roughness: 0.25, metalness: 0.6, emissive: 0x332200 });
    Mat.mouse = std({ color: 0x6d6a70, roughness: 0.9 });
    Mat.leaf = std({ color: 0x6a994e, roughness: 0.7 });
    Mat.cucumber = std({ color: 0x2d6a4f, roughness: 0.5 });
    Mat.hairball = std({ color: 0x7a5a3a, roughness: 1 });
    Mat.dark = std({ color: 0x050303, roughness: 1 });
    Mat.puff = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
}

function mesh(geo, mat, cast = true) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
}

// ---------------------------------------------------------------- 猫

class Cat3D {
    constructor() {
        this.root = new THREE.Group();
        this.pose = new THREE.Group();
        this.root.add(this.pose);
        // 猫ごとに材質を複製して、詰まったときの赤い点滅などに使う
        this.furMat = Mat.fur.clone();
        this.furPlainMat = Mat.furPlain.clone();
        this.eyeMat = Mat.eye.clone();
        this.furHeadMat = Mat.furHead.clone();

        this.body = mesh(Geo.bodySphere, this.furMat);
        this.pose.add(this.body);

        this.head = new THREE.Group();
        this.pose.add(this.head);
        const headBall = mesh(Geo.sphere, this.furHeadMat);
        headBall.scale.set(1, 0.92, 1.05);
        this.head.add(headBall);
        this.ears = [-1, 1].map(s => {
            const ear = new THREE.Group();
            const outer = mesh(Geo.cone, this.furPlainMat);
            outer.scale.set(0.42, 0.7, 0.28);
            outer.rotation.y = Math.PI / 4;
            const inner = mesh(Geo.cone, Mat.pink, false);
            inner.scale.set(0.28, 0.5, 0.12);
            inner.rotation.y = Math.PI / 4;
            inner.position.set(0.08, -0.04, 0);
            ear.add(outer, inner);
            ear.position.set(-0.05, 0.72, s * 0.5);
            ear.rotation.x = s * 0.35;
            ear.rotation.z = -0.1;
            this.head.add(ear);
            return ear;
        });
        this.eyes = [-1, 1].map(s => {
            const eye = new THREE.Group();
            const ball = mesh(Geo.sphere, this.eyeMat, false);
            ball.scale.setScalar(0.25);
            const pupil = mesh(Geo.sphere, Mat.black, false);
            pupil.position.x = 0.14;
            const shine = mesh(Geo.sphereLo, Mat.shine, false);
            shine.scale.setScalar(0.05);
            shine.position.set(0.22, 0.09, -0.05);
            eye.add(ball, pupil, shine);
            eye.position.set(0.74, 0.2, s * 0.36);
            eye.rotation.y = -s * 0.4;
            this.head.add(eye);
            return { eye, ball, pupil };
        });
        const muzzle = [-1, 1].map(s => {
            const m = mesh(Geo.sphere, Mat.white, false);
            m.scale.set(0.2, 0.18, 0.22);
            m.position.set(0.86, -0.25, s * 0.15);
            this.head.add(m);
            return m;
        });
        const chin = mesh(Geo.sphere, Mat.white, false);
        chin.scale.set(0.3, 0.2, 0.35);
        chin.position.set(0.62, -0.45, 0);
        this.head.add(chin);
        const nose = mesh(Geo.sphere, Mat.pink, false);
        nose.scale.set(0.09, 0.07, 0.11);
        nose.position.set(1.0, -0.12, 0);
        this.head.add(nose);
        // ひげ
        const pts = [];
        [-1, 1].forEach(s => {
            for (let k = 0; k < 3; k++) {
                pts.push(new THREE.Vector3(0.95, -0.2, s * 0.2), new THREE.Vector3(1.55, -0.12 - k * 0.12, s * (0.75 + k * 0.1)));
            }
        });
        const whisk = new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
        );
        this.head.add(whisk);
        this.muzzle = muzzle;

        this.legs = [0, 1, 2, 3].map(i => {
            const leg = new THREE.Group();
            const upper = mesh(Geo.cyl, this.furPlainMat);
            const paw = mesh(Geo.sphere, Mat.white);
            leg.add(upper, paw);
            this.pose.add(leg);
            return { leg, upper, paw, front: i < 2, side: i % 2 ? 1 : -1 };
        });

        this.tail = [];
        for (let i = 0; i < 26; i++) {
            const seg = mesh(Geo.sphereLo, i > 21 || Math.floor(i / 4) % 2 ? Mat.furDark : this.furPlainMat);
            this.pose.add(seg);
            this.tail.push(seg);
        }
        this.shadowBlob = new THREE.Mesh(
            new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })
        );
        this.shadowBlob.position.y = 0.01;
        this.root.add(this.shadowBlob);
    }

    // 体重と当たり判定（ユニット）から体の寸法を出す。太るほど丸く、頭は相対的に小さい
    static dims(w, dU) {
        const f = Math.min(1, Math.max(0, (w - 3) / 40));
        const L = dU * (1.7 - 0.6 * f);
        const W = dU * (0.8 + 0.3 * f);
        return {
            L, W,
            H: W * (0.85 + 0.1 * f),
            Hr: dU * (0.34 - 0.16 * f) + 0.06,
            leg: Math.max(0.05, dU * 0.34 * (1 - 0.7 * f) + 0.04)
        };
    }

    // p: { w, dU, t, walk, crouch, punch, sleep, high, scared, stuck }
    update(p) {
        const D = Cat3D.dims(p.w, p.dU);
        const { L, W, H, Hr, leg } = D;
        const t = p.t;
        const crouch = p.crouch || 0;
        const walkS = Math.sin(p.walk * 14);
        const breath = 1 + Math.sin(t * (p.w > 85 ? 18 : 2.5)) * (p.w > 85 ? 0.04 : 0.015);

        this.furMat.emissive.setHex(p.stuck && Math.sin(t * 20) > 0 ? 0x661111 : 0x000000);
        this.furPlainMat.emissive.copy(this.furMat.emissive);
        this.furHeadMat.emissive.copy(this.furMat.emissive);
        this.eyeMat.color.setHex(p.high ? 0xff6fb5 : 0x9bd35a);
        this.shadowBlob.scale.set(L * 0.6, 1, W * 0.7);

        if (p.sleep) {
            this.updateSleeping(D, t);
            return;
        }
        this.body.visible = true;

        // 胴体
        const lift = p.scared ? 1.5 : 1;
        const bodyY = (leg * (1 - crouch * 0.6) + H * 0.42) * lift;
        const wiggle = crouch ? Math.sin(t * 30) * W * 0.12 * crouch : 0;
        this.body.scale.set((L / 2) * (1 - crouch * 0.08), (H / 2) * breath * (p.scared ? 1.15 : 1), (W / 2) * breath);
        this.body.position.set(0, bodyY, 0);
        this.body.rotation.set(0, wiggle * 0.8, p.scared ? 0.1 : crouch * 0.12);

        // 頭
        this.head.scale.setScalar(Hr);
        this.head.position.set(L * 0.44 + Hr * 0.45, bodyY + H * 0.28 - crouch * H * 0.3, 0);
        this.head.rotation.set(Math.sin(t * 0.7) * 0.08, Math.sin(t * 0.5) * 0.15, crouch * -0.15);
        this.ears.forEach((e, i) => { e.rotation.z = p.scared ? 0.9 : -0.1 + (crouch ? 0.3 : 0); });
        // 瞳孔: ふだんは縦長、狩りのときは真ん丸
        this.eyes.forEach(({ eye, pupil }, i) => {
            eye.scale.y = 1;
            pupil.visible = true;
            if (p.high) {
                pupil.scale.set(0.05, 0.11, 0.11);
                pupil.position.set(0.17, Math.sin(t * 12) * 0.07, Math.cos(t * 12) * 0.07);
            } else if (crouch > 0.2 || p.scared) {
                pupil.scale.set(0.05, 0.19, 0.19);
                pupil.position.set(0.17, 0, 0);
            } else {
                pupil.scale.set(0.05, 0.21, 0.07);
                pupil.position.set(0.17, 0, 0);
            }
        });

        // 足
        const legR = Math.max(0.035, W * 0.13);
        this.legs.forEach(l => {
            const x = (l.front ? 1 : -1) * L * 0.28;
            const swing = (l.front === (l.side > 0) ? 1 : -1) * walkS * 0.6;
            let h = Math.max(0.05, bodyY - 0.02);
            l.leg.position.set(x + (l.front ? 0 : wiggle * 0.3), h, l.side * W * 0.3);
            l.leg.rotation.set(0, 0, swing);
            l.upper.scale.set(legR, h, legR);
            l.upper.position.set(0, -h / 2, 0);
            l.paw.scale.set(legR * 1.25, legR * 0.7, legR * 1.1);
            l.paw.position.set(legR * 0.4, -h, 0);
            // 猫パンチ: 右前足を前に振り出す
            if (l.front && l.side > 0 && p.punch > 0) {
                l.leg.rotation.z = -1.4 * p.punch;
                l.leg.position.y = bodyY + H * 0.1;
            }
        });

        // しっぽ: ふだんは立てて先をゆらゆら。狩りのときは低く速く振る
        const n = this.tail.length;
        const segLen = L * 0.035;
        const r0 = Math.max(0.03, W * 0.1) * (p.scared ? 2 : 1);
        let x = -L * 0.46 + wiggle * 0.2, y = bodyY + H * 0.1, z = wiggle;
        const amp = p.high ? 1.2 : crouch ? 0.8 : 0.35;
        const speed = p.high ? 9 : crouch ? 14 : 2.5;
        for (let i = 0; i < n; i++) {
            const k = i / n;
            const up = crouch ? 0.1 : p.scared ? 1.3 : 0.2 + k * 1.3;
            const side = Math.sin(t * speed - i * 0.2) * amp * k;
            x -= Math.cos(up) * segLen;
            y += Math.sin(up) * segLen;
            z += side * segLen * 1.4;
            const seg = this.tail[i];
            seg.position.set(x, y, z);
            seg.scale.setScalar(r0 * (1 - k * 0.35));
        }
    }

    // 丸まって寝ている姿
    updateSleeping(D, t) {
        const { L, W, H, Hr } = D;
        const R = (L + W) / 4;
        const br = 1 + Math.sin(t * 2) * 0.04;
        this.body.scale.set(R, H * 0.45 * br, R * 0.95);
        this.body.position.set(0, H * 0.42, 0);
        this.body.rotation.set(0, 0, 0);
        this.head.scale.setScalar(Hr);
        this.head.position.set(R * 0.45, H * 0.45, R * 0.55);
        this.head.rotation.set(0.5, 0.9, 0.35);
        this.eyes.forEach(({ eye, pupil }) => {
            eye.scale.y = 0.12;
            pupil.visible = false;
        });
        this.legs.forEach(l => {
            l.leg.position.set(0, -10, 0);
        });
        const n = this.tail.length;
        const r0 = Math.max(0.03, W * 0.1);
        for (let i = 0; i < n; i++) {
            const a = -Math.PI * 0.75 + (i / n) * Math.PI * 1.25;
            this.tail[i].position.set(Math.cos(a) * R * 1.05, H * 0.18, Math.sin(a) * R * 1.05);
            this.tail[i].scale.setScalar(r0 * (1 - (i / n) * 0.3));
        }
    }
}

// ---------------------------------------------------------------- 敵・小物のモデル

const Models = {
    mouse() {
        const g = new THREE.Group();
        const body = mesh(Geo.sphere, Mat.mouse);
        body.scale.set(0.55, 0.32, 0.36);
        body.position.y = 0.3;
        const head = mesh(Geo.sphere, Mat.mouse);
        head.scale.set(0.28, 0.22, 0.24);
        head.position.set(0.5, 0.32, 0);
        g.add(body, head);
        [-1, 1].forEach(s => {
            const ear = mesh(Geo.cyl, Mat.pink);
            ear.scale.set(0.14, 0.03, 0.14);
            ear.rotation.z = Math.PI / 2;
            ear.position.set(0.42, 0.52, s * 0.16);
            const eye = mesh(Geo.sphereLo, Mat.black, false);
            eye.scale.setScalar(0.04);
            eye.position.set(0.7, 0.38, s * 0.1);
            g.add(ear, eye);
        });
        const nose = mesh(Geo.sphereLo, Mat.pink, false);
        nose.scale.setScalar(0.05);
        nose.position.set(0.78, 0.3, 0);
        const tail = mesh(Geo.cyl, Mat.pink);
        tail.scale.set(0.025, 0.7, 0.025);
        tail.rotation.z = Math.PI / 2 - 0.2;
        tail.position.set(-0.85, 0.22, 0);
        g.add(nose, tail);
        return g;
    },

    dog(color, dark, boss) {
        const g = new THREE.Group();
        const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
        const md = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.9 });
        const light = new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.9 });
        g.userData.mats = [m, md, light];
        const body = mesh(Geo.sphere, m);
        body.scale.set(0.5, 0.3, boss ? 0.42 : 0.3);
        body.position.y = 0.45;
        const head = mesh(Geo.sphere, m);
        head.scale.set(0.3, 0.28, boss ? 0.36 : 0.28);
        head.position.set(0.5, 0.62, 0);
        const snout = mesh(Geo.sphere, light);
        snout.scale.set(0.18, 0.13, boss ? 0.26 : 0.16);
        snout.position.set(0.76, 0.55, 0);
        const nose = mesh(Geo.sphereLo, Mat.black, false);
        nose.scale.setScalar(0.06);
        nose.position.set(0.93, 0.6, 0);
        g.add(body, head, snout, nose);
        [-1, 1].forEach(s => {
            const ear = mesh(Geo.sphere, md);
            ear.scale.set(0.1, 0.2, 0.06);
            ear.position.set(0.45, 0.6, s * (boss ? 0.36 : 0.28));
            ear.rotation.x = s * 0.4;
            const eye = mesh(Geo.sphereLo, Mat.black, false);
            eye.scale.setScalar(0.05);
            eye.position.set(0.72, 0.72, s * 0.12);
            const brow = mesh(Geo.box, Mat.black, false);
            brow.scale.set(0.14, 0.025, 0.03);
            brow.position.set(0.72, 0.8, s * 0.12);
            brow.rotation.x = s * 0.5;
            g.add(ear, eye, brow);
        });
        g.userData.legs = [];
        [[0.28, 1], [0.28, -1], [-0.28, 1], [-0.28, -1]].forEach(([x, s]) => {
            const leg = new THREE.Group();
            const l = mesh(Geo.cyl, m);
            l.scale.set(0.07, 0.32, 0.07);
            l.position.y = -0.16;
            const paw = mesh(Geo.sphereLo, md);
            paw.scale.set(0.09, 0.05, 0.08);
            paw.position.set(0.02, -0.32, 0);
            leg.add(l, paw);
            leg.position.set(x, 0.32, s * 0.16);
            g.add(leg);
            g.userData.legs.push(leg);
        });
        const tail = mesh(Geo.cyl, m);
        tail.scale.set(0.04, 0.3, 0.04);
        tail.rotation.z = 0.8;
        tail.position.set(-0.55, 0.62, 0);
        g.add(tail);
        g.userData.tail = tail;
        if (boss) {
            const collar = mesh(Geo.torus, new THREE.MeshStandardMaterial({ color: 0xd62839, roughness: 0.4 }));
            collar.scale.setScalar(0.26);
            collar.rotation.y = Math.PI / 2;
            collar.position.set(0.32, 0.55, 0);
            g.add(collar);
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                const sp = mesh(Geo.cone, Mat.white);
                sp.scale.set(0.04, 0.1, 0.04);
                sp.position.set(0.32, 0.55 + Math.sin(a) * 0.3, Math.cos(a) * 0.3);
                sp.rotation.x = -a + Math.PI / 2;
                g.add(sp);
            }
        }
        return g;
    },

    roomba() {
        const g = new THREE.Group();
        const base = mesh(Geo.cyl, new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.4, metalness: 0.4 }));
        base.scale.set(0.5, 0.14, 0.5);
        base.position.y = 0.08;
        const top = mesh(Geo.cyl, new THREE.MeshStandardMaterial({ color: 0x55555f, roughness: 0.3, metalness: 0.5 }));
        top.scale.set(0.42, 0.02, 0.42);
        top.position.y = 0.16;
        const btn = mesh(Geo.cyl, new THREE.MeshStandardMaterial({ color: 0x3fdc7f, emissive: 0x2a9a50 }));
        btn.scale.set(0.08, 0.02, 0.08);
        btn.position.y = 0.18;
        g.add(base, top, btn);
        [-1, 1].forEach(s => {
            const eye = mesh(Geo.box, new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: 0xff0022, emissiveIntensity: 0.8 }));
            eye.scale.set(0.1, 0.02, 0.07);
            eye.position.set(0.25, 0.18, s * 0.12);
            eye.rotation.y = s * 0.3;
            g.add(eye);
        });
        g.userData.brushes = [-1, 1].map(s => {
            const b = new THREE.Group();
            for (let k = 0; k < 3; k++) {
                const bristle = mesh(Geo.box, Mat.white, false);
                bristle.scale.set(0.16, 0.01, 0.015);
                bristle.position.x = 0.08;
                const arm = new THREE.Group();
                arm.rotation.y = (k / 3) * Math.PI * 2;
                arm.add(bristle);
                b.add(arm);
            }
            b.position.set(0.32, 0.03, s * 0.32);
            g.add(b);
            return b;
        });
        return g;
    },

    fish(gold) {
        const g = new THREE.Group();
        const mat = gold ? Mat.fishGold : Mat.fish;
        // 床に横たわった魚
        const body = mesh(Geo.sphere, mat);
        body.scale.set(0.5, 0.11, 0.2);
        const tail = mesh(Geo.cone, mat);
        tail.scale.set(0.22, 0.28, 0.05);
        tail.rotation.set(Math.PI / 2, 0, Math.PI / 2);
        tail.position.x = -0.56;
        const eye = mesh(Geo.sphereLo, Mat.black, false);
        eye.scale.setScalar(0.045);
        eye.position.set(0.32, 0.08, 0.06);
        g.add(body, tail, eye);
        return g;
    },

    catnip() {
        const g = new THREE.Group();
        for (let i = 0; i < 6; i++) {
            const leaf = mesh(Geo.sphere, Mat.leaf);
            const a = (i / 6) * Math.PI * 2;
            leaf.scale.set(0.22, 0.04, 0.1);
            leaf.position.set(Math.cos(a) * 0.18, 0.05, Math.sin(a) * 0.18);
            leaf.rotation.y = -a;
            g.add(leaf);
        }
        return g;
    },

    cucumber() {
        const g = new THREE.Group();
        const c = mesh(Geo.capsule, Mat.cucumber);
        c.scale.set(0.28, 0.9, 0.28);
        c.rotation.z = Math.PI / 2;
        c.position.y = 0.14;
        g.add(c);
        return g;
    },

    vase() {
        const g = new THREE.Group();
        const pts = [[0, 0], [0.18, 0], [0.26, 0.15], [0.22, 0.35], [0.12, 0.5], [0.14, 0.58], [0, 0.58]].map(([x, y]) => new THREE.Vector2(x, y));
        const v = mesh(new THREE.LatheGeometry(pts, 20), new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.2, metalness: 0.1 }));
        g.add(v);
        [0xe63946, 0xffd166, 0xf4a261].forEach((c, i) => {
            const f = mesh(Geo.sphereLo, new THREE.MeshStandardMaterial({ color: c }));
            f.scale.setScalar(0.1);
            f.position.set(Math.cos(i * 2) * 0.1, 0.7 + i * 0.03, Math.sin(i * 2) * 0.1);
            g.add(f);
        });
        return g;
    },

    mug() {
        const g = new THREE.Group();
        const cup = mesh(Geo.cyl, Mat.white);
        cup.scale.set(0.18, 0.3, 0.18);
        cup.position.y = 0.15;
        const coffee = mesh(Geo.cyl, new THREE.MeshStandardMaterial({ color: 0x4a2c17, roughness: 0.2 }));
        coffee.scale.set(0.16, 0.01, 0.16);
        coffee.position.y = 0.3;
        const handle = mesh(Geo.torus, Mat.white);
        handle.scale.setScalar(0.09);
        handle.position.set(0.2, 0.15, 0);
        g.add(cup, coffee, handle);
        return g;
    },

    plant() {
        const g = new THREE.Group();
        const pot = mesh(Geo.cyl, new THREE.MeshStandardMaterial({ color: 0xb5651d, roughness: 0.8 }));
        pot.scale.set(0.2, 0.3, 0.2);
        pot.position.y = 0.15;
        g.add(pot);
        for (let i = 0; i < 7; i++) {
            const leaf = mesh(Geo.sphere, new THREE.MeshStandardMaterial({ color: i % 2 ? 0x2d6a4f : 0x52b788 }));
            const a = (i / 7) * Math.PI * 2;
            leaf.scale.set(0.2, 0.08, 0.1);
            leaf.position.set(Math.cos(a) * 0.15, 0.45 + (i % 3) * 0.08, Math.sin(a) * 0.15);
            leaf.rotation.set(0.3, -a, 0.5);
            g.add(leaf);
        }
        return g;
    },

    phone() {
        const g = new THREE.Group();
        const b = mesh(Geo.box, Mat.black);
        b.scale.set(0.42, 0.04, 0.22);
        b.position.y = 0.02;
        const screen = mesh(Geo.box, new THREE.MeshStandardMaterial({ color: 0x4cc9f0, emissive: 0x2a8ab0 }), false);
        screen.scale.set(0.38, 0.01, 0.18);
        screen.position.y = 0.045;
        g.add(b, screen);
        return g;
    },

    house() {
        const g = new THREE.Group();
        const walls = mesh(Geo.box, new THREE.MeshStandardMaterial({ color: 0xf1e3c8, roughness: 0.9 }));
        walls.scale.set(1.2, 0.9, 1.2);
        walls.position.y = 0.45;
        const roof = mesh(Geo.cone, new THREE.MeshStandardMaterial({ color: 0xd62839, roughness: 0.6 }));
        roof.scale.set(1.05, 0.7, 1.05);
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 1.25;
        const door = mesh(Geo.box, new THREE.MeshStandardMaterial({ color: 0x7a4e2a }));
        door.scale.set(0.05, 0.55, 0.4);
        door.position.set(0.61, 0.28, 0);
        const sign = mesh(Geo.box, Mat.fishGold);
        sign.scale.set(0.05, 0.15, 0.35);
        sign.position.set(0.62, 0.75, 0);
        g.add(walls, roof, door, sign);
        return g;
    }
};

// ---------------------------------------------------------------- 本体

const View3D = {
    ready: false,

    init() {
        if (this.ready || typeof THREE === 'undefined') return;
        this.ready = true;
        Tex.build();
        buildShared();

        const r = new THREE.WebGLRenderer({ antialias: true });
        r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        r.setSize(window.innerWidth, window.innerHeight);
        r.outputEncoding = THREE.sRGBEncoding;
        r.shadowMap.enabled = true;
        r.shadowMap.type = THREE.PCFSoftShadowMap;
        r.domElement.id = 'three-canvas';
        document.body.prepend(r.domElement);
        this.renderer = r;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a120c);
        this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 400);

        this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a3a20, 0.75));
        const sun = new THREE.DirectionalLight(0xfff0d8, 0.9);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.bias = -0.0005;
        sun.shadow.normalBias = 0.02;
        this.scene.add(sun, sun.target);
        this.sun = sun;

        this.world = new THREE.Group();
        this.scene.add(this.world);
        this.fx = [];
        this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.raycaster = new THREE.Raycaster();
        this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.camTarget = new THREE.Vector3();
        this.camDist = 14;
        this.shakeT = 0;
        this.shakeI = 0;
        this.zoomMul = 1;

        window.addEventListener('pointermove', e => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        window.addEventListener('resize', () => {
            r.setSize(window.innerWidth, window.innerHeight);
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });
    },

    clearWorld() {
        this.scene.remove(this.world);
        disposeTree(this.world);
        this.world = new THREE.Group();
        this.scene.add(this.world);
        this.fx.forEach(f => f.obj.parent && f.obj.parent.remove(f.obj));
        this.fx = [];
        this.gs = null;
        this.cat = null;
        this.death = null;
        this.vacGroup = null;
        this.goalPos = null;
        this.goalLabel = null;
        this.gatePos = null;
        this.gateLabel = null;
        this.tileGroup = null;
        this.clearAnim = null;
        this.zoomMul = 1;
    },

    // ---------------------------------------------------------------- タイトル

    buildTitle() {
        this.clearWorld();
        this.mode = 'title';
        const rug = mesh(Geo.cyl, new THREE.MeshStandardMaterial({ map: Tex.rug, roughness: 1 }), false);
        rug.scale.set(4, 0.02, 4);
        this.world.add(rug);
        const floor = mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: Tex.wood, roughness: 0.8 }), false);
        floor.material.map = Tex.wood.clone();
        floor.material.map.repeat.set(30, 30);
        floor.material.map.wrapS = floor.material.map.wrapT = THREE.RepeatWrapping;
        floor.material.map.needsUpdate = true;
        floor.position.y = -0.01;
        this.world.add(floor);
        this.cat = new Cat3D();
        this.world.add(this.cat.root);
    },

    renderTitle(timeMs, w) {
        if (!this.ready || this.mode !== 'title') return;
        const t = timeMs / 1000;
        const dU = FC.diameter(w) * U;
        this.cat.update({ w, dU, t, walk: 0, crouch: 0, punch: 0 });
        this.cat.root.rotation.y = -Math.PI / 2 + 0.4 + Math.sin(t * 0.5) * 0.3;
        const D = Cat3D.dims(w, dU);
        const size = Math.max(D.L * 1.6, 1.4);
        this.camera.position.set(0, size * 0.9 + 0.4, size * 2.2);
        this.camera.lookAt(0, D.H * 0.45 - size * 0.12, 0);
        this.sun.position.set(3, 8, 5);
        this.sun.target.position.set(0, 0, 0);
        this.renderer.render(this.scene, this.camera);
    },

    // ---------------------------------------------------------------- ゲーム

    buildGame(gs) {
        this.clearWorld();
        this.mode = 'game';
        this.gs = gs;
        this.objMeshes = new Map();
        this.tileGroup = null;
        this.buildTiles();

        const under = mesh(new THREE.PlaneGeometry(gs.W + 40, gs.H + 40).rotateX(-Math.PI / 2), Mat.dark, false);
        under.position.set(gs.W / 2, -2, gs.H / 2);
        this.world.add(under);

        (gs.level.signs || []).forEach(([x, y, text]) => {
            const s = textSprite(text, { px: 40, bg: 'rgba(0,0,0,0.7)', height: 0.42 });
            s.center.set(0, 1);
            s.position.set(x + 0.1, 1.4, y + 0.1);
            this.world.add(s);
        });
        gs.holes.forEach(h => {
            const disc = mesh(new THREE.CircleGeometry(0.35, 20).rotateX(-Math.PI / 2), Mat.dark, false);
            disc.scale.z = 0.6;
            disc.position.set(h.x * U, 0.012, h.y * U);
            this.world.add(disc);
        });
        if (gs.goal) {
            const house = Models.house();
            house.position.set(gs.goal.x * U, 0, gs.goal.y * U);
            this.world.add(house);
            this.goalPos = house.position.clone();
            this.goalLabelKey = '';
        }
        if (gs.gateTiles.length) {
            const top = gs.gateTiles.reduce((a, b) => (b.y < a.y ? b : a));
            this.gatePos = new THREE.Vector3(top.x + 0.5, 1.6, top.y - 0.2);
            this.gateLabelKey = '';
        }
        this.cat = new Cat3D();
        this.world.add(this.cat.root);
        if (gs.vac) this.buildVacuum();

        const c = gs.cat;
        this.camTarget.set(c.x * U, 0, c.y * U);
        this.camDist = this.targetDist();
    },

    // タイル（床・壁・棚など）をまとめて作り直す。タイルが変わったときに呼ぶ
    buildTiles() {
        const gs = this.gs;
        if (this.tileGroup) {
            this.world.remove(this.tileGroup);
            this.tileGroup.children.forEach(m => m.dispose && m.dispose());
        }
        this.tileGroup = new THREE.Group();
        this.world.add(this.tileGroup);
        const lists = { floor: [], old: [], crack: [], wall: [], box: [], shelf: [], gate: [], gateOpen: [] };
        for (let y = 0; y < gs.H; y++) {
            for (let x = 0; x < gs.W; x++) {
                const v = gs.grid[y][x];
                if (v === G_WALL) {
                    lists.wall.push([x, y]);
                    continue;
                }
                if (v === G_PIT) continue;
                if (v === G_FRAGILE) lists.old.push([x, y]);
                else if (v === G_CRACK) lists.crack.push([x, y]);
                else lists.floor.push([x, y]);
                if (v === G_BOX) lists.box.push([x, y]);
                if (v === G_SHELF) lists.shelf.push([x, y]);
                if (v === G_GATE) (gs.gateOpen ? lists.gateOpen : lists.gate).push([x, y]);
            }
        }
        const m4 = new THREE.Matrix4();
        const inst = (geo, mat, list, sy, y, cast, sxz = 1) => {
            if (!list.length) return;
            const im = new THREE.InstancedMesh(geo, mat, list.length);
            list.forEach(([x, z], i) => {
                m4.makeScale(sxz, sy, sxz).setPosition(x + 0.5, y, z + 0.5);
                im.setMatrixAt(i, m4);
            });
            im.castShadow = cast;
            im.receiveShadow = true;
            this.tileGroup.add(im);
        };
        const wallMats = [Mat.wall, Mat.wall, Mat.wallTop, Mat.wall, Mat.wall, Mat.wall];
        inst(Geo.box, Mat.wood, lists.floor, 0.1, -0.05, false);
        inst(Geo.box, Mat.oldWood, lists.old, 0.1, -0.05, false);
        inst(Geo.box, Mat.crack, lists.crack, 0.1, -0.08, false);
        inst(Geo.box, wallMats, lists.wall, WALL_H, WALL_H / 2, true);
        inst(Geo.box, Mat.cardboard, lists.box, 0.75, 0.375, true, 0.96);
        inst(Geo.box, Mat.shelf, lists.shelf, SHELF_H, SHELF_H / 2, true);
        inst(Geo.box, Mat.gate, lists.gate, 1.0, 0.5, true, 0.9);
        inst(Geo.box, Mat.gateOpen, lists.gateOpen, 0.03, 0.015, false, 0.9);
        this.tileKey = this.gridKey();
    },

    gridKey() {
        const gs = this.gs;
        let k = gs.gateOpen ? 'o' : 'c';
        for (let y = 0; y < gs.H; y++) k += gs.grid[y].join('');
        return k;
    },

    buildVacuum() {
        const gs = this.gs;
        const g = new THREE.Group();
        const H = gs.H;
        const machine = mesh(Geo.box, new THREE.MeshStandardMaterial({ color: 0x6b6b80, roughness: 0.4, metalness: 0.5 }));
        machine.scale.set(1.2, 2.2, H);
        machine.position.set(-0.6, 1.1, H / 2);
        const stripe = mesh(Geo.box, new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0xaa0022 }));
        stripe.scale.set(0.06, 0.3, H);
        stripe.position.set(0.02, 0.4, H / 2);
        const cover = mesh(Geo.box, new THREE.MeshBasicMaterial({ color: 0x0b0710 }), false);
        cover.scale.set(400, 0.2, H);
        cover.position.set(-200 - 1.2, 0.1, H / 2);
        const label = textSprite('掃除機', { px: 64, color: '#ff4d6d', height: 0.7 });
        label.position.set(-0.6, 3, H / 2);
        g.add(machine, stripe, cover, label);
        this.vacLabel = label;
        this.vacGroup = g;
        this.world.add(g);
    },

    targetDist() {
        const c = this.gs.cat;
        // ボス戦は少し引いて、ボスと猫の両方が見えるようにする
        const boss = this.gs.boss && this.gs.boss.active ? this.gs.boss.size * U * 1.2 : 0;
        return (9 + c.d * U * 2.1 + boss) * this.zoomMul;
    },

    // マウスが指している地面の位置（ゲーム座標）
    pointerWorld() {
        if (!this.ready) return { x: 0, y: 0 };
        const ndc = new THREE.Vector2((this.mouse.x / window.innerWidth) * 2 - 1, -(this.mouse.y / window.innerHeight) * 2 + 1);
        this.raycaster.setFromCamera(ndc, this.camera);
        const p = new THREE.Vector3();
        if (!this.raycaster.ray.intersectPlane(this.ground, p)) return { x: 0, y: 0 };
        return { x: p.x / U, y: p.z / U };
    },

    // テスト用: ゲーム座標 → 画面の座標
    worldToScreen(x, y) {
        const v = new THREE.Vector3(x * U, 0, y * U).project(this.camera);
        return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight };
    },

    renderGame(dt) {
        if (!this.ready || this.mode !== 'game' || !this.gs) return;
        const gs = this.gs;
        const now = gs.time.now;
        const t = now / 1000;

        if (this.gridKey() !== this.tileKey) this.buildTiles();
        this.syncCat(t, dt);
        this.syncObjects(t);
        this.syncLabels();
        if (this.vacGroup && gs.vac) {
            this.vacGroup.position.x = gs.vac.x * U;
            const cam = this.camTarget;
            this.vacLabel.position.z = cam.z;
        }
        this.updateFx(dt);

        // カメラ: 猫を斜め上から追いかける。太るほど引く
        const c = gs.cat;
        const target = new THREE.Vector3(c.x * U, 0, c.y * U);
        this.camTarget.lerp(target, Math.min(1, dt * 6));
        this.camDist += (this.targetDist() - this.camDist) * Math.min(1, dt * 3);
        const dist = this.camDist;
        let ox = 0, oz = 0;
        if (this.shakeT > 0) {
            this.shakeT -= dt;
            ox = (Math.random() - 0.5) * this.shakeI * dist * 2;
            oz = (Math.random() - 0.5) * this.shakeI * dist * 2;
        }
        const tilt = c.high > 0 ? Math.sin(t * 1.7) * 0.08 : 0;
        this.camera.position.set(this.camTarget.x + ox + Math.sin(tilt) * dist * 0.3, dist * 0.93, this.camTarget.z + dist * 0.38 + oz);
        this.camera.up.set(Math.sin(tilt), 1, 0);
        this.camera.lookAt(this.camTarget.x + ox, 0, this.camTarget.z + oz);
        this.sun.position.set(this.camTarget.x + 6, 14, this.camTarget.z + 8);
        this.sun.target.position.copy(this.camTarget);
        const sc = this.sun.shadow.camera;
        const ext = Math.max(12, dist * 0.9);
        sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
        sc.updateProjectionMatrix();

        this.renderer.render(this.scene, this.camera);
    },

    syncCat(t, dt) {
        const gs = this.gs;
        const c = gs.cat;
        const root = this.cat.root;
        const dU = c.d * U;
        const h = c.air ? Math.sin((Math.PI * c.air.t) / c.air.dur) * (c.air.peak * U) * 1.5 : 0;
        root.position.set(c.x * U, h, c.y * U);
        root.rotation.set(0, -c.heading, 0);
        root.scale.set(1, 1, 1);
        root.visible = !(c.invuln > 0 && !c.air && Math.floor(c.invuln * 12) % 2);
        this.cat.shadowBlob.position.y = 0.01 - h;

        if (this.death) {
            this.animateDeath(dt);
            return;
        }
        if (this.clearAnim !== null && this.clearAnim !== undefined) {
            this.clearAnim += dt;
            root.position.y = Math.abs(Math.sin(this.clearAnim * 9)) * 0.4 * Math.max(0, 1 - this.clearAnim / 1.5);
        }
        this.cat.update({
            w: c.w, dU, t,
            walk: c.walk,
            crouch: c.crouch,
            punch: c.punchT > 0 ? c.punchT / 0.14 : 0,
            sleep: c.sleeping,
            high: c.high > 0,
            scared: c.scaredT > 0,
            stuck: c.stuck
        });
        if (c.air && !c.air.scared) root.rotation.z = Math.sin((Math.PI * c.air.t) / c.air.dur) * 0.25;
    },

    animateDeath(dt) {
        const d = this.death;
        d.t += dt;
        const root = this.cat.root;
        const k = Math.min(1, d.t / d.dur);
        root.visible = d.reason !== 'burst';
        root.position.set(d.x, 0, d.z);
        root.rotation.set(0, d.heading, 0);
        switch (d.reason) {
            case 'stuck':
            case 'door':
                root.scale.set(1 + 0.6 * k, 1 - 0.7 * k, 1 + 0.6 * k);
                break;
            case 'vacuum':
                root.position.x = d.x - 6 * k * k;
                root.rotation.y = d.heading + k * 12;
                root.scale.setScalar(Math.max(0.01, 1 - k));
                break;
            case 'fall':
                root.position.y = -3 * k * k;
                root.rotation.y = d.heading + k * 6;
                root.scale.setScalar(Math.max(0.01, 1 - k * 0.8));
                break;
            default:
                // へそ天
                root.rotation.x = Math.PI * k;
                root.position.y = 0.5 * Math.sin(Math.PI * k) + k * 0.5 * this.cat.body.scale.y;
        }
    },

    // ゲームの物（敵・魚・棚の物など）に対応する 3D モデルを出したり消したりする
    syncObjects(t) {
        const gs = this.gs;
        const seen = new Set();
        const get = (obj, make) => {
            let m = this.objMeshes.get(obj);
            if (!m) {
                m = make();
                this.objMeshes.set(obj, m);
                this.world.add(m);
            }
            seen.add(obj);
            return m;
        };

        gs.enemies.getChildren().forEach(e => {
            if (!e.active) return;
            const m = get(e, () => {
                if (e.kind === 'mouse') return Models.mouse();
                if (e.kind === 'roomba') return Models.roomba();
                if (e.kind === 'boss') return Models.dog(0x5e4b6b, 0x2e2238, true);
                if (e.kind === 'bigdog') return Models.dog(0x7a4e2a, 0x3f2512, false);
                return Models.dog(0xb07840, 0x6b4423, false);
            });
            const s = e.size * U * (e.kind === 'mouse' ? 1.3 : e.kind === 'roomba' ? 1 : 1.25);
            m.scale.setScalar(s);
            m.position.set(e.x * U, 0, e.y * U);
            const v = e.body.velocity;
            const speed = v.length();
            if (speed > 5 && e.kind !== 'roomba') m.rotation.y = -Math.atan2(v.y, v.x);
            if (e.kind === 'roomba') {
                m.rotation.y = -e.rotation;
                m.userData.brushes.forEach(b => { b.rotation.y = t * 20; });
            }
            if (m.userData.legs) {
                m.userData.legs.forEach((l, i) => { l.rotation.z = Math.sin(t * 16 + i * Math.PI) * Math.min(0.6, speed / 150); });
                m.userData.tail.rotation.x = Math.sin(t * 12) * 0.5;
            }
            if (e.kind === 'mouse') m.position.y = Math.abs(Math.sin(t * 20)) * 0.02 * (speed > 5 ? 1 : 0);
            m.rotation.z = e.stun > 0 ? 0.6 : 0;
            // ダメージの白い点滅、突進前の赤
            const flash = e.isTinted ? (e.tintFill ? 0x888888 : 0x660000) : 0x000000;
            (m.userData.mats || []).forEach(mat => mat.emissive.setHex(flash));
        });

        gs.items.forEach(it => {
            const m = get(it, () => {
                if (it.kind === 'catnip') return Models.catnip();
                if (it.kind === 'mouse') {
                    const dead = Models.mouse();
                    dead.rotation.x = Math.PI;
                    const g = new THREE.Group();
                    dead.position.y = 0.4;
                    g.add(dead);
                    return g;
                }
                return Models.fish(it.value >= 3);
            });
            const sc = it.kind === 'fish' ? it.s.scaleX * 1.15 : 0.45;
            m.scale.setScalar(sc);
            const bob = it.kind === 'fish' ? 0.12 + Math.sin(t * 3 + it.s.x) * 0.05 : 0.02;
            m.position.set(it.s.x * U, bob + (it.drop || 0) * 7, it.s.y * U);
            if (it.kind === 'fish') m.rotation.y = t * 1.5 + it.s.y;
        });

        gs.hairballs.getChildren().forEach(h => {
            if (!h.active) return;
            const m = get(h, () => {
                const b = mesh(Geo.sphereLo, Mat.hairball);
                return b;
            });
            m.scale.setScalar(14 * h.scaleX * U);
            m.position.set(h.x * U, 0.3, h.y * U);
            m.rotation.set(h.rotation, h.rotation * 0.7, 0);
        });

        gs.props.forEach(pr => {
            if (!pr.s.active) return;
            const m = get(pr, () => {
                const key = pr.def.tex;
                if (key === 'fc_vase') return Models.vase();
                if (key === 'fc_mug') return Models.mug();
                if (key === 'fc_plant') return Models.plant();
                return Models.phone();
            });
            m.scale.setScalar(0.9);
            let y = SHELF_H;
            if (!pr.alive && pr.flyAt) {
                const k = Math.min(1, (gs.time.now - pr.flyAt) / 320);
                y = SHELF_H * (1 - k) + Math.sin(Math.PI * k) * 0.5;
                m.rotation.set(k * 3, pr.s.rotation, k * 2);
            } else {
                m.rotation.set(0, pr.s.rotation, 0);
            }
            m.position.set(pr.s.x * U, y, pr.s.y * U);
        });

        gs.cucumbers.forEach(k => {
            const m = get(k, () => Models.cucumber());
            m.position.set(k.x * U, 0, k.y * U);
            m.rotation.y = k.s.rotation;
        });

        for (const [obj, m] of this.objMeshes) {
            if (seen.has(obj)) continue;
            this.world.remove(m);
            disposeTree(m);
            this.objMeshes.delete(obj);
        }
    },

    // ゴールとドアの看板
    syncLabels() {
        const gs = this.gs;
        if (this.goalPos) {
            const locked = gs.boss && !gs.bossDefeated;
            const key = locked ? 'lock' : 'goal';
            if (key !== this.goalLabelKey) {
                if (this.goalLabel) this.world.remove(this.goalLabel);
                this.goalLabel = textSprite(locked ? `${gs.level.bossName}を倒せ` : 'GOAL', { px: 56, color: locked ? '#ff4d6d' : '#ffd166', height: 0.6 });
                this.world.add(this.goalLabel);
                this.goalLabelKey = key;
            }
            this.goalLabel.position.set(this.goalPos.x, 2.1 + Math.sin(gs.time.now / 300) * 0.1, this.goalPos.z);
        }
        if (this.gatePos) {
            const key = gs.gateOpen ? 'open' : 'closed';
            if (key !== this.gateLabelKey) {
                if (this.gateLabel) this.world.remove(this.gateLabel);
                const w = gs.level.gateWeight;
                this.gateLabel = textSprite(gs.gateOpen ? `OPEN (${w}kg以上)` : `${w}kg以上で開く`, { px: 44, color: gs.gateOpen ? '#3fdc7f' : '#ff4d6d', bg: 'rgba(0,0,0,0.75)', height: 0.45 });
                this.gateLabel.position.copy(this.gatePos);
                this.world.add(this.gateLabel);
                this.gateLabelKey = key;
            }
        }
    },

    // ---------------------------------------------------------------- 演出

    addFx(obj, dur, step) {
        this.world.add(obj);
        this.fx.push({ obj, t: 0, dur, step });
    },

    updateFx(dt) {
        this.fx = this.fx.filter(f => {
            f.t += dt;
            const k = Math.min(1, f.t / f.dur);
            f.step(k, f.obj);
            if (k >= 1) {
                this.world.remove(f.obj);
                disposeTree(f.obj);
                return false;
            }
            return true;
        });
    },

    floatText(x, y, text, color, size) {
        if (!this.ready || !this.gs) return;
        const s = textSprite(text, { px: 56, color });
        const base = size / 32 * 0.55 * (this.camDist / 14);
        s.scale.set(base * s.userData.aspect, base, 1);
        const sx = x * U, sz = y * U;
        this.addFx(s, 0.9, (k, o) => {
            o.position.set(sx, 1.2 + k * 1.2, sz);
            o.material.opacity = 1 - k * k;
        });
    },

    puff(x, y, size, color) {
        if (!this.ready || !this.gs) return;
        const r = size * U;
        for (let i = 0; i < 8; i++) {
            const a = Math.random() * Math.PI * 2;
            const mat = Mat.puff.clone();
            mat.color.setHex(color);
            const p = new THREE.Mesh(Geo.sphereLo, mat);
            const s0 = r * 0.3;
            this.addFx(p, 0.4, (k, o) => {
                o.position.set(x * U + Math.cos(a) * r * 0.8 * k, 0.2 + k * r * 0.5, y * U + Math.sin(a) * r * 0.8 * k);
                o.scale.setScalar(Math.max(0.001, s0 * (1 - k)));
                o.material.opacity = 1 - k;
            });
        }
    },

    explosion(x, y, R, color) {
        if (!this.ready || !this.gs) return;
        const mat = Mat.puff.clone();
        mat.color.setHex(color);
        const s = new THREE.Mesh(Geo.sphere, mat);
        this.addFx(s, 0.3, (k, o) => {
            o.position.set(x * U, 0.2, y * U);
            o.scale.set(R * U * k, R * U * k * 0.4, R * U * k);
            o.material.opacity = 0.6 * (1 - k);
        });
        this.puff(x, y, R * 0.8, 0xffd166);
    },

    clawMarks(x, y, angle, d) {
        if (!this.ready || !this.gs) return;
        const g = new THREE.Group();
        const len = Math.max(0.5, d * U * 0.7);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
        for (let i = -1; i <= 1; i++) {
            const m = new THREE.Mesh(Geo.box, mat);
            m.scale.set(len, 0.03, 0.05);
            m.position.set(0, 0, i * len * 0.25);
            m.rotation.y = 0.35;
            g.add(m);
        }
        g.rotation.y = -angle + Math.PI / 2;
        this.addFx(g, 0.22, (k, o) => {
            o.position.set(x * U, 0.6, y * U);
            o.scale.setScalar(1 + k * 0.4);
            mat.opacity = 1 - k;
        });
    },

    shake(ms, intensity) {
        if (this.shakeT <= 0) this.shakeI = 0;
        this.shakeT = Math.max(this.shakeT, ms / 1000);
        this.shakeI = Math.max(this.shakeI, intensity);
    },

    catDeath(reason) {
        if (!this.gs) return;
        const c = this.gs.cat;
        const dur = { stuck: 0.3, door: 0.3, vacuum: 0.7, fall: 0.9 }[reason] || 0.45;
        this.death = { reason, t: 0, dur, x: c.x * U, z: c.y * U, heading: -c.heading };
        this.zoomMul = 0.8;
        if (reason === 'burst') {
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                const f = Models.fish(i % 3 === 0);
                f.scale.setScalar(0.8);
                const sx = c.x * U, sz = c.y * U;
                this.addFx(f, 1.2, (k, o) => {
                    o.position.set(sx + Math.cos(a) * 12 * k, Math.sin(Math.PI * k) * 4, sz + Math.sin(a) * 12 * k);
                    o.rotation.set(k * 10, a, k * 6);
                });
            }
        }
    },

    catClear() {
        this.clearAnim = 0;
    }
};
