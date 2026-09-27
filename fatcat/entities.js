// ネズミ・ルンバ・食べ物・きゅうり
import * as THREE from 'three';
import { FOODS } from './config.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });

function shadowed(g) {
    g.traverse(o => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });
    return g;
}

// 床の上で円をはこから押し出す（ネズミやルンバ用）
function pushOutCircle(pos, r, colliders, maxY) {
    let hit = false;
    for (const c of colliders) {
        if (c.min.y >= maxY || c.max.y <= 0.005) continue;
        const cx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
        const cz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
        const dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            pos.x = cx + (dx / d) * r;
            pos.z = cz + (dz / d) * r;
        } else {
            // 中心が箱の中: いちばん近い面から外へ
            const opts = [
                [c.min.x - r - pos.x, 0], [c.max.x + r - pos.x, 0],
                [0, c.min.z - r - pos.z], [0, c.max.z + r - pos.z]
            ].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
            pos.x += opts[0][0];
            pos.z += opts[0][1];
        }
    }
    pos.x = Math.max(r, Math.min(10 - r, pos.x));
    pos.z = Math.max(r, Math.min(7 - r, pos.z));
    return hit;
}

export function mouseModel(scale = 1) {
    const g = new THREE.Group();
    const fur = mat(0x7a716a, { roughness: 1 });
    const pink = mat(0xe8a0a8);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), fur);
    body.scale.set(0.045, 0.026, 0.028);
    body.position.y = 0.026;
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), fur);
    head.scale.set(0.025, 0.02, 0.019);
    head.position.set(0.05, 0.03, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), pink);
    nose.position.set(0.075, 0.028, 0);
    g.add(body, head, nose);
    [-1, 1].forEach(s => {
        const ear = new THREE.Mesh(new THREE.CircleGeometry(0.012, 12), pink);
        ear.position.set(0.045, 0.05, s * 0.013);
        ear.rotation.y = -Math.PI / 2 + s * 0.4;
        ear.material.side = THREE.DoubleSide;
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), mat(0x050505, { roughness: 0.1 }));
        eye.position.set(0.064, 0.036, s * 0.011);
        g.add(ear, eye);
    });
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.04, 0.02, 0), new THREE.Vector3(-0.08, 0.008, 0.01),
        new THREE.Vector3(-0.12, 0.004, -0.01), new THREE.Vector3(-0.16, 0.01, 0.015)
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.0025, 6), pink));
    g.scale.setScalar(scale);
    return shadowed(g);
}

export class Mouse {
    constructor(scene, x, z) {
        this.mesh = mouseModel();
        this.pos = new THREE.Vector3(x, 0, z);
        this.dir = Math.random() * Math.PI * 2;
        this.speed = 0;
        this.t = Math.random() * 2;
        this.alive = true;
        scene.add(this.mesh);
        this.scene = scene;
    }

    update(dt, game) {
        const cat = game.cat;
        const dx = this.pos.x - cat.pos.x, dz = this.pos.z - cat.pos.z;
        const dist = Math.hypot(dx, dz);
        this.t -= dt;
        // 猫が起きていて近いと逃げる。寝ている猫には寄ってくる
        if (dist < 1.6 && !cat.sleeping) {
            const away = Math.atan2(dz, dx);
            this.dir = away + Math.sin(game.time * 6 + this.pos.x) * 0.5;
            this.speed = 1.35;
        } else if (cat.sleeping && dist < 3) {
            this.dir = Math.atan2(-dz, -dx);
            this.speed = 0.25;
        } else if (this.t <= 0) {
            this.t = 0.8 + Math.random() * 2;
            this.dir += (Math.random() - 0.5) * 2.5;
            this.speed = Math.random() < 0.3 ? 0 : 0.4 + Math.random() * 0.4;
        }
        const ox = this.pos.x, oz = this.pos.z;
        this.pos.x += Math.cos(this.dir) * this.speed * dt;
        this.pos.z += Math.sin(this.dir) * this.speed * dt;
        if (pushOutCircle(this.pos, 0.035, game.colliders, 0.055)) this.dir += (Math.random() < 0.5 ? 1 : -1) * 1.2;
        const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
        this.mesh.position.set(this.pos.x, Math.abs(Math.sin(game.time * 30)) * 0.004 * (moved > 0.001 ? 1 : 0), this.pos.z);
        this.mesh.rotation.y = -this.dir;
    }

    remove() {
        this.alive = false;
        this.scene.remove(this.mesh);
    }
}

export function roombaModel() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 40), mat(0x2b2d33, { roughness: 0.35, metalness: 0.3 }));
    body.position.y = 0.25;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.04, 40), mat(0x4a4e57, { roughness: 0.2, metalness: 0.5 }));
    top.position.y = 0.51;
    const bumper = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.28, 40, 1, true, -1.2, 2.4), mat(0x15161a, { roughness: 0.6 }));
    bumper.position.y = 0.2;
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 20), new THREE.MeshStandardMaterial({ color: 0x3fdc7f, emissive: 0x1f8a45 }));
    btn.position.set(0.3, 0.53, 0);
    g.add(body, top, bumper, btn);
    g.userData.brushes = [-1, 1].map(s => {
        const b = new THREE.Group();
        for (let k = 0; k < 3; k++) {
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.01, 0.02), mat(0xdddddd));
            arm.position.x = 0.17;
            const piv = new THREE.Group();
            piv.rotation.y = (k / 3) * Math.PI * 2;
            piv.add(arm);
            b.add(piv);
        }
        b.position.set(0.7, 0.02, s * 0.6);
        g.add(b);
        return b;
    });
    return shadowed(g);
}

// ルンバ: まっすぐ走り、ぶつかったら向きを変える（本物と同じ動き）
export class Roomba {
    constructor(scene, x, z, r = 0.17, boss = false) {
        this.r = r;
        this.boss = boss;
        this.pos = new THREE.Vector3(x, 0, z);
        this.dir = Math.random() * Math.PI * 2;
        this.turn = 0;
        this.mesh = roombaModel();
        this.mesh.scale.set(r, boss ? r * 0.6 : 0.17, r);
        scene.add(this.mesh);
        this.scene = scene;
        this.alive = true;
        this.bumpCd = 0;
    }

    get height() {
        return this.boss ? this.r * 0.32 : 0.09;
    }

    setRadius(r) {
        this.r = r;
        this.mesh.scale.set(r, this.boss ? r * 0.6 : 0.17, r);
    }

    update(dt, game) {
        this.bumpCd -= dt;
        const speed = this.boss ? 0.45 : 0.32;
        if (this.boss) {
            // ボスは猫に向かってじわじわ寄ってくる
            const want = Math.atan2(game.cat.pos.z - this.pos.z, game.cat.pos.x - this.pos.x);
            let d = want - this.dir;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            this.dir += Math.max(-1, Math.min(1, d)) * dt * 0.8;
        }
        if (this.turn > 0) {
            this.turn -= dt;
            this.dir += dt * 2.5;
        } else {
            this.pos.x += Math.cos(this.dir) * speed * dt;
            this.pos.z += Math.sin(this.dir) * speed * dt;
        }
        if (pushOutCircle(this.pos, this.r, game.colliders, this.height) && this.turn <= 0) {
            this.turn = 0.4 + Math.random() * 0.8;
            if (Math.random() < 0.3) game.sfx('roomba');
        }
        this.mesh.position.set(this.pos.x, 0, this.pos.z);
        this.mesh.rotation.y = -this.dir;
        this.mesh.userData.brushes.forEach(b => { b.rotation.y = game.time * 18; });
    }

    remove() {
        this.alive = false;
        this.scene.remove(this.mesh);
    }
}

// --- 食べ物 ---
function foodModel(type) {
    const g = new THREE.Group();
    if (type === 'kibble') {
        const pts = [[0.0, 0], [0.09, 0], [0.11, 0.05], [0.12, 0.055], [0.11, 0.057], [0.085, 0.01], [0, 0.01]].map(([x, y]) => new THREE.Vector2(x, y));
        g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 32), mat(0xcfd4d8, { metalness: 0.9, roughness: 0.25 })));
        const km = mat(0x8a5a2b, { roughness: 0.9 });
        g.userData.pieces = [];
        for (let i = 0; i < 40; i++) {
            const k = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 5), km);
            const a = Math.random() * Math.PI * 2, r = Math.random() * 0.075;
            k.position.set(Math.cos(a) * r, 0.02 + Math.random() * 0.02, Math.sin(a) * r);
            g.add(k);
            g.userData.pieces.push(k);
        }
    } else if (type === 'fish') {
        const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), mat(0xa38a6a, { roughness: 0.5, metalness: 0.2 }));
        body.scale.set(0.11, 0.022, 0.035);
        body.position.y = 0.022;
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.06, 4), mat(0x6b5a45));
        tail.rotation.z = Math.PI / 2;
        tail.scale.z = 0.3;
        tail.position.set(-0.13, 0.022, 0);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), mat(0xeeeeee, { roughness: 0.1 }));
        eye.position.set(0.085, 0.03, 0.02);
        g.add(body, tail, eye);
        for (let i = 0; i < 4; i++) {
            const mark = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.002, 0.05), mat(0x3a2a1a));
            mark.position.set(-0.05 + i * 0.03, 0.043, 0);
            mark.rotation.y = 0.5;
            g.add(mark);
        }
    } else if (type === 'treat') {
        const pack = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.035), mat(0xf28482, { roughness: 0.4 }));
        pack.position.y = 0.006;
        const label = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.013, 0.025), mat(0xffffff));
        label.position.y = 0.006;
        g.add(pack, label);
    } else if (type === 'catnip') {
        const lm = mat(0x6a994e, { roughness: 0.8 });
        for (let i = 0; i < 7; i++) {
            const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), lm);
            const a = (i / 7) * Math.PI * 2;
            leaf.scale.set(0.04, 0.006, 0.018);
            leaf.position.set(Math.cos(a) * 0.03, 0.01 + (i % 2) * 0.01, Math.sin(a) * 0.03);
            leaf.rotation.y = -a;
            g.add(leaf);
        }
    } else if (type === 'toy') {
        const m = mouseModel(1.1);
        m.traverse(o => {
            if (o.isMesh && o.material.color && o.material.color.getHex() === 0x7a716a) o.material = mat(0xb9b2a8, { roughness: 1 });
        });
        g.add(m);
    } else if (type === 'mouse') {
        const m = mouseModel();
        m.rotation.x = Math.PI;
        m.position.y = 0.05;
        g.add(m);
    }
    return shadowed(g);
}

export class Food {
    constructor(scene, type, x, y, z, rot = 0) {
        this.type = type;
        const def = FOODS[type] || { name: 'ネズミ', kg: 0.6, bites: 1 };
        this.def = def;
        this.kg = def.kg;
        this.bites = def.bites;
        this.mesh = foodModel(type);
        this.pos = new THREE.Vector3(x, y, z);
        this.mesh.position.copy(this.pos);
        this.mesh.rotation.y = rot;
        this.alive = true;
        this.falling = 0;
        scene.add(this.mesh);
        this.scene = scene;
    }

    // 1口食べる。残りがなければ消える（お皿はそのまま）
    bite() {
        this.bites--;
        const pieces = this.mesh.userData.pieces;
        if (pieces) {
            const keep = Math.floor(pieces.length * this.bites / this.def.bites);
            pieces.forEach((p, i) => { p.visible = i < keep; });
        }
        if (this.bites <= 0) {
            this.alive = false;
            if (!pieces) this.scene.remove(this.mesh);
        }
        return this.kg / this.def.bites;
    }

    update(dt, t) {
        if (this.falling > 0) {
            this.falling = Math.max(0, this.falling - dt * 3);
            this.mesh.position.y = this.pos.y + this.falling * 2.2;
        }
        if (this.type === 'toy' || this.type === 'catnip' || this.type === 'treat') {
            this.mesh.position.y = this.pos.y + (this.falling || 0) * 2.2 + Math.max(0, Math.sin(t * 3)) * 0.01;
        }
    }

    remove() {
        this.alive = false;
        this.scene.remove(this.mesh);
    }
}

export class Cucumber {
    constructor(scene, x, z, rot) {
        const g = new THREE.Group();
        const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.2, 6, 12), mat(0x2d6a4f, { roughness: 0.45 }));
        c.rotation.z = Math.PI / 2;
        c.position.y = 0.022;
        g.add(c);
        for (let i = 0; i < 14; i++) {
            const bump = new THREE.Mesh(new THREE.SphereGeometry(0.003, 5, 4), mat(0x95d5b2));
            const a = Math.random() * Math.PI * 2;
            bump.position.set(-0.1 + Math.random() * 0.2, 0.022 + Math.cos(a) * 0.022, Math.sin(a) * 0.022);
            g.add(bump);
        }
        g.position.set(x, 0, z);
        g.rotation.y = rot;
        scene.add(shadowed(g));
        this.mesh = g;
        this.pos = new THREE.Vector3(x, 0, z);
        this.cool = 0;
        this.scene = scene;
    }

    remove() {
        this.scene.remove(this.mesh);
    }
}
