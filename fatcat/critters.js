// 町の生き物と乗り物: ネズミ・カラス・犬・人間・トラック
import * as THREE from 'three';
import { toon, refreshOutlines } from './toon.js';
import { part } from './items.js';

const S = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const mats = {};
const mat = c => mats[c] || (mats[c] = toon(c));
const flat2 = v => Math.hypot(v.x, v.z);

function turnTo(cur, target, k) {
    let d = target - cur;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return cur + d * Math.min(1, k);
}

// ---------------------------------------------------------------- ネズミ

export class Mouse {
    constructor(scene, rect) {
        this.scene = scene;
        this.rect = rect;
        this.pos = new THREE.Vector3(rect.x0 + Math.random() * (rect.x1 - rect.x0), 0, rect.z0 + Math.random() * (rect.z1 - rect.z0));
        this.dir = Math.random() * Math.PI * 2;
        this.alive = true;
        this.turnT = 1;
        this.root = new THREE.Group();
        const body = part(S(0.05).scale(1.5, 0.8, 0.9), mat(0x9a9aa3));
        body.position.y = 0.04;
        const ear = part(S(0.02), mat(0xf4a6b8), 0);
        ear.position.set(0.05, 0.08, 0.02);
        const ear2 = ear.clone();
        ear2.position.z = -0.02;
        const tail = part(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 5).rotateZ(Math.PI / 2 - 0.3), mat(0xf4a6b8), 0);
        tail.position.set(-0.13, 0.05, 0);
        this.root.add(body, ear, ear2, tail);
        scene.add(this.root);
        refreshOutlines(this.root);
    }

    update(dt, game) {
        const c = game.cat;
        const dx = this.pos.x - c.pos.x, dz = this.pos.z - c.pos.z;
        const d = Math.hypot(dx, dz);
        let spd = 1.0;
        if (d < 1.6 && c.pos.y < 0.4) {
            this.dir = turnTo(this.dir, Math.atan2(dz, dx), dt * 8);
            spd = 2.6;
        } else {
            this.turnT -= dt;
            if (this.turnT <= 0) {
                this.turnT = 0.8 + Math.random() * 1.5;
                this.dir += (Math.random() - 0.5) * 2.5;
            }
        }
        this.pos.x += Math.cos(this.dir) * spd * dt;
        this.pos.z += Math.sin(this.dir) * spd * dt;
        const r = this.rect;
        if (this.pos.x < r.x0 || this.pos.x > r.x1) this.dir = Math.PI - this.dir;
        if (this.pos.z < r.z0 || this.pos.z > r.z1) this.dir = -this.dir;
        this.pos.x = Math.max(r.x0, Math.min(r.x1, this.pos.x));
        this.pos.z = Math.max(r.z0, Math.min(r.z1, this.pos.z));
        this.root.position.copy(this.pos);
        this.root.rotation.y = -this.dir;
    }

    remove() {
        this.alive = false;
        this.scene.remove(this.root);
    }
}

// ---------------------------------------------------------------- カラス

export class Crow {
    constructor(scene, perch) {
        this.scene = scene;
        this.perch = perch.clone();
        this.pos = perch.clone();
        this.state = 'perch';
        this.t = 4 + Math.random() * 6;
        this.heading = 0;
        this.target = null;
        this.from = new THREE.Vector3();
        this.to = new THREE.Vector3();
        this.root = new THREE.Group();
        const black = mat(0x2a2833);
        const body = part(S(0.12).scale(1.5, 0.9, 0.9), black);
        body.position.y = 0.16;
        const head = part(S(0.07), black);
        head.position.set(0.17, 0.26, 0);
        const beak = part(new THREE.ConeGeometry(0.03, 0.1, 8).rotateZ(-Math.PI / 2), mat(0x55505a), 0.003);
        beak.position.set(0.26, 0.25, 0);
        const eye = new THREE.Mesh(S(0.012, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        eye.position.set(0.21, 0.29, 0.05);
        const eye2 = eye.clone();
        eye2.position.z = -0.05;
        const tail = part(new THREE.BoxGeometry(0.16, 0.02, 0.1), black);
        tail.position.set(-0.2, 0.18, 0);
        tail.rotation.z = 0.3;
        this.wings = [-1, 1].map(s => {
            const pivot = new THREE.Group();
            pivot.position.set(0, 0.2, s * 0.08);
            const wing = part(new THREE.BoxGeometry(0.2, 0.015, 0.26), black);
            wing.position.set(-0.02, 0, s * 0.13);
            pivot.add(wing);
            this.root.add(pivot);
            return { pivot, s };
        });
        [-1, 1].forEach(s => {
            const leg = part(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 5), mat(0x55505a), 0);
            leg.position.set(0, 0.04, s * 0.04);
            this.root.add(leg);
        });
        this.head = head;
        this.root.add(body, head, beak, eye, eye2, tail);
        this.root.position.copy(this.pos);
        scene.add(this.root);
        refreshOutlines(this.root);
    }

    // 追い払われる
    scare(game) {
        if (this.state === 'perch' || this.state === 'home') return false;
        this.state = 'home';
        this.target = null;
        this.flyTo(this.perch);
        game.hud.floatText(this.pos.clone().setY(this.pos.y + 0.4), 'カァ!', '#ffffff', 20);
        game.sfx('crow');
        return true;
    }

    flyTo(p) {
        this.from.copy(this.pos);
        this.to.copy(p);
        this.k = 0;
        this.dur = Math.max(0.6, this.from.distanceTo(this.to) / 6);
    }

    update(dt, game) {
        this.t -= dt;
        const flying = this.state === 'fly' || this.state === 'home';
        if (flying) {
            this.k = Math.min(1, this.k + dt / this.dur);
            const k = this.k;
            this.pos.lerpVectors(this.from, this.to, k);
            this.pos.y += Math.sin(Math.PI * k) * 1.5;
            const dir = new THREE.Vector3().subVectors(this.to, this.from);
            this.heading = Math.atan2(dir.z, dir.x);
            if (k >= 1) {
                if (this.state === 'fly') {
                    if (this.target && this.target.alive) {
                        this.state = 'peck';
                        this.t = 3;
                    } else {
                        this.state = 'home';
                        this.flyTo(this.perch);
                    }
                } else {
                    this.state = 'perch';
                    this.t = 8 + Math.random() * 8;
                }
            }
        } else if (this.state === 'perch' && this.t <= 0) {
            // 近くの食べ物を狙う（猫がそばにいない物）
            this.t = 3;
            const c = game.cat;
            const cand = game.foods.filter(f => f.alive && !f.falling && f !== c.eatFood &&
                Math.hypot(f.pos.x - this.perch.x, f.pos.z - this.perch.z) < 16 &&
                Math.hypot(f.pos.x - c.pos.x, f.pos.z - c.pos.z) > 3 &&
                !game.crows.some(o => o !== this && o.target === f));
            if (cand.length) {
                this.target = cand[Math.floor(Math.random() * cand.length)];
                this.state = 'fly';
                this.flyTo(this.target.pos.clone().add(new THREE.Vector3(-0.2, 0, 0)));
                game.sfx('crow');
            }
        } else if (this.state === 'peck') {
            const f = this.target;
            const c = game.cat;
            if (!f || !f.alive) {
                this.state = 'home';
                this.flyTo(this.perch);
            } else if (Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z) < 1.2 && Math.abs(c.pos.y - this.pos.y) < 0.6) {
                this.scare(game);
            } else if (this.t <= 0) {
                game.crowSteal(this, f);
                this.state = 'home';
                this.flyTo(this.perch);
            }
        }
        // 羽ばたき・つつく
        const flap = flying ? Math.sin(game.time * 22) * 0.9 : 0;
        this.wings.forEach(w => { w.pivot.rotation.x = w.s * (flying ? flap : 0.05); });
        this.head.position.y = 0.26 - (this.state === 'peck' ? Math.abs(Math.sin(game.time * 10)) * 0.08 : 0);
        this.root.position.copy(this.pos);
        this.root.rotation.y = -this.heading;
    }
}

// ---------------------------------------------------------------- 犬（鎖につながれている）

export class Dog {
    constructor(scene, def) {
        this.scene = scene;
        this.anchor = def.anchor.clone();
        this.chain = def.chain;
        this.pos = new THREE.Vector3(def.x, 0, def.z);
        this.heading = Math.PI / 2;
        this.state = 'sleep';
        this.barkT = 0;
        this.biteCd = 0;
        this.root = new THREE.Group();
        const fur = mat(0xd98c3f), white = mat(0xfff4e0);
        const body = part(S(0.2).scale(1.6, 0.9, 0.85), fur, 0.006);
        body.position.y = 0.36;
        const belly = part(S(0.17).scale(1.5, 0.7, 0.75), white, 0);
        belly.position.set(0.02, 0.3, 0);
        this.headG = new THREE.Group();
        this.headG.position.set(0.34, 0.55, 0);
        const head = part(S(0.15), fur, 0.006);
        const snout = part(S(0.08).scale(1.2, 0.8, 0.9), white, 0.005);
        snout.position.set(0.13, -0.04, 0);
        const nose = part(S(0.025), mat(0x222222), 0);
        nose.position.set(0.22, -0.02, 0);
        this.headG.add(head, snout, nose);
        [-1, 1].forEach(s => {
            const ear = part(new THREE.ConeGeometry(0.06, 0.12, 4), fur, 0.005);
            ear.position.set(-0.02, 0.15, s * 0.08);
            this.headG.add(ear);
            const eye = new THREE.Mesh(S(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0x222222 }));
            eye.position.set(0.11, 0.04, s * 0.07);
            this.headG.add(eye);
        });
        this.legs = [[0.18, 1], [0.18, -1], [-0.2, 1], [-0.2, -1]].map(([x, s]) => {
            const leg = part(new THREE.CylinderGeometry(0.04, 0.04, 0.26, 8), fur, 0.005);
            leg.position.set(x, 0.13, s * 0.11);
            this.root.add(leg);
            return leg;
        });
        const tail = part(new THREE.TorusGeometry(0.07, 0.035, 8, 12, Math.PI * 1.5), fur, 0.005);
        tail.position.set(-0.33, 0.5, 0);
        tail.rotation.y = Math.PI / 2;
        this.tail = tail;
        this.root.add(body, belly, this.headG, tail);
        scene.add(this.root);
        this.chainGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        this.chainLine = new THREE.Line(this.chainGeo, new THREE.LineBasicMaterial({ color: 0x777777 }));
        scene.add(this.chainLine);
        refreshOutlines(this.root);
    }

    update(dt, game) {
        const c = game.cat;
        this.barkT -= dt;
        this.biteCd -= dt;
        const toCat = new THREE.Vector3(c.pos.x - this.pos.x, 0, c.pos.z - this.pos.z);
        const d = flat2(toCat);
        const catGround = c.pos.y < 0.45;
        const catToAnchor = Math.hypot(c.pos.x - this.anchor.x, c.pos.z - this.anchor.z);
        let spd = 0;
        let want = this.heading;
        if (c.w >= 30 && d < 6) {
            // 大きすぎる猫にはかなわない
            if (this.state !== 'cower') {
                this.state = 'cower';
                game.hud.floatText(this.pos.clone().setY(0.9), 'キャイン…', '#ffffff', 20);
                game.sfx('whine');
                game.sayOnce('dogCower', ['犬が負けを認めた', '体重は正義']);
            }
            const home = new THREE.Vector3(this.anchor.x - 0.2, 0, this.anchor.z + 0.6);
            const dh = new THREE.Vector3().subVectors(home, this.pos);
            if (flat2(dh) > 0.1) {
                want = Math.atan2(dh.z, dh.x);
                spd = 1.5;
            } else want = Math.atan2(-toCat.z, -toCat.x);
        } else if (catGround && catToAnchor < this.chain + 1.4) {
            this.state = 'chase';
            want = Math.atan2(toCat.z, toCat.x);
            spd = d > 0.5 ? 3.2 : 0;
            if (this.barkT <= 0) this.bark(game);
            if (d < 0.35 + c.r && this.biteCd <= 0) {
                this.biteCd = 1.2;
                game.dogBite(this);
            }
        } else if (d < 6) {
            this.state = 'bark';
            want = Math.atan2(toCat.z, toCat.x);
            if (this.barkT <= 0) this.bark(game);
        } else {
            this.state = 'sleep';
        }
        this.heading = turnTo(this.heading, want, dt * 10);
        this.pos.x += Math.cos(this.heading) * spd * dt;
        this.pos.z += Math.sin(this.heading) * spd * dt;
        // 鎖の長さまで
        const off = new THREE.Vector3(this.pos.x - this.anchor.x, 0, this.pos.z - this.anchor.z);
        if (off.length() > this.chain) {
            off.setLength(this.chain);
            this.pos.set(this.anchor.x + off.x, 0, this.anchor.z + off.z);
        }
        // 犬小屋・塀の中に収める
        this.pos.x = Math.max(34.8, Math.min(45.3, this.pos.x));
        this.pos.z = Math.max(22.4, Math.min(29.1, this.pos.z));
        if (this.pos.x > 39.6 && this.pos.x < 41.6 && this.pos.z < 24.6) this.pos.z = 24.6;

        const t = game.time;
        const run = spd > 0 ? Math.sin(t * 18) * 0.5 : 0;
        this.legs.forEach((l, i) => { l.rotation.z = (i % 2 ? run : -run) * (i < 2 ? 1 : -1); });
        const sleeping = this.state === 'sleep';
        this.root.position.copy(this.pos);
        this.root.position.y = this.state === 'bark' || this.state === 'chase' ? Math.abs(Math.sin(t * 12)) * 0.03 : 0;
        this.root.rotation.y = -this.heading;
        this.root.scale.y = sleeping ? 0.75 : this.state === 'cower' ? 0.7 : 1;
        this.headG.rotation.z = sleeping ? -0.5 : this.state === 'cower' ? -0.4 : 0.1;
        this.tail.rotation.x = this.state === 'cower' ? 0 : Math.sin(t * (sleeping ? 1 : 14)) * 0.5;
        const pts = this.chainGeo.attributes.position;
        pts.setXYZ(0, this.anchor.x, 0.05, this.anchor.z);
        pts.setXYZ(1, this.pos.x, 0.45, this.pos.z);
        pts.needsUpdate = true;
        this.chainGeo.computeBoundingSphere();
    }

    bark(game) {
        this.barkT = 0.7;
        game.sfx('bark');
        game.hud.floatText(this.pos.clone().setY(0.9), 'ワン!', '#ffffff', 22, 0.7);
    }
}

// ---------------------------------------------------------------- 人間

function person(opt) {
    const g = new THREE.Group();
    const skin = mat(0xffd9b8);
    const legs = [-1, 1].map(s => {
        const leg = part(new THREE.CapsuleGeometry(0.07, 0.6, 4, 8), mat(opt.pants), 0.008);
        leg.position.set(0, 0.38, s * 0.11);
        g.add(leg);
        return leg;
    });
    const torso = part(new THREE.CapsuleGeometry(0.2, 0.42, 4, 12), mat(opt.shirt), 0.01);
    torso.position.y = 1.05;
    g.add(torso);
    if (opt.apron) {
        const apron = part(new THREE.BoxGeometry(0.06, 0.7, 0.34), mat(opt.apron), 0.006);
        apron.position.set(0.19, 0.85, 0);
        g.add(apron);
    }
    const head = part(S(0.16, 16, 12), skin, 0.008);
    head.position.y = 1.5;
    g.add(head);
    const hair = part(S(0.165, 16, 12, 0).scale(1, 0.75, 1), mat(opt.hair), 0.008);
    hair.position.set(-0.03, 1.56, 0);
    g.add(hair);
    if (opt.bun) {
        const bun = part(S(0.08), mat(opt.hair), 0.006);
        bun.position.set(-0.12, 1.68, 0);
        g.add(bun);
    }
    if (opt.band) {
        const band = part(new THREE.TorusGeometry(0.16, 0.025, 6, 20).rotateX(Math.PI / 2), mat(opt.band), 0);
        band.position.y = 1.58;
        g.add(band);
    }
    [-1, 1].forEach(s => {
        const eye = new THREE.Mesh(S(0.018, 6, 5), new THREE.MeshBasicMaterial({ color: 0x2a2020 }));
        eye.position.set(0.15, 1.52, s * 0.06);
        g.add(eye);
    });
    const arms = [-1, 1].map(s => {
        const pivot = new THREE.Group();
        pivot.position.set(0, 1.25, s * 0.26);
        const arm = part(new THREE.CapsuleGeometry(0.055, 0.45, 4, 8), mat(opt.shirt), 0.006);
        arm.position.y = -0.25;
        pivot.add(arm);
        g.add(pivot);
        return pivot;
    });
    return { g, legs, arms, torso, head };
}

export class Human {
    constructor(scene, def) {
        this.scene = scene;
        this.kind = def.kind;
        this.def = def;
        this.state = 'idle';
        this.t = 0;
        this.cd = 0;
        this.dir = 1;
        if (def.kind === 'fishmonger') {
            this.body = person({ shirt: 0xffffff, pants: 0x3b4a6b, hair: 0x2a2020, apron: 0x2f6fb0, band: 0xffffff });
            this.pos = new THREE.Vector3((def.x0 + def.x1) / 2, 0, def.z);
            // ほうき
            const broom = new THREE.Group();
            const stick = part(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 6), mat(0xc79a5c), 0.004);
            stick.position.y = -0.45;
            const brush = part(new THREE.ConeGeometry(0.12, 0.25, 8), mat(0xe6c36b), 0.004);
            brush.position.y = -1.0;
            broom.add(stick, brush);
            broom.position.y = -0.45;
            this.body.arms[1].add(broom);
            this.broom = broom;
        } else if (def.kind === 'yakitori') {
            this.body = person({ shirt: 0x2a2a2a, pants: 0x2a2a2a, hair: 0x2a2020, apron: 0x8c1c13, band: 0xd62839 });
            this.pos = new THREE.Vector3((def.x0 + def.x1) / 2, 0, def.z);
        } else {
            // おばあちゃん（ベンチに座っている）
            this.body = person({ shirt: 0x9b7bc4, pants: 0x6b5a4a, hair: 0xdedede, bun: true });
            this.pos = new THREE.Vector3(def.x, 0, def.z);
            this.body.legs.forEach(l => {
                l.rotation.z = Math.PI / 2;
                l.position.set(0.28, 0.48, l.position.z);
            });
            this.body.g.children.forEach(o => { if (o !== this.body.legs[0] && o !== this.body.legs[1]) o.position.y -= 0.26; });
        }
        this.root = this.body.g;
        this.root.position.copy(this.pos);
        // 通りのほう（北 = -z）を向く
        this.root.rotation.y = this.kind === 'grandma' ? -Math.PI / 2 : Math.PI / 2;
        scene.add(this.root);
        refreshOutlines(this.root);
    }

    update(dt, game) {
        const t = game.time;
        this.t -= dt;
        this.cd -= dt;
        const arms = this.body.arms;
        if (this.kind === 'yakitori') {
            arms[1].rotation.z = -1.2 + Math.sin(t * 9) * 0.4; // うちわであおぐ
            return;
        }
        if (this.kind === 'grandma') {
            this.body.head.rotation.z = Math.sin(t * 0.7) * 0.05;
            arms[0].rotation.z = arms[1].rotation.z = -0.7;
            return;
        }
        // 魚屋: 店先をうろうろ。魚を狙う猫をほうきで払う
        const c = game.cat;
        const near = c.pos.z < this.def.z + 0.2 && c.pos.z > 36.3 && c.pos.x > this.def.x0 - 1 && c.pos.x < this.def.x1 + 1 && c.pos.y < 1.2;
        const guilty = near && ((c.onGround && c.pos.y > 0.7) || (c.eatFood && c.eatFood.type === 'fish'));
        if (this.state === 'idle') {
            this.pos.x += this.dir * 0.6 * dt;
            if (this.pos.x > this.def.x1) this.dir = -1;
            if (this.pos.x < this.def.x0) this.dir = 1;
            if (guilty && this.cd <= 0) {
                this.state = 'angry';
                this.t = 1.0;
                game.hud.floatText(this.pos.clone().setY(2.0), 'こらー!!', '#ff4d6d', 30, 1.2);
                game.sfx('angry');
            }
            arms[1].rotation.z = 0;
        } else if (this.state === 'angry') {
            // 猫のほうへ寄ってから振り下ろす
            this.pos.x += Math.sign(c.pos.x - this.pos.x) * Math.min(Math.abs(c.pos.x - this.pos.x), 2.5 * dt);
            this.pos.x = Math.max(this.def.x0, Math.min(this.def.x1, this.pos.x));
            arms[1].rotation.z = Math.min(2.4, arms[1].rotation.z + dt * 5);
            if (this.t <= 0) {
                this.state = 'swing';
                this.t = 0.25;
                if (near) game.broomHit(this);
            }
        } else if (this.state === 'swing') {
            arms[1].rotation.z = Math.max(-0.6, arms[1].rotation.z - dt * 14);
            if (this.t <= 0) {
                this.state = 'idle';
                this.cd = 2.5;
            }
        }
        const walk = this.state === 'idle' ? Math.sin(t * 6) * 0.3 : 0;
        this.body.legs[0].rotation.x = walk;
        this.body.legs[1].rotation.x = -walk;
        arms[0].rotation.z = -walk * 0.5;
        this.root.position.copy(this.pos);
    }
}

// ---------------------------------------------------------------- トラック

function truckSign() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#e0524a';
    g.font = '800 64px "M PLUS Rounded 1c", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('デブネコ急便', 256, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export class Truck {
    constructor(scene, lanes) {
        this.scene = scene;
        this.lanes = lanes;
        this.active = false;
        this.timer = 6;
        this.speed = 0;
        this.root = new THREE.Group();
        const cab = part(new THREE.BoxGeometry(1.4, 1.6, 1.9), mat(0x7cc6f0), 0.02);
        cab.position.set(1.8, 1.25, 0);
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 1.6), new THREE.MeshBasicMaterial({ color: 0x2a3d52 }));
        win.position.set(2.52, 1.6, 0);
        const cargo = part(new THREE.BoxGeometry(3.4, 2.2, 2.0), mat(0xffffff), 0.02);
        cargo.position.set(-0.6, 1.55, 0);
        const sm = new THREE.MeshBasicMaterial({ map: truckSign() });
        [-1, 1].forEach(s => {
            const p = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.75), sm);
            p.position.set(-0.6, 1.6, s * 1.01);
            if (s < 0) p.rotation.y = Math.PI;
            this.root.add(p);
        });
        [[1.8, 1], [1.8, -1], [-1.5, 1], [-1.5, -1], [-0.6, 1], [-0.6, -1]].forEach(([x, s]) => {
            const w = part(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16).rotateX(Math.PI / 2), mat(0x222222), 0.01);
            w.position.set(x, 0.4, s * 0.85);
            this.root.add(w);
        });
        this.root.add(cab, win, cargo);
        this.root.visible = false;
        scene.add(this.root);
        refreshOutlines(this.root);
        this.pos = new THREE.Vector3();
    }

    update(dt, game) {
        if (!this.active) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.active = true;
                this.dir = Math.random() < 0.5 ? 1 : -1;
                this.pos.set(this.dir > 0 ? -14 : 78, 0, this.dir > 0 ? this.lanes[1] : this.lanes[0]);
                this.speed = 8;
                this.honked = false;
                this.root.visible = true;
                this.root.rotation.y = this.dir > 0 ? 0 : Math.PI;
            }
            return;
        }
        const c = game.cat;
        const ahead = (c.pos.x - this.pos.x) * this.dir;
        const inLane = game.state === 'play' && Math.abs(c.pos.z - this.pos.z) < 1.0 + c.r && c.pos.y < 2.8;
        // 大きすぎる猫の前では止まる
        const blocked = inLane && c.w >= 60 && ahead > 0 && ahead < 3.2 + c.r;
        this.speed = blocked ? Math.max(0, this.speed - dt * 30) : Math.min(8, this.speed + dt * 4);
        if (inLane && ahead > 0 && ahead < 14 && !this.honked) {
            this.honked = true;
            game.sfx('horn');
            game.hud.floatText(this.pos.clone().setY(3), 'プップー!!', '#ffd166', 26);
        }
        if (blocked && (this.stopMsg || 0) < game.time) {
            this.stopMsg = game.time + 3;
            game.hud.floatText(this.pos.clone().setY(3), 'キキーッ!! …猫がでかすぎる', '#ffffff', 22, 1.6);
            game.sayOnce('truckStop', ['トラックが負けた', '重量級の勝利']);
        }
        this.pos.x += this.dir * this.speed * dt;
        if (game.state === 'play' && inLane && Math.abs(c.pos.x - this.pos.x) < 2.55 + c.r && this.speed > 1) game.truckHit(this);
        this.root.position.copy(this.pos);
        if ((this.dir > 0 && this.pos.x > 80) || (this.dir < 0 && this.pos.x < -16)) {
            this.active = false;
            this.root.visible = false;
            this.timer = 10 + Math.random() * 12;
        }
    }
}
