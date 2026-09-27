// ゲームの中身: 飛び方（左右の翼を別々に羽ばたく）・盗み・巣・フン・トンビ・人間・カメラ
import * as THREE from 'three';
import { CFG, FOODS, MISSIONS, RANKS, NARRATOR, Save } from './config.js';
import { SFX } from './audio.js';
import { WORLD } from './world.js';
import { Food } from './items.js';
import { Human, Kite } from './people.js';
import { toon } from './toon.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();

export class Game {
    constructor({ scene, camera, world, gull, hud }) {
        this.scene = scene;
        this.camera = camera;
        this.world = world;
        this.sp = world.sp;
        this.gull = gull;
        this.hud = hud;
        this.keys = {};
        this.state = 'idle';
        this.time = 0;
        this.fx = [];
        this.near_ = [];
        this.camPos = new THREE.Vector3(70, 15, 45);
        this.camLook = new THREE.Vector3();
        this.camYaw = 0;
        this.camPitch = 0;
        this.shake = 0;
        this.saidOnce = {};
        this.narration = null;

        // 人間
        this.humans = [];
        this.sp.vendors.forEach((v, i) => this.humans.push(new Human(scene, 'vendor', v, i)));
        this.sp.walkers.forEach((v, i) => this.humans.push(new Human(scene, 'walker', v, i + 3)));
        this.sp.towels.forEach((t, i) => {
            const h = new Human(scene, 'sitter', { x: t.x + 0.9, z: t.z - 0.1, seatY: t.seatY || 0 }, i + 7);
            t.sitter = h;
            this.humans.push(h);
        });
        this.sp.guards.forEach((g, i) => this.humans.push(new Human(scene, 'guard', g, i)));
        this.sp.fishermen.forEach((f, i) => {
            const h = new Human(scene, 'fisherman', { x: f.x, z: f.z, deck: 1.5 }, i + 2);
            this.humans.push(h);
            this.sp.counters.push({ type: 'fish', x: f.x - 0.7, y: 1.5, z: f.z - 0.4, owner: h });
        });
        this.kites = this.sp.kites.map(c => new Kite(scene, c));
        // 巣の目印（くわえているときだけ光の柱）
        this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 60, 16, 1, true),
            new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
        this.beacon.position.set(this.sp.nest.x, this.sp.nest.y + 30, this.sp.nest.z);
        scene.add(this.beacon);
        this.foods = [];
        this.bird = this.newBird();
    }

    newBird() {
        const s = this.sp.start;
        return {
            pos: s.pos.clone(), vel: s.vel.clone(), yaw: Math.atan2(s.vel.z, s.vel.x), pitch: 0, roll: 0, rollV: 0,
            mode: 'air', w: CFG.START_WEIGHT, stamina: 1, carry: null, stunT: 0, cd: [0, 0, 0], poopCd: 0,
            radius: 0.35, dive: false, tooHeavyT: 0, lastGrab: -99, walk: 0, waterFlaps: 0
        };
    }

    // ---------------------------------------------------------------- 1回のプレイ

    start() {
        this.clearFoods();
        this.bird = this.newBird();
        this.time = 0;
        this.left = CFG.RUN_TIME;
        this.yen = 0;
        this.stolen = 0;
        this.combo = 0;
        this.bestCombo = 0;
        this.newMissions = [];
        this.milestones = {};
        this.saidOnce = {};
        this.state = 'play';
        this.camYaw = this.camPitch = 0;
        // 屋台・シート・釣り人の食べ物を置き直す
        this.sp.counters.forEach(c => { c.food = null; c.timer = 0; this.placeCounter(c); });
        this.sp.towels.forEach(t => {
            t.foods = t.items.map((type, i) => {
                const f = new Food(this.scene, type, { x: t.x - 0.4 + i * 0.6, y: (t.seatY || 0) + 0.03, z: t.z + 0.2 });
                f.towel = t;
                this.foods.push(f);
                return f;
            });
            t.timer = 0;
        });
        this.humans.forEach(h => {
            h.angry = h.role === 'guard' ? 1e9 : 0;
            if (h.held) h.held.remove();
            h.held = null;
            if (h.role === 'walker' && h.def.hold) this.giveFood(h, h.def.hold);
            h.refill = 0;
        });
        this.kites.forEach(k => { k.state = 'circle'; k.cd = 12 + Math.random() * 8; if (k.loot) { k.loot.remove(); k.loot = null; } });
        this.hud.startRun();
        this.say(NARRATOR.pick(NARRATOR.start));
        SFX.play('gull');
        this.placeCameraNow();
    }

    clearFoods() {
        this.foods.forEach(f => f.remove());
        this.foods = [];
        this.humans.forEach(h => { h.held = null; });
    }

    placeCounter(c) {
        const f = new Food(this.scene, c.type, c);
        f.counter = c;
        c.food = f;
        this.foods.push(f);
    }

    giveFood(h, type) {
        const f = new Food(this.scene, type, null);
        h.hold(f);
        this.foods.push(f);
    }

    // ---------------------------------------------------------------- 地形

    // (x, z) の足場の高さ。海なら water: true
    groundInfo(x, z, y) {
        let h = z > WORLD.sea ? -Infinity : 0;
        let box = null;
        for (const c of this.world.grid.query(x, z, x, z, this.near_)) {
            if (x < c.min.x || x > c.max.x || z < c.min.z || z > c.max.z) continue;
            if (c.max.y <= y + 0.35 && c.max.y > h) {
                h = c.max.y;
                box = c;
            }
        }
        if (h === -Infinity) return { h: 0, water: true, box: null };
        return { h, water: false, box };
    }

    groundAt = (x, z, y) => {
        const g = this.groundInfo(x, z, y);
        return g.water ? -0.01 : g.h;
    };

    near(p, dist) {
        return Math.hypot(p.x - this.camera.position.x, p.z - this.camera.position.z) < dist;
    }

    // ---------------------------------------------------------------- 更新

    update(dt) {
        if (this.state === 'idle') return;
        this.time += dt;
        if (this.state === 'play') {
            this.left -= dt;
            if (this.left <= 10 && Math.ceil(this.left) !== Math.ceil(this.left + dt)) SFX.play('tick');
            if (this.left <= 0) {
                this.left = 0;
                this.endRun('time');
            }
        }
        const b = this.bird;
        if (this.state === 'play') {
            this.updateBird(dt);
            this.checkGrab();
            this.checkNest();
        } else {
            b.vel.multiplyScalar(1 - dt);
        }
        this.updateWorld(dt);
        this.updateFx(dt);
        this.syncGull(dt);
        this.updateCamera(dt);
        SFX.setWind(this.state === 'play' && b.mode === 'air' ? b.vel.length() : 0);
        this.hud.update(this, dt);
    }

    mass() {
        const b = this.bird;
        return b.w + (b.carry ? b.carry.def.kg : 0);
    }

    fwd(out = new THREE.Vector3()) {
        const b = this.bird;
        return out.set(Math.cos(b.pitch) * Math.cos(b.yaw), Math.sin(b.pitch), Math.cos(b.pitch) * Math.sin(b.yaw));
    }

    // 羽ばたき（0: 左の翼, 1: 右の翼, 2: 両方）
    flap(i) {
        const b = this.bird;
        if (this.state !== 'play' || b.mode === 'stun') return;
        if ((b.mode === 'ground' || b.mode === 'water') && i !== 2) return; // 地上では A/D は向きを変えるだけ
        if (b.cd[i] > 0) return;
        b.cd[i] = i === 2 ? 0.32 : 0.22;
        if (i === 2) b.cd[0] = b.cd[1] = 0.2;
        const m = this.mass();
        const tired = b.stamina < 0.08;
        const cost = (i === 2 ? 0.1 : 0.055) * Math.sqrt(m);
        b.stamina = Math.max(0, b.stamina - cost);
        b.restT = 0.35;
        let p = CFG.flapPower(m) * (tired ? (b.mode === 'air' ? 0.3 : 0.8) : 1) * (i === 2 ? 1 : 0.6);
        if (i === 2) { this.gull.flap(0); this.gull.flap(1); } else this.gull.flap(i);
        SFX.play('flap', i === 2 ? 1 : 0);
        if (tired) this.hud.floatText(this.bird.pos.clone().setY(b.pos.y + 0.8), 'ゼェ…', '#ffffff', 18, 0.8);
        if (b.mode === 'ground') {
            // 地上から飛び立つ
            const f = this.fwd(tmp).setY(0).normalize();
            b.vel.set(f.x * p * 0.6, p * 0.9, f.z * p * 0.6);
            b.mode = 'air';
            b.pitch = 0.3;
            if (p < 2.2) this.sayOnce('heavyTakeoff', NARRATOR.heavy);
                        return;
        }
        if (b.mode === 'water') {
            // 水面からは何回か羽ばたかないと上がれない
            b.waterFlaps += p;
            b.vel.y = 0;
            if (b.waterFlaps > 9) {
                b.mode = 'air';
                b.vel.y = p * 0.8;
                b.waterFlaps = 0;
                const f = this.fwd(tmp).setY(0).normalize();
                b.vel.x += f.x * 3;
                b.vel.z += f.z * 3;
                SFX.play('splash');
            } else {
                this.hud.floatText(b.pos.clone().setY(b.pos.y + 0.6), 'バシャ', '#bfe8ff', 16, 0.6);
            }
            return;
        }
        // 空中: 体を持ち上げて前に進む。片方だけだと反対側に傾く
        const up = tmp.set(0, Math.cos(b.roll), 0);
        b.vel.addScaledVector(up, p * 0.75);
        b.vel.addScaledVector(this.fwd(new THREE.Vector3()), p * 0.55);
        if (i === 0) b.rollV += 2.0;
        if (i === 1) b.rollV -= 2.0;
    }

    updateBird(dt) {
        const b = this.bird;
        const k = this.keys;
        b.cd = b.cd.map(c => c - dt);
        b.poopCd -= dt;
        b.restT = (b.restT || 0) - dt;
        if (b.restT <= 0) b.stamina = Math.min(1, b.stamina + dt * (b.mode === 'air' ? 0.4 : 0.7));
        if (k.ArrowLeft) this.camYaw -= dt * 2;
        if (k.ArrowRight) this.camYaw += dt * 2;
        if (k.ArrowUp) this.camPitch = Math.max(-0.6, this.camPitch - dt * 1.2);
        if (k.ArrowDown) this.camPitch = Math.min(0.9, this.camPitch + dt * 1.2);
        if (!k.ArrowLeft && !k.ArrowRight && !this.mouseLook) this.camYaw *= 1 - Math.min(1, dt * 1.5);
        const m = this.mass();
        const s = b.vel.length();

        if (b.mode === 'stun') {
            b.stunT -= dt;
            b.vel.y -= CFG.GRAVITY * dt;
            b.vel.x *= 1 - dt;
            b.vel.z *= 1 - dt;
            b.roll += dt * 12;
            this.integrate(dt, false);
            if (b.stunT <= 0) {
                b.roll = 0;
                b.rollV = 0;
                b.pitch = 0;
                b.mode = this.onFloor() ? 'ground' : 'air';
            }
            return;
        }

        if (b.mode === 'air') {
            b.dive = !!(k.ShiftLeft || k.ShiftRight);
            // 機首の上げ下げ
            if (k.KeyW) b.pitch -= dt * 1.5;
            if (k.KeyS) b.pitch += dt * 1.5;
            if (!k.KeyW && !k.KeyS) b.pitch += (0 - b.pitch) * Math.min(1, dt * 0.8);
            if (s < 5) b.pitch -= dt * (5 - s) * 0.35; // 失速すると頭が下がる
            b.pitch = Math.max(-1.35, Math.min(0.85, b.pitch));
            // 傾き（羽ばたきで傾き、ゆっくり水平に戻る）
            b.rollV *= 1 - Math.min(1, dt * 3);
            b.roll += b.rollV * dt;
            b.roll -= b.roll * Math.min(1, dt * 0.7);
            b.roll = Math.max(-1.35, Math.min(1.35, b.roll));
            // 傾いた方向に曲がる
            b.yaw += Math.sin(b.roll) * 2.1 * Math.min(1, s / 8) * dt;
            // 速度の向きを体の向きに寄せる（翼が空気をつかむ）
            const f = this.fwd();
            if (s > 0.1) {
                const dir = b.vel.clone().divideScalar(s);
                dir.lerp(f, Math.min(1, dt * 2.2 * Math.min(1, s / 6))).normalize();
                b.vel.copy(dir).multiplyScalar(s);
            }
            // 揚力・重力・空気抵抗
            const lift = Math.min(15, 0.075 * s * s) * Math.max(0, Math.cos(b.roll)) * (b.dive ? 0.2 : 1) / Math.pow(m, 0.35);
            b.vel.y += (lift - CFG.GRAVITY) * dt;
            const drag = (b.dive ? 0.009 : 0.02) * s * s + 0.2;
            if (s > 0.1) b.vel.addScaledVector(b.vel, -Math.min(0.5, drag / s * dt));
            this.aimAssist(dt, s);
            // 上昇気流
            for (const u of this.sp.updrafts) {
                const d = Math.hypot(b.pos.x - u.x, b.pos.z - u.z);
                if (d < u.r && b.pos.y < u.top) {
                    b.vel.y += u.power * (1 - d / u.r * 0.5) * Math.min(1, (u.top - b.pos.y) / 3) * dt;
                    if (!b.inDraft) {
                        b.inDraft = true;
                        this.hud.floatText(b.pos.clone().setY(b.pos.y + 0.8), '上昇気流!', '#bfe8ff', 22);
                        this.sayOnce('draft', ['上昇気流に乗った', '羽ばたかなくても上がれる']);
                    }
                    b.stamina = Math.min(1, b.stamina + dt * 0.3);
                    break;
                }
                b.inDraft = false;
            }
            if (b.w >= 3 && s > 5) this.mission('heavy');
            if (s > 24) this.sayOnce('fast', ['速い', '猛禽類の目つき', 'カモメの限界速度']);
            this.integrate(dt, true);
        } else if (b.mode === 'ground') {
            // よちよち歩き: W/S で前後、A/D で向きを変える、スペースで飛び立つ
            b.roll = 0;
            b.pitch = 0;
            let walk = 0;
            if (k.KeyW) walk = 1.4;
            if (k.KeyS) walk = -0.8;
            walk /= Math.sqrt(b.w);
            if (k.KeyA) b.yaw -= dt * 2.5;
            if (k.KeyD) b.yaw += dt * 2.5;
            // 歩いているときはカメラの向きに体を向ける
            if (walk && Math.abs(this.camYaw) > 0.05) {
                b.yaw += this.camYaw * Math.min(1, dt * 3);
                this.camYaw *= 1 - Math.min(1, dt * 3);
            }
            b.walk = walk;
            b.vel.set(Math.cos(b.yaw) * walk, b.vel.y - CFG.GRAVITY * dt, Math.sin(b.yaw) * walk);
            this.integrate(dt, false);
        } else if (b.mode === 'water') {
            b.roll = 0;
            b.pitch = 0;
            let swim = k.KeyW ? 0.9 : 0;
            if (k.KeyA) b.yaw -= dt * 2;
            if (k.KeyD) b.yaw += dt * 2;
            if (swim && Math.abs(this.camYaw) > 0.05) {
                b.yaw += this.camYaw * Math.min(1, dt * 3);
                this.camYaw *= 1 - Math.min(1, dt * 3);
            }
            b.waterFlaps = Math.max(0, b.waterFlaps - dt * 4);
            b.vel.set(Math.cos(b.yaw) * swim, 0, Math.sin(b.yaw) * swim);
            b.pos.addScaledVector(b.vel, dt);
            b.pos.y = this.gull.legHeight(b.w) * 0.3 + Math.sin(this.time * 2) * 0.03;
            const g = this.groundInfo(b.pos.x, b.pos.z, 1);
            if (!g.water) b.mode = 'ground';
            if (b.w >= 3.6) {
                b.sinkT = (b.sinkT || 0) + dt;
                if (b.sinkT > 1) this.sayOnce('sink', ['重すぎて水面から上がれない', '泳いで岸まで戻れ']);
            }
        }
        this.clampWorld();
    }

    onFloor() {
        const b = this.bird;
        const g = this.groundInfo(b.pos.x, b.pos.z, b.pos.y);
        return b.pos.y - this.gull.legHeight(b.w) <= g.h + 0.05;
    }

    // 位置を進めて、建物・地面・海との当たりを処理する
    integrate(dt, flying) {
        const b = this.bird;
        const steps = Math.max(1, Math.ceil(b.vel.length() * dt / 0.15));
        const legH = this.gull.legHeight(b.w);
        const r = b.radius * CFG.scale(b.w);
        for (let i = 0; i < steps; i++) {
            b.pos.addScaledVector(b.vel, dt / steps);
            // 足場
            const g = this.groundInfo(b.pos.x, b.pos.z, b.pos.y - legH);
            if (b.pos.y - legH <= g.h) {
                const vy = b.vel.y;
                const s = b.vel.length();
                b.pos.y = g.h + legH;
                if (g.water) {
                    if (b.mode === 'air' || b.mode === 'stun') this.touchWater(s);
                    return;
                }
                if (g.box && g.box.bouncy && vy < -1) {
                    b.vel.y = 7;
                    SFX.play('flap', 1);
                    this.hud.floatText(b.pos.clone().setY(b.pos.y + 0.6), 'ボヨン', '#ffffff', 22);
                    continue;
                }
                if (b.mode === 'air') {
                    if (s > 11 || vy < -7) this.crash('ベチャッ!!', s);
                    else this.land();
                } else if (b.mode === 'stun' || b.mode === 'ground') {
                    b.vel.y = 0;
                }
                if (b.mode !== 'air') return;
            }
            // 壁（足場として乗れない高さの箱）
            for (const c of this.world.grid.query(b.pos.x - r, b.pos.z - r, b.pos.x + r, b.pos.z + r, this.near_)) {
                if (b.pos.x + r < c.min.x || b.pos.x - r > c.max.x || b.pos.z + r < c.min.z || b.pos.z - r > c.max.z) continue;
                if (b.pos.y + r * 0.6 < c.min.y || b.pos.y - legH > c.max.y - 0.001) continue;
                // 一番浅い方向に押し出す
                const pens = [
                    [c.max.x - (b.pos.x - r), 1, 0, 0], [(b.pos.x + r) - c.min.x, -1, 0, 0],
                    [c.max.z - (b.pos.z - r), 0, 0, 1], [(b.pos.z + r) - c.min.z, 0, 0, -1],
                    [c.max.y - (b.pos.y - legH), 0, 1, 0], [(b.pos.y + r * 0.6) - c.min.y, 0, -1, 0]
                ].sort((a, bb) => a[0] - bb[0]);
                const [d, nx, ny, nz] = pens[0];
                b.pos.x += nx * d;
                b.pos.y += ny * d;
                b.pos.z += nz * d;
                const n = new THREE.Vector3(nx, ny, nz);
                const vn = b.vel.dot(n);
                if (vn < 0) {
                    if (c.bouncy) {
                        b.vel.addScaledVector(n, -vn * 1.8);
                        this.hud.floatText(b.pos.clone().setY(b.pos.y + 0.6), 'ボヨン', '#ffffff', 22);
                    } else if (flying && -vn > 7 && ny === 0) {
                        this.crash(c.thin ? 'ゴンッ!!' : 'ドゴッ!!', -vn);
                        b.vel.addScaledVector(n, -vn * 1.3);
                        return;
                    } else {
                        b.vel.addScaledVector(n, -vn);
                        if (ny === 1 && b.mode === 'air' && b.vel.length() < 11) this.land();
                    }
                }
            }
        }
        // 足場から歩いて落ちたら飛ぶ
        if (b.mode === 'ground') {
            const g = this.groundInfo(b.pos.x, b.pos.z, b.pos.y - legH);
            if (b.pos.y - legH > g.h + 0.3) {
                b.mode = 'air';
                b.vel.y = 0;
            }
        }
    }

    clampWorld() {
        const b = this.bird;
        const soft = 6;
        // 町の外に出そうになったら押し戻す風
        if (b.pos.x < WORLD.x0 + soft) b.vel.x += 8 * (1 / 60);
        if (b.pos.x > WORLD.x1 - soft) b.vel.x -= 8 * (1 / 60);
        if (b.pos.z > WORLD.z1 - soft) b.vel.z -= 8 * (1 / 60);
        if (b.pos.z < WORLD.z0 + soft) b.vel.z += 8 * (1 / 60);
        b.pos.x = Math.max(WORLD.x0, Math.min(WORLD.x1, b.pos.x));
        b.pos.z = Math.max(WORLD.z0, Math.min(WORLD.z1, b.pos.z));
        if (b.pos.y > WORLD.top) {
            b.pos.y = WORLD.top;
            b.vel.y = Math.min(0, b.vel.y);
            this.sayOnce('top', ['空が高すぎる', 'それ以上は宇宙']);
        }
    }

    land() {
        const b = this.bird;
        b.mode = 'ground';
        b.vel.set(0, 0, 0);
        b.roll = b.rollV = 0;
        b.pitch = 0;
        SFX.play('flap');
    }

    touchWater(s) {
        const b = this.bird;
        b.mode = 'water';
        b.vel.set(0, 0, 0);
        b.roll = b.rollV = 0;
        b.waterFlaps = 0;
        SFX.play('splash');
        if (s > 9) {
            this.hud.floatText(b.pos.clone().setY(1), 'ドボーン', '#bfe8ff', 26);
            this.splashFx(b.pos);
            this.shake = 0.15;
        }
        this.sayOnce('water', NARRATOR.water);
        if (b.carry && FOODS[b.carry.type].kg > 0.3 && s > 9) this.dropCarry(0, -1, 0);
    }

    crash(text, speed) {
        const b = this.bird;
        b.mode = 'stun';
        b.stunT = 1.1;
        SFX.play('crash');
        this.shake = Math.min(0.5, speed * 0.03);
        this.hud.floatText(b.pos.clone().setY(b.pos.y + 0.8), text, '#ff4d6d', 30);
        this.featherFx(b.pos);
        this.say(NARRATOR.pick(NARRATOR.crash));
        this.dropCarry(b.vel.x * 0.2, 2, b.vel.z * 0.2);
    }

    dropCarry(vx, vy, vz) {
        const b = this.bird;
        if (!b.carry) return;
        const f = b.carry;
        b.carry = null;
        f.drop(vx, vy, vz);
        this.hud.floatText(b.pos.clone().setY(b.pos.y + 1.2), `${f.def.name}を落とした`, '#ffffff', 20);
    }

    // ---------------------------------------------------------------- 盗む

    checkGrab() {
        const b = this.bird;
        if (b.mode === 'stun') return;
        const mouth = this.gull.mouth.getWorldPosition(new THREE.Vector3());
        // 速く飛んでいても通り過ぎないように、前のフレームからの線分で調べる
        const from = this.lastMouth && this.lastMouth.distanceTo(mouth) < 3 ? this.lastMouth : mouth;
        this.lastMouth = mouth.clone();
        const seg = new THREE.Line3(from.clone(), mouth.clone());
        const R = CFG.grabRadius(b.w);
        const p = new THREE.Vector3();
        const q = new THREE.Vector3();
        for (const f of this.foods) {
            if (!f.alive || f.state === 'carried' || f.state === 'kite') continue;
            f.worldPos(p);
            p.y += 0.08;
            if (seg.distanceSq() < 1e-8) q.copy(mouth); // 長さ 0 の線分は NaN になる
            else seg.closestPointToPoint(p, true, q);
            if (p.distanceTo(q) > R) continue;
            const def = f.def;
            if (def.big) {
                if (b.carry) continue;
                if (b.w < def.need) {
                    if ((f.heavyMsg || 0) < this.time) {
                        f.heavyMsg = this.time + 2;
                        this.hud.floatText(p.clone().setY(p.y + 0.6), `重くて持てない（${def.need}kg 必要）`, '#ffffff', 20, 1.4);
                        this.sayOnce('tooBig' + f.type, [`${def.name}を持つには太れ`, '体重が足りない']);
                    }
                    continue;
                }
                this.takeFrom(f);
                b.carry = f;
                f.attach(this.gull.mouth, 'carried');
                if (f.type === 'tuna') f.mesh.position.set(0.3, -0.25, 0);
                SFX.play('grab');
                this.hud.floatText(mouth.clone().setY(mouth.y + 0.6), `${def.name} ゲット! 巣へ運べ`, '#ffd166', 24, 1.6);
                if (f.type === 'tuna') this.say('本マグロを盗んだ。前代未聞');
                this.chain();
                continue;
            }
            // 小さい物はその場で食べる
            const wasHeld = f.state === 'held';
            this.takeFrom(f);
            f.remove();
            this.yen += def.yen;
            this.stolen++;
            SFX.play('gulp');
            SFX.play('cash');
            this.hud.floatText(mouth.clone().setY(mouth.y + 0.5), `${def.name} ¥${def.yen.toLocaleString()}`, '#ffd166', 24, 1.3);
            if (f.type === 'fries') this.mission('fries');
            if (f.type === 'icecream' && wasHeld && b.mode === 'air') this.mission('airIce');
            this.chain();
            this.setWeight(b.w + def.kg);
            if (this.state !== 'play') return;
        }
    }

    // 盗みの補助: 目の前の食べ物に少しだけ吸い寄せられる（速く飛んでいても取れるように）
    aimAssist(dt, s) {
        const b = this.bird;
        if (s < 3) return;
        const dir = b.vel.clone().divideScalar(s);
        const p = new THREE.Vector3();
        let best = null, bestD = 4.5;
        for (const f of this.foods) {
            if (!f.alive || (f.state !== 'placed' && f.state !== 'held')) continue;
            if (f.def.big && (b.carry || b.w < f.def.need)) continue;
            f.worldPos(p);
            const to = p.sub(b.pos);
            const d = to.length();
            if (d > bestD || d < 0.05) continue;
            if (to.dot(dir) / d < 0.55) continue;
            best = to.clone().divideScalar(d);
            bestD = d;
        }
        if (best) b.vel.addScaledVector(best, 9 * dt);
    }

    // 食べ物を持ち主から取り上げる（怒らせる・あとで補充する）
    takeFrom(f) {
        const name = f.def.name;
        if (f.state === 'held' && f.owner) {
            f.owner.lose(this, NARRATOR.pick([`あーっ! ${name}が!`, 'ちょっと!!', 'カモメー!!', `私の${name}!!`]));
            f.owner.refill = 20;
        }
        if (f.counter) {
            const c = f.counter;
            c.food = null;
            c.timer = c.respawn || 12;
            const v = c.owner || this.nearestHuman(c, ['vendor', 'guard', 'fisherman']);
            if (v) v.upset(this, NARRATOR.pick(['こらーっ!!', '売りもんだぞ!', 'ドロボー!']));
        }
        if (f.towel) {
            const t = f.towel;
            t.foods = t.foods.filter(x => x !== f);
            if (t.sitter) t.sitter.upset(this, NARRATOR.pick(['ぎゃー!', 'お弁当がー!', 'え、うそ!?']));
            t.timer = 25;
        }
        f.counter = null;
        f.towel = null;
        this.say(NARRATOR.pick(NARRATOR.steal));
    }

    nearestHuman(p, roles) {
        let best = null, bd = 8;
        this.humans.forEach(h => {
            if (!roles.includes(h.role)) return;
            const d = Math.hypot(h.pos.x - p.x, h.pos.z - p.z);
            if (d < bd) { bd = d; best = h; }
        });
        return best;
    }

    // 連続で盗む
    chain() {
        if (this.time - this.bird.lastGrab < 10) this.combo++;
        else this.combo = 1;
        this.bird.lastGrab = this.time;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        if (this.combo >= 2) this.hud.combo(this.combo);
        if (this.combo >= 5) this.mission('combo');
    }

    checkNest() {
        const b = this.bird;
        const n = this.sp.nest;
        const d = Math.hypot(b.pos.x - n.x, b.pos.z - n.z);
        if (d > 3.6 || b.pos.y < n.y - 1.5 || b.pos.y > n.y + 6) return; // 上を通るだけでも落とし込める
        if (b.mode === 'ground') b.stamina = Math.min(1, b.stamina + 0.02);
        if (!b.carry) return;
        const f = b.carry;
        b.carry = null;
        f.remove();
        const chased = this.kites.some(k => k.state === 'chase');
        const yen = Math.round(f.def.yen * (chased ? 1.5 : 1));
        this.yen += yen;
        this.stolen++;
        SFX.play('cash');
        SFX.play('gulp');
        SFX.play('gull', 0.9);
        this.hud.floatText(b.pos.clone().setY(b.pos.y + 1), `巣に持ち帰った! ${f.def.name} ¥${yen.toLocaleString()}${chased ? '（トンビ回避ボーナス）' : ''}`, '#ffd166', 26, 2);
        if (f.type === 'fish') this.mission('fish');
        if (f.type === 'tuna') this.mission('tuna');
        if (chased) this.mission('kite');
        this.setWeight(b.w + f.def.kg * 0.5);
    }

    setWeight(w) {
        const b = this.bird;
        b.w = Math.round(w * 100) / 100;
        if (b.w > Save.data.maxWeight) Save.data.maxWeight = b.w;
        if (this.yen >= 15000) this.mission('yen');
        NARRATOR.milestones.forEach(([kg, line]) => {
            if (b.w >= kg && !this.milestones[kg]) {
                this.milestones[kg] = true;
                this.say(line);
            }
        });
        if (b.w >= CFG.BURST_WEIGHT) this.endRun('burst');
    }

    // ---------------------------------------------------------------- フン

    poop() {
        const b = this.bird;
        if (this.state !== 'play' || b.poopCd > 0 || b.mode !== 'air') return;
        b.poopCd = 0.6;
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), toon(0xffffff));
        m.position.copy(b.pos).y -= 0.15;
        this.scene.add(m);
        const v = b.vel.clone().multiplyScalar(0.9);
        v.y -= 1;
        SFX.play('poop');
        this.setWeight(b.w - 0.03);
        this.fx.push({
            obj: m, t: 0, dur: 6, step: (k, dt, fx) => {
                if (fx.hit) return;
                v.y -= CFG.GRAVITY * dt;
                m.position.addScaledVector(v, dt);
                // 人の頭・手に当たった？
                for (const h of this.humans) {
                    const hp = h.headPos();
                    if (Math.hypot(hp.x - m.position.x, hp.z - m.position.z) < 0.55 && m.position.y < hp.y + 0.3 && m.position.y > hp.y - 1.4) {
                        fx.hit = true;
                        this.poopHit(h);
                        fx.t = fx.dur;
                        return;
                    }
                }
                const floor = this.groundAt(m.position.x, m.position.z, m.position.y);
                if (m.position.y <= floor + 0.02) {
                    fx.hit = true;
                    m.position.y = Math.max(0.02, floor + 0.02);
                    m.scale.set(2.5, 0.2, 2.5);
                    SFX.play('splat');
                }
            }
        });
    }

    poopHit(h) {
        SFX.play('splat');
        this.hud.floatText(h.headPos().setY(h.headPos().y + 0.4), NARRATOR.pick(['ぎゃー!!', 'うわっ!?', '最悪!!']), '#ffffff', 26);
        this.sayOnce('poop', NARRATOR.poop);
        if (h.held) {
            const f = h.held;
            h.held = null;
            h.refill = 20;
            f.drop((Math.random() - 0.5) * 2, 2.5, (Math.random() - 0.5) * 2);
            this.mission('poop');
            h.upset(this, null);
        } else h.upset(this, null);
    }

    cry() {
        if (this.state !== 'play') return;
        SFX.play('gull', 1 + Math.random() * 0.2);
        this.hud.floatText(this.bird.pos.clone().setY(this.bird.pos.y + 0.7), 'ミャーオ', '#ffffff', 20);
    }

    // ---------------------------------------------------------------- まわりの出来事

    swatHit(h) {
        const b = this.bird;
        if (b.mode === 'stun') return;
        SFX.play('swat');
        const away = new THREE.Vector3(b.pos.x - h.pos.x, 0, b.pos.z - h.pos.z).normalize();
        b.mode = 'stun';
        b.stunT = 0.7;
        b.vel.set(away.x * 5, 3, away.z * 5);
        this.shake = 0.12;
        this.hud.floatText(b.pos.clone().setY(b.pos.y + 0.7), 'バシッ!!', '#ff4d6d', 28);
        this.featherFx(b.pos);
        this.sayOnce('swat' + h.role, NARRATOR.swat);
        this.dropCarry(away.x * 2, 2, away.z * 2);
    }

    onKiteChase() {
        this.say('トンビが獲物を狙っている!');
        this.hud.alert('トンビが来た! 逃げろ!');
    }

    kiteSteal(k) {
        const b = this.bird;
        const f = b.carry;
        if (!f) return;
        b.carry = null;
        k.grab(f);
        SFX.play('kite');
        this.shake = 0.15;
        this.hud.floatText(b.pos.clone().setY(b.pos.y + 1), `トンビに${f.def.name}をさらわれた!!`, '#ff4d6d', 26, 1.8);
        this.say(NARRATOR.pick(NARRATOR.kite));
        if (f.counter) f.counter = null;
    }

    updateWorld(dt) {
        const t = this.time;
        this.animateDrafts(dt);
        this.world.sea.tex.offset.set(t * 0.01, t * 0.02);
        this.world.sea.foam.material.opacity = 0.6 + Math.sin(t * 1.5) * 0.25;
        const b = this.bird;
        this.beacon.visible = !!b.carry;
        this.beacon.material.opacity = 0.25 + Math.sin(t * 4) * 0.1;
        this.foods.forEach(f => {
            f.update(dt, this.groundAt);
            if (f.state === 'placed' && f.life !== undefined) {
                f.life -= dt;
                if (f.life <= 0) f.remove();
            }
        });
        this.foods = this.foods.filter(f => f.alive);
        if (this.state === 'play') {
            // 補充
            this.sp.counters.forEach(c => {
                if (c.food) return;
                c.timer -= dt;
                if (c.timer <= 0) this.placeCounter(c);
            });
            this.sp.towels.forEach(tw => {
                if (!tw.items.length || tw.foods.length) return;
                tw.timer -= dt;
                if (tw.timer <= 0) {
                    tw.foods = tw.items.map((type, i) => {
                        const f = new Food(this.scene, type, { x: tw.x - 0.4 + i * 0.6, y: (tw.seatY || 0) + 0.03, z: tw.z + 0.2 });
                        f.towel = tw;
                        this.foods.push(f);
                        return f;
                    });
                }
            });
            this.humans.forEach(h => {
                if (h.role === 'walker' && !h.held && h.def.hold) {
                    h.refill -= dt;
                    if (h.refill <= 0 && h.angry <= 0) this.giveFood(h, h.def.hold);
                }
            });
        }
        this.humans.forEach(h => h.update(dt, this));
        this.kites.forEach(k => k.update(dt, this));
    }

    animateDrafts(dt) {
        this.sp.updrafts.forEach(u => {
            const pos = u.lines.geometry.attributes.position;
            u.seeds.forEach((s, i) => {
                s.y += dt * 6;
                s.a += dt * 0.8;
                if (s.y > u.top) s.y = 0;
                const x = u.x + Math.cos(s.a) * s.r, z = u.z + Math.sin(s.a) * s.r;
                pos.setXYZ(i * 2, x, s.y, z);
                pos.setXYZ(i * 2 + 1, x, s.y + 1.2, z);
            });
            pos.needsUpdate = true;
        });
    }

    say(text) {
        this.narration = { text, at: this.time };
    }

    sayOnce(key, list) {
        if (this.saidOnce[key]) return;
        this.saidOnce[key] = true;
        this.say(NARRATOR.pick(list));
    }

    sfx(name) {
        SFX.play(name);
    }

    mission(id) {
        if (Save.data.missions[id]) return;
        Save.data.missions[id] = true;
        Save.save();
        this.newMissions.push(id);
        const m = MISSIONS.find(x => x.id === id);
        SFX.play('mission');
        this.hud.banner('ミッション達成!', m.label);
    }

    endRun(reason) {
        if (this.state !== 'play') return;
        this.state = 'end';
        const b = this.bird;
        if (reason === 'burst') {
            SFX.play('boom');
            this.shake = 0.4;
            this.featherFx(b.pos, 60);
            this.gull.root.visible = false;
            this.say(NARRATOR.pick(NARRATOR.burst));
        } else SFX.play('end');
        Save.data.runs++;
        const best = this.yen > Save.data.best;
        if (best) Save.data.best = this.yen;
        Save.save();
        let rank = RANKS[0][1];
        RANKS.forEach(([y, name]) => { if (this.yen >= y) rank = name; });
        this.hud.showResult({
            title: reason === 'burst' ? '食べすぎて破裂!!' : 'タイムアップ!',
            yen: this.yen, best, rank,
            stats: `盗んだ数 ${this.stolen}　最大連続 ${this.bestCombo}　体重 ${b.w.toFixed(2)}kg`,
            missions: this.newMissions.map(id => MISSIONS.find(m => m.id === id).label)
        });
    }

    // ---------------------------------------------------------------- 見た目とカメラ

    syncGull(dt) {
        const b = this.bird;
        const root = this.gull.root;
        root.position.copy(b.pos);
        root.rotation.set(0, -b.yaw, 0);
        this.gull.update({
            w: b.w, t: this.time, mode: b.mode, speed: b.vel.length(),
            pitch: b.mode === 'air' ? b.pitch : 0, roll: b.mode === 'air' || b.mode === 'stun' ? b.roll : 0,
            walk: b.walk, dive: b.dive && b.mode === 'air', alarm: this.kites.some(k => k.state === 'chase')
        }, dt);
        // 足元の影
        const sh = this.gull.shadow;
        const g = this.groundInfo(b.pos.x, b.pos.z, b.pos.y);
        sh.position.set(b.pos.x, Math.max(0, g.h) + 0.03, b.pos.z);
        const hgt = b.pos.y - Math.max(0, g.h);
        sh.scale.setScalar(CFG.scale(b.w) * (1 + b.w * 0.2) / (1 + hgt * 0.08));
        sh.material.opacity = 0.3 / (1 + hgt * 0.1);
        if (!sh.parent) this.scene.add(sh);
    }

    placeCameraNow() {
        this.updateCamera(1, true);
    }

    updateCamera(dt, snap) {
        const b = this.bird;
        const s = b.vel.length();
        // 飛んでいる向きの後ろ上から
        const yaw = b.yaw + this.camYaw;
        const dist = 3.2 * CFG.scale(b.w) + (b.mode === 'air' ? s * 0.1 : 0) + (b.carry && b.carry.type === 'tuna' ? 1.5 : 0);
        const pitch = 0.28 + this.camPitch + (b.mode === 'air' ? -b.pitch * 0.25 : 0.1);
        const dir = new THREE.Vector3(-Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), -Math.cos(pitch) * Math.sin(yaw));
        let d = dist;
        const hit = this.rayBoxes(b.pos, dir, dist);
        if (hit < d) d = Math.max(0.6, hit - 0.2);
        const want = b.pos.clone().addScaledVector(dir, d);
        want.y = Math.max(this.groundAt(want.x, want.z, want.y) + 0.4, want.y);
        const k = snap ? 1 : Math.min(1, dt * (b.mode === 'air' ? 6 : 4));
        this.camPos.lerp(want, k);
        const look = b.pos.clone().addScaledVector(new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)), 1.5).setY(b.pos.y + 0.3);
        this.camLook.lerp(look, snap ? 1 : Math.min(1, dt * 8));
        const cam = this.camera;
        cam.position.copy(this.camPos);
        if (this.shake > 0) {
            cam.position.x += (Math.random() - 0.5) * this.shake;
            cam.position.y += (Math.random() - 0.5) * this.shake;
            this.shake = Math.max(0, this.shake - dt * 0.8);
        }
        cam.up.set(0, 1, 0);
        // 傾きを少しだけ画面にも
        if (b.mode === 'air') cam.up.set(0, 1, 0).applyAxisAngle(new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)), b.roll * 0.25);
        cam.lookAt(this.camLook);
        const fov = 62 + Math.min(20, Math.max(0, s - 8) * 1.1) * (b.mode === 'air' ? 1 : 0);
        if (Math.abs(cam.fov - fov) > 0.1) {
            cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
            cam.updateProjectionMatrix();
        }
    }

    rayBoxes(o, d, maxT) {
        let best = maxT;
        const x0 = Math.min(o.x, o.x + d.x * maxT), x1 = Math.max(o.x, o.x + d.x * maxT);
        const z0 = Math.min(o.z, o.z + d.z * maxT), z1 = Math.max(o.z, o.z + d.z * maxT);
        for (const c of this.world.grid.query(x0, z0, x1, z1, this.near_)) {
            if (c.thin || c.bouncy) continue;
            let t0 = 0, t1 = best;
            let ok = true;
            for (const ax of ['x', 'y', 'z']) {
                const inv = 1 / (d[ax] || 1e-9);
                let ta = (c.min[ax] - o[ax]) * inv, tb = (c.max[ax] - o[ax]) * inv;
                if (ta > tb) [ta, tb] = [tb, ta];
                t0 = Math.max(t0, ta);
                t1 = Math.min(t1, tb);
                if (t0 > t1) { ok = false; break; }
            }
            if (ok && t0 > 0.05 && t0 < best) best = t0;
        }
        return best;
    }

    // ---------------------------------------------------------------- 演出

    featherFx(pos, n = 12) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.16), mat);
            m.position.copy(pos);
            this.scene.add(m);
            const v = new THREE.Vector3((Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4);
            const spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
            this.fx.push({ obj: m, t: 0, dur: 2.5, step: (k, dt) => {
                v.y = Math.max(-0.8, v.y - 4 * dt);
                v.x *= 1 - dt;
                v.z *= 1 - dt;
                m.position.addScaledVector(v, dt);
                m.rotation.x += spin.x * dt;
                m.rotation.y += spin.y * dt;
            } });
        }
    }

    splashFx(pos) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xdff4ff });
        for (let i = 0; i < 16; i++) {
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat);
            m.position.set(pos.x, 0.1, pos.z);
            this.scene.add(m);
            const a = Math.random() * Math.PI * 2;
            const v = new THREE.Vector3(Math.cos(a) * 2, 3 + Math.random() * 2, Math.sin(a) * 2);
            this.fx.push({ obj: m, t: 0, dur: 1, step: (k, dt) => {
                v.y -= 9.8 * dt;
                m.position.addScaledVector(v, dt);
            } });
        }
    }

    updateFx(dt) {
        this.fx = this.fx.filter(f => {
            f.t += dt;
            f.step(Math.min(1, f.t / f.dur), dt, f);
            if (f.t >= f.dur) {
                this.scene.remove(f.obj);
                return false;
            }
            return true;
        });
    }
}
