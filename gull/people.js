// 浜辺の人間（観光客・屋台の人・シートの人・魚市場の人・釣り人）とトンビ
import * as THREE from 'three';
import { toon, addOutline, refreshOutlines } from './toon.js';
import { part } from './items.js';

const mats = {};
const mat = c => mats[c] || (mats[c] = toon(c));
const S = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);

const SHIRTS = [0xf28bb0, 0x5cc0e8, 0xf6d04a, 0x8fd46b, 0xffffff, 0xe0524a, 0x9b7bc4, 0xffa94d];
const PANTS = [0x3b4a6b, 0x2e2a30, 0x7fb2d9, 0xd9c7a0, 0x5a7d4a];
const HAIRS = [0x2a2020, 0x5a3a22, 0xd9a45a, 0x2a2020, 0x8a5a2c];

function person(opt) {
    const g = new THREE.Group();
    const skin = mat(opt.skin || 0xffd9b8);
    const legs = [-1, 1].map(s => {
        const pivot = new THREE.Group();
        pivot.position.set(0, 0.78, s * 0.11);
        const leg = part(new THREE.CapsuleGeometry(0.075, 0.58, 4, 8), mat(opt.pants), 0.012);
        leg.position.y = -0.38;
        pivot.add(leg);
        g.add(pivot);
        return pivot;
    });
    const torso = part(new THREE.CapsuleGeometry(0.2, 0.42, 4, 12), mat(opt.shirt), 0.014);
    torso.position.y = 1.08;
    g.add(torso);
    if (opt.apron) {
        const apron = part(new THREE.BoxGeometry(0.06, 0.7, 0.34), mat(opt.apron), 0.008);
        apron.position.set(0.19, 0.9, 0);
        g.add(apron);
    }
    const head = new THREE.Group();
    head.position.y = 1.52;
    g.add(head);
    head.add(part(S(0.16, 16, 12), skin, 0.012));
    const hair = part(S(0.165, 16, 12).scale(1, 0.75, 1), mat(opt.hair), 0.01);
    hair.position.set(-0.03, 0.05, 0);
    head.add(hair);
    if (opt.hat) {
        const hat = part(new THREE.CylinderGeometry(0.1, 0.3, 0.12, 16), mat(opt.hat), 0.01);
        hat.position.y = 0.14;
        head.add(hat);
    }
    if (opt.band) {
        const band = part(new THREE.TorusGeometry(0.16, 0.025, 6, 20).rotateX(Math.PI / 2), mat(opt.band), 0);
        band.position.y = 0.06;
        head.add(band);
    }
    [-1, 1].forEach(s => {
        const eye = new THREE.Mesh(S(0.02, 6, 5), new THREE.MeshBasicMaterial({ color: 0x2a2020 }));
        eye.position.set(0.15, 0.01, s * 0.06);
        head.add(eye);
    });
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.05), new THREE.MeshBasicMaterial({ color: 0x8a3030 }));
    mouth.position.set(0.155, -0.07, 0);
    head.add(mouth);
    const arms = [-1, 1].map(s => {
        const pivot = new THREE.Group();
        pivot.position.set(0, 1.3, s * 0.27);
        const arm = part(new THREE.CapsuleGeometry(0.06, 0.45, 4, 8), mat(opt.shirt), 0.01);
        arm.position.y = -0.25;
        const hand = new THREE.Group();
        hand.position.y = -0.52;
        pivot.add(arm, hand);
        g.add(pivot);
        return { pivot, hand };
    });
    return { g, legs, arms, torso, head, mouth };
}

const pickFrom = (list, i) => list[i % list.length];

export class Human {
    // role: walker / vendor / sitter / guard / fisherman
    constructor(scene, role, def, i) {
        this.scene = scene;
        this.role = role;
        this.def = def;
        this.pos = new THREE.Vector3(def.x !== undefined ? def.x : (def.x0 + def.x1) / 2, def.deck || def.seatY || 0, def.z);
        this.base = this.pos.y;
        this.dir = i % 2 ? 1 : -1;
        this.heading = role === 'vendor' ? Math.PI / 2 : this.dir > 0 ? 0 : Math.PI;
        this.angry = role === 'guard' ? 1e9 : 0;
        this.swatCd = 0;
        this.swat = 0;
        this.held = null;
        this.t = Math.random() * 10;
        const opt = {
            shirt: pickFrom(SHIRTS, i * 3 + 1), pants: pickFrom(PANTS, i), hair: pickFrom(HAIRS, i * 2),
            hat: i % 4 === 0 ? 0xf3e0a0 : null
        };
        if (role === 'vendor') Object.assign(opt, { shirt: 0xffffff, apron: 0xe0524a, band: 0xffffff, hat: null });
        if (role === 'guard') Object.assign(opt, { shirt: 0x2f6fb0, apron: 0xffffff, band: 0xffffff, pants: 0x2e2a30, hat: null });
        if (role === 'fisherman') Object.assign(opt, { shirt: 0x5a7d4a, hat: 0xd9c7a0 });
        this.body = person(opt);
        this.root = this.body.g;
        if (role === 'sitter') {
            // 座っている: 脚を前に投げ出す
            this.body.legs.forEach(l => { l.rotation.z = Math.PI / 2; });
            this.root.children.forEach(o => { if (!this.body.legs.includes(o)) o.position.y -= 0.72; });
            this.body.legs.forEach(l => { l.position.y = 0.08; });
            this.heading = Math.PI / 2;
        }
        if (role === 'fisherman') {
            // 釣りざお
            const rod = part(new THREE.CylinderGeometry(0.01, 0.015, 2.6, 6), mat(0x3b2f2a), 0.004);
            rod.position.set(0, -1.2, 0);
            this.body.arms[1].hand.add(rod);
            this.body.arms[1].pivot.rotation.z = 1.9;
            this.heading = Math.PI / 2;
        }
        this.root.position.copy(this.pos);
        scene.add(this.root);
        refreshOutlines(this.root);
    }

    // 食べ物を手に持たせる（前に差し出した手）
    hold(food) {
        this.held = food;
        food.attach(this.body.arms[1].hand, 'held', this);
        food.mesh.position.set(0.06, -0.02, 0);
    }

    // 盗まれた・落とした
    lose(game, text) {
        this.held = null;
        this.upset(game, text);
    }

    upset(game, text) {
        if (this.role !== 'guard') this.angry = 7;
        this.swatCd = Math.min(this.swatCd, 0.4);
        if (text) game.hud.floatText(this.headPos(), text, '#ff4d6d', 22, 1.4);
        game.sfx('shout');
    }

    headPos() {
        return this.pos.clone().setY(this.pos.y + (this.role === 'sitter' ? 1.2 : 1.95));
    }

    update(dt, game) {
        this.t += dt;
        this.angry -= dt;
        this.swatCd -= dt;
        this.swat = Math.max(0, this.swat - dt * 4);
        const b = game.bird;
        const toBird = new THREE.Vector3(b.pos.x - this.pos.x, 0, b.pos.z - this.pos.z);
        const d = toBird.length();
        const dy = b.pos.y - this.pos.y;
        const angry = this.angry > 0;
        let walking = false;

        if (this.role === 'walker' && !angry) {
            this.pos.x += this.dir * 1.1 * dt;
            if (this.pos.x > this.def.x1) this.dir = -1;
            if (this.pos.x < this.def.x0) this.dir = 1;
            this.heading = this.dir > 0 ? 0 : Math.PI;
            walking = true;
        } else if (this.role === 'guard') {
            if (d < 6 && dy < 4) this.heading = Math.atan2(toBird.z, toBird.x);
            else {
                this.pos.x += this.dir * 0.8 * dt;
                if (this.pos.x > this.def.x1) this.dir = -1;
                if (this.pos.x < this.def.x0) this.dir = 1;
                this.heading = this.dir > 0 ? 0 : Math.PI;
                walking = true;
            }
        }
        if (angry && this.role !== 'guard' && d < 10) this.heading = Math.atan2(toBird.z, toBird.x);

        // 近くを飛ぶカモメをはたく
        const reach = this.role === 'sitter' ? 1.3 : 1.5;
        const top = this.role === 'sitter' ? 1.9 : 2.7;
        if (angry && this.swatCd <= 0 && d < reach + b.radius && dy > -0.3 && dy < top) {
            this.swatCd = this.role === 'guard' ? 0.9 : 1.3;
            this.swat = 1;
            game.swatHit(this);
        }

        const body = this.body;
        const k = walking ? Math.sin(this.t * 7) * 0.45 : 0;
        if (this.role !== 'sitter') {
            body.legs[0].rotation.z = k;
            body.legs[1].rotation.z = -k;
        }
        // 腕: 食べ物を持つ・怒って振り上げる・はたく
        const [left, right] = body.arms;
        if (this.swat > 0) right.pivot.rotation.z = 2.6 - (1 - this.swat) * 3.2;
        else if (this.role === 'fisherman') right.pivot.rotation.z = 1.9 + Math.sin(this.t) * 0.05;
        else if (angry) right.pivot.rotation.z = 2.4 + Math.sin(this.t * 14) * 0.3;
        else if (this.held) right.pivot.rotation.z = 1.0;
        else right.pivot.rotation.z = -k * 0.6;
        right.hand.rotation.z = -right.pivot.rotation.z; // 持っている物をまっすぐに保つ
        left.pivot.rotation.z = angry ? 2.2 + Math.sin(this.t * 12) * 0.3 : k * 0.6;
        body.head.rotation.z = angry && dy > 1 ? 0.5 : 0;
        body.mouth.scale.y = angry ? 3 : 1;
        this.root.position.copy(this.pos);
        this.root.rotation.y = -this.heading;
        this.root.visible = game.near(this.pos, 90);
    }
}

// ---------------------------------------------------------------- トンビ

export class Kite {
    constructor(scene, center) {
        this.scene = scene;
        this.center = center.clone();
        this.pos = center.clone().add(new THREE.Vector3(14, 0, 0));
        this.vel = new THREE.Vector3(0, 0, 10);
        this.state = 'circle';
        this.t = 0;
        this.cd = 8 + Math.random() * 6;
        this.angle = Math.random() * Math.PI * 2;
        this.loot = null;
        this.root = new THREE.Group();
        const brown = mat(0x7a5232), light = mat(0xc49a6c);
        const body = part(S(0.2).scale(1.8, 0.8, 0.8), brown, 0.015);
        const head = part(S(0.13), light, 0.012);
        head.position.set(0.35, 0.05, 0);
        const beak = part(new THREE.ConeGeometry(0.04, 0.12, 8).rotateZ(-Math.PI / 2), mat(0x3b2f2a), 0.006);
        beak.position.set(0.5, 0.02, 0);
        const tail = part(new THREE.BoxGeometry(0.35, 0.03, 0.3), brown, 0.01);
        tail.position.set(-0.5, 0, 0);
        [-1, 1].forEach(s => {
            const eye = new THREE.Mesh(S(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd23d }));
            eye.position.set(0.44, 0.08, s * 0.07);
            const pupil = new THREE.Mesh(S(0.016, 6, 5), new THREE.MeshBasicMaterial({ color: 0x111111 }));
            pupil.position.set(0.465, 0.08, s * 0.085);
            this.root.add(eye, pupil);
        });
        this.wings = [-1, 1].map(s => {
            const pivot = new THREE.Group();
            pivot.position.set(0, 0.05, s * 0.12);
            const wing = part(S(1, 12, 8).scale(0.3, 0.03, 0.75), brown, 0.012);
            wing.position.set(-0.05, 0, s * 0.72);
            pivot.add(wing);
            this.root.add(pivot);
            return { pivot, s };
        });
        this.talons = new THREE.Group();
        this.talons.position.set(0, -0.25, 0);
        this.root.add(body, head, beak, tail, this.talons);
        this.root.scale.setScalar(1.3);
        scene.add(this.root);
        refreshOutlines(this.root);
    }

    // カモメが獲物をくわえていたら狙う
    update(dt, game) {
        this.t += dt;
        this.cd -= dt;
        const b = game.bird;
        const toBird = new THREE.Vector3().subVectors(b.pos, this.pos);
        const d = toBird.length();
        let want = new THREE.Vector3();
        let speed = 9;
        if (this.state === 'circle') {
            this.angle += dt * 0.45;
            const target = this.center.clone().add(new THREE.Vector3(Math.cos(this.angle) * 16, Math.sin(this.t * 0.3) * 2, Math.sin(this.angle) * 16));
            want.subVectors(target, this.pos);
            if (this.cd <= 0 && b.carry && d < 50 && game.state === 'play') {
                this.state = 'chase';
                this.t = 0;
                game.sfx('kite');
                game.hud.floatText(this.pos.clone().setY(this.pos.y + 1), 'ピーヒョロロ', '#ffd166', 22, 1.5);
                game.onKiteChase(this);
            }
        } else if (this.state === 'chase') {
            speed = 14.5;
            // 少し先回りする
            want.copy(toBird).addScaledVector(b.vel, Math.min(0.6, d / 20));
            if (!b.carry || this.t > 10 || game.state !== 'play') {
                this.state = 'circle';
                this.cd = 10 + Math.random() * 6;
            } else if (d < 1.1 + b.radius) {
                game.kiteSteal(this);
            }
        } else if (this.state === 'flee') {
            speed = 12;
            want.set(this.pos.x - b.pos.x, 3, this.pos.z - b.pos.z);
            if (this.t > 5) {
                if (this.loot) {
                    this.loot.remove();
                    this.loot = null;
                }
                this.state = 'circle';
                this.cd = 12;
            }
        }
        // 向きをなめらかに変えて飛ぶ
        if (want.lengthSq() > 0.01) want.normalize().multiplyScalar(speed);
        this.vel.lerp(want, Math.min(1, dt * (this.state === 'chase' ? 1.6 : 1.0)));
        this.pos.addScaledVector(this.vel, dt);
        this.pos.y = Math.max(2, this.pos.y);
        const heading = Math.atan2(this.vel.z, this.vel.x);
        const pitch = Math.atan2(this.vel.y, Math.hypot(this.vel.x, this.vel.z));
        this.root.position.copy(this.pos);
        this.root.rotation.set(0, -heading, pitch, 'YZX');
        const flap = this.state === 'circle' ? Math.sin(this.t * 2) * 0.15 : Math.sin(this.t * 14) * 0.7;
        this.wings.forEach(w => { w.pivot.rotation.x = -w.s * flap; });
    }

    grab(food) {
        this.loot = food;
        food.attach(this.talons, 'kite', this);
        this.state = 'flee';
        this.t = 0;
    }
}
