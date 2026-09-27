// ゲームの中身: 猫の操作・当たり判定・食事・パンチ・詰まり・町の住人・ボス・カメラ
import * as THREE from 'three';
import { CFG, NARRATOR, DEATHS, BOSSES, FOODS, Save } from './config.js';
import { SFX } from './audio.js';
import { TOWN, Grid } from './town.js';
import { Food, TrashCan, Badge, part } from './items.js';
import { Mouse, Crow, Dog, Human, Truck } from './critters.js';
import { NpcCat, BossCat } from './felines.js';
import { toon, refreshOutlines } from './toon.js';

const UP = new THREE.Vector3(0, 1, 0);
const BOSS_IDS = ['mike', 'buchi', 'kuro'];

export class Game {
    constructor({ scene, camera, town, catModel, hud }) {
        this.scene = scene;
        this.camera = camera;
        this.town = town;
        this.sp = town.spawns;
        this.model = catModel;
        this.hud = hud;
        this.keys = {};
        this.yaw = -Math.PI / 2;
        this.pitch = 0.4;
        this.camPos = new THREE.Vector3(3, 1.5, 44);
        this.camTarget = new THREE.Vector3();
        this.shake = 0;
        this.state = 'idle';
        this.time = 0;
        this.fx = [];
        this.near_ = [];
        this.saidOnce = {};
        this.narration = null;

        // 動かない住人・乗り物（ずっと町にいる）
        this.trash = this.sp.trash.map(({ x, z }) => {
            const col = { min: new THREE.Vector3(x - 0.27, 0, z - 0.27), max: new THREE.Vector3(x + 0.27, 0.72, z + 0.27), name: 'trash', off: false };
            town.colliders.push(col);
            return new TrashCan(scene, x, z, col);
        });
        // ゴミ箱を足したので当たり判定の升目を作り直す
        this.town.grid = new Grid(town.colliders);
        this.humans = this.sp.humans.map(h => new Human(scene, h));
        this.dog = new Dog(scene, this.sp.dog);
        this.crows = this.sp.crows.map(c => new Crow(scene, this.sp.poles[c.perch]));
        this.truck = new Truck(scene, this.sp.truckZ);
        this.npcs = this.sp.npcs.map(n => new NpcCat(scene, n));
        this.buildDoor();
        this.foods = [];
        this.spawnRecs = this.sp.foods.map(f => ({ ...f, food: null, timer: 0 }));
        this.mice = [];
        this.mouseT = 0;
        this.badges = [];
        this.bosses = {};
        this.cat = this.newCat(CFG.START_WEIGHT);
        this.catShapeW = -1;
        this.resetWorld();
    }

    // ---------------------------------------------------------------- 町の準備

    buildDoor() {
        const d = this.sp.door;
        this.door = { ...d, open: 0, openT: 0, msgT: 0 };
        const g = new THREE.Group();
        g.position.copy(d.hinge);
        const slab = part(new THREE.BoxGeometry(d.width, d.height, 0.08), toon(0x6d7a86), 0.01);
        slab.position.set(d.width / 2, d.height / 2, 0);
        const knob = part(new THREE.SphereGeometry(0.04, 8, 6), toon(0xd9b44a), 0);
        knob.position.set(d.width - 0.15, 1.0, -0.06);
        g.add(slab, knob);
        this.scene.add(g);
        refreshOutlines(g);
        this.door.mesh = g;
    }

    // 食べ物・バッジ・ボスを置き直す（はじめから / つづきから）
    resetWorld() {
        this.foods.forEach(f => f.remove());
        this.foods = [];
        this.spawnRecs.forEach(r => {
            r.food = new Food(this.scene, r.type, r.x, r.y, r.z, r);
            r.timer = 0;
            this.foods.push(r.food);
        });
        this.badges.forEach(b => b.alive && b.remove());
        this.badges = this.sp.badges.map(([x, y, z], i) => new Badge(this.scene, i, x, y, z)).filter(b => {
            if (Save.data.badges.includes(b.id)) {
                b.remove();
                return false;
            }
            return true;
        });
        Object.values(this.bosses).forEach(b => this.scene.remove(b.model.root));
        this.bosses = {};
        BOSS_IDS.forEach(id => { this.bosses[id] = new BossCat(this.scene, id, this.sp.bosses[id], !!Save.data.bosses[id]); });
        this.mice.forEach(m => m.remove());
        this.mice = [];
        for (let i = 0; i < this.sp.mice.count; i++) this.mice.push(new Mouse(this.scene, this.sp.mice));
        this.activeBoss = null;
    }

    newCat(w) {
        const h = this.sp.home;
        return {
            pos: h.clone(), vel: new THREE.Vector3(),
            heading: this.sp.homeHeading, w, vw: w, r: 0.1,
            onGround: true, squeeze: false, charge: 0, charging: false,
            punchT: 0, punchCd: 0, eatT: 0, eatFood: null, hackT: 0,
            idle: 0, loaf: false, sleeping: false, zzz: 0,
            high: 0, scaredT: 0, stuck: false, stuckT: 0, meowT: 0,
            airT: 0, lookYaw: 0, seatT: 0,
            stamina: 1, dashing: false, tired: false
        };
    }

    // はじめる / つづきから
    start(fresh) {
        if (fresh) {
            Save.reset();
            this.resetWorld();
        }
        const w = !fresh && Save.data.weight >= CFG.MIN_WEIGHT && Save.data.weight < CFG.BURST_WARN ? Save.data.weight : CFG.START_WEIGHT;
        Save.data.started = true;
        Save.save();
        this.spawnCat(w);
        this.hud.startGame();
        this.say(fresh ? 'この町の町内会長になるのは、どの猫だ' : NARRATOR.pick(['おかえり', '散歩の続きだ']));
    }

    spawnCat(w) {
        this.cat = this.newCat(w);
        this.catShapeW = -1;
        this.updateCatShape();
        this.milestones = {};
        NARRATOR.milestones.forEach(([kg]) => { if (w >= kg) this.milestones[kg] = true; });
        this.yaw = this.sp.homeHeading;
        this.pitch = 0.35;
        this.state = 'play';
        this.activeBoss = null;
        this.saveT = 5;
        this.model.root.visible = true;
        this.model.update(this.visualState(), 0);
        this.placeCameraNow();
    }

    // 失敗したら家（段ボール）から。ボスとバッジはそのまま
    respawn() {
        this.hud.hideResult();
        this.spawnCat(CFG.START_WEIGHT);
        Save.data.weight = CFG.START_WEIGHT;
        Save.save();
        this.say(NARRATOR.pick(NARRATOR.respawn));
    }

    // ---------------------------------------------------------------- 当たり判定

    dims() {
        const b = CFG.body(this.cat.w);
        return { b, r: Math.max(0.07, b.width / 2), H: b.height, hc: b.height * CFG.CROUCH_RATIO };
    }

    // 猫の箱 (足元 pos、半径 r、高さ h) が壁や建物に重なるか
    overlaps(pos, r, h) {
        const x0 = pos.x - r, x1 = pos.x + r, y0 = pos.y + 0.001, y1 = pos.y + h, z0 = pos.z - r, z1 = pos.z + r;
        if (x0 < 0 || x1 > TOWN.w || z0 < 0 || z1 > TOWN.d) return true;
        for (const c of this.town.grid.query(x0, z0, x1, z1, this.near_)) {
            if (c.off) continue;
            if (x1 > c.min.x && x0 < c.max.x && y1 > c.min.y && y0 < c.max.y && z1 > c.min.z && z0 < c.max.z) return true;
        }
        return false;
    }

    moveAxis(axis, d) {
        const c = this.cat;
        const { r, H, hc } = this.dims();
        if (!d) return false;
        const steps = Math.max(1, Math.ceil(Math.abs(d) / 0.02));
        const s = d / steps;
        const np = new THREE.Vector3();
        for (let i = 0; i < steps; i++) {
            const h = c.squeeze ? hc : H;
            np.copy(c.pos);
            np[axis] += s;
            if (axis === 'y' && np.y < 0) {
                c.pos.y = 0;
                return true;
            }
            if (!this.overlaps(np, r, h)) {
                c.pos.copy(np);
                continue;
            }
            if (axis !== 'y') {
                // 低いところには体を低くして潜り込む
                if (!c.squeeze && !this.overlaps(np, r, hc)) {
                    c.squeeze = true;
                    c.pos.copy(np);
                    continue;
                }
                // 段差・階段は歩いて登る
                if (c.onGround) {
                    let up = false;
                    for (let k = 0.04; k <= CFG.STEP_UP + 0.001; k += 0.04) {
                        np.y = c.pos.y + k;
                        if (!this.overlaps(np, r, h)) {
                            up = true;
                            break;
                        }
                    }
                    if (up) {
                        c.pos.copy(np);
                        continue;
                    }
                }
            }
            return true;
        }
        return false;
    }

    near(p, dist) {
        return Math.hypot(p.x - this.camera.position.x, p.z - this.camera.position.z) < dist;
    }

    // ---------------------------------------------------------------- 更新

    update(dt) {
        if (this.state === 'idle') return;
        this.time += dt;
        const c = this.cat;
        if (this.state === 'play') {
            Save.data.playTime = (Save.data.playTime || 0) + dt;
            this.updateCat(dt);
            if (this.state === 'play') this.updateEating(dt);
            if (this.state === 'play') this.updatePlaces(dt);
            this.saveT -= dt;
            if (this.saveT <= 0) {
                this.saveT = 5;
                Save.data.weight = c.w;
                Save.save();
            }
        }
        this.updateTown(dt);
        this.updateFx(dt);
        c.vw += (c.w - c.vw) * Math.min(1, dt * 6);
        this.model.update(this.visualState(), dt);
        this.syncModel();
        this.updateCamera(dt);
        this.hud.update(this, dt);
    }

    input() {
        const k = this.keys;
        let fx = 0, fz = 0;
        if (k.KeyW) fz += 1;
        if (k.KeyS) fz -= 1;
        if (k.KeyA) fx -= 1;
        if (k.KeyD) fx += 1;
        // カメラの向きを基準にした移動方向
        const fwd = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
        const right = new THREE.Vector3(-Math.sin(this.yaw), 0, Math.cos(this.yaw));
        const dir = fwd.multiplyScalar(fz).add(right.multiplyScalar(fx));
        if (dir.lengthSq() > 0) dir.normalize();
        return dir;
    }

    updateCat(dt) {
        const c = this.cat;
        c.punchT = Math.max(0, c.punchT - dt);
        c.punchCd -= dt;
        c.high = Math.max(0, c.high - dt);
        c.scaredT = Math.max(0, c.scaredT - dt);
        c.meowT = Math.max(0, c.meowT - dt);
        // マウスがなくても矢印キーでカメラを動かせる
        if (this.keys.ArrowLeft) this.yaw -= dt * 2.2;
        if (this.keys.ArrowRight) this.yaw += dt * 2.2;
        if (this.keys.ArrowUp) this.pitch = Math.max(-0.15, this.pitch - dt * 1.2);
        if (this.keys.ArrowDown) this.pitch = Math.min(1.25, this.pitch + dt * 1.2);

        if (c.w >= CFG.BURST_WARN) {
            c.warnT = (c.warnT || 0) - dt;
            if (c.warnT <= 0) {
                SFX.play('warn');
                c.warnT = 0.5;
            }
        }

        if (c.hackT > 0) {
            c.hackT -= dt;
            if (c.hackT <= 0) this.finishSpit();
            if (this.state !== 'play') return;
        }

        if (c.stuck) {
            c.stuckT -= dt;
            c.vel.set(0, 0, 0);
            if (c.stuckT <= 0) this.fail('stuck');
            return;
        }

        let dir = this.input();
        if (dir.lengthSq() > 0 || c.charging) this.wake();
        // またたびで酔うと、まっすぐ歩けない
        if (c.high > 0 && dir.lengthSq() > 0) dir.applyAxisAngle(UP, Math.sin(this.time * 2.3) * 0.9);
        const busy = c.eatT > 0 || c.hackT > 0;
        // ダッシュ: Shift。スタミナを使う（太っているほど早くバテる）
        const wantDash = (this.keys.ShiftLeft || this.keys.ShiftRight) && dir.lengthSq() > 0 && c.onGround && !c.charging;
        c.dashing = wantDash && !c.tired && c.stamina > 0;
        if (c.dashing) {
            c.stamina = Math.max(0, c.stamina - dt * (0.16 + c.w * 0.01));
            if (c.stamina <= 0) {
                c.tired = true;
                this.hud.floatText(this.headPos(), 'ゼェ… ゼェ…', '#ffffff', 20, 1.4);
                if (c.w >= 20) this.sayOnce('tired', ['デブは走れない', 'スタミナも体重に比例して減る']);
            }
        } else {
            c.stamina = Math.min(1, c.stamina + dt * (c.tired ? 0.2 : 0.32));
            if (c.tired && c.stamina > 0.35) c.tired = false;
        }
        let spd = CFG.speed(c.w) * (c.dashing ? 1.9 : c.tired ? 0.7 : 1) * (c.high > 0 ? 1.4 : 1);
        if (c.charging) spd *= 0.25;
        if (c.squeeze) spd *= 0.5;
        if (busy) spd = 0;
        const grip = c.onGround ? CFG.grip(c.w) : 1.5;
        const f = Math.min(1, grip * dt);
        c.vel.x += (dir.x * spd - c.vel.x) * f;
        c.vel.z += (dir.z * spd - c.vel.z) * f;
        if (c.charging) c.charge = Math.min(1, c.charge + dt / 0.6);

        const wasGround = c.onGround;
        const vy = c.vel.y;
        // 空中でふちに当たっても勢いは残す（登り切ったら前に進める）
        if (this.moveAxis('x', c.vel.x * dt) && c.onGround) c.vel.x = 0;
        if (this.moveAxis('z', c.vel.z * dt) && c.onGround) c.vel.z = 0;
        // 放物線を正確に積分する（フレームレートでジャンプの高さが変わらないように）
        const dy = c.vel.y * dt - 0.5 * CFG.GRAVITY * dt * dt;
        c.vel.y -= CFG.GRAVITY * dt;
        const hitY = this.moveAxis('y', dy);
        if (hitY) {
            if (c.vel.y < 0) c.onGround = true;
            c.vel.y = 0;
        } else {
            const probe = c.pos.clone();
            probe.y -= 0.01;
            c.onGround = c.pos.y <= 0.0001 || this.overlaps(probe, this.dims().r, 0.02);
        }
        if (!wasGround && c.onGround) this.onLand(vy);
        c.airT = c.onGround ? 0 : c.airT + dt;

        // 立ち上がれるなら立つ
        const { r, H } = this.dims();
        if (c.squeeze && !this.overlaps(c.pos, r, H)) c.squeeze = false;

        // 向き: 動いている方向。パンチやためのときはカメラの向き
        const hv = Math.hypot(c.vel.x, c.vel.z);
        let target = c.heading;
        if (c.charging || c.punchT > 0) target = this.yaw;
        else if (hv > 0.08) target = Math.atan2(c.vel.z, c.vel.x);
        else if (c.eatFood) target = Math.atan2(c.eatFood.pos.z - c.pos.z, c.eatFood.pos.x - c.pos.x);
        let dh = target - c.heading;
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        c.heading += dh * Math.min(1, dt * 10);
        const look = this.yaw - c.heading;
        c.lookYaw = Math.atan2(Math.sin(look), Math.cos(look)) * 0.6;

        // 放っておくと香箱座り → 寝る
        c.idle += dt;
        if (dir.lengthSq() > 0 || !c.onGround || c.charging || busy) c.idle = 0;
        c.loaf = c.idle > CFG.SIT_AFTER;
        if (!c.sleeping && c.idle > CFG.SLEEP_AFTER) {
            c.sleeping = true;
            this.sayOnce('sleep', NARRATOR.sleep);
        }
        if (c.sleeping) {
            c.zzz -= dt;
            if (c.zzz <= 0) {
                c.zzz = 1.4;
                this.hud.floatText(this.headPos(), 'Zzz', '#ffffff', 18, 1.4);
            }
        }
        this.pushDoor(dir, dt);
        if (c.pos.y < -1) c.pos.copy(this.sp.home);
    }

    wake() {
        const c = this.cat;
        c.idle = 0;
        c.loaf = false;
        if (c.sleeping) {
            c.sleeping = false;
            this.hud.floatText(this.headPos(), 'ハッ', '#ffffff', 20);
        }
    }

    onLand(vy) {
        const c = this.cat;
        const impact = -vy;
        if (impact < 1.5) return;
        this.model.land(impact);
        SFX.play('land', c.w);
        if (c.w >= 30 && impact > 3) {
            this.shake = Math.min(0.08, c.w / 1000);
            this.hud.floatText(c.pos.clone(), 'ドスン', '#ffd166', 22);
        }
        if (impact > 7) this.sayOnce('bigfall', ['猫は高いところから落ちても平気', '着地は満点']);
    }

    // 路地裏の重い扉: 内側から 35kg 以上で押すと開く
    pushDoor(dir, dt) {
        const d = this.door;
        const c = this.cat;
        d.msgT -= dt;
        if (d.open > 0) {
            d.openT -= dt;
            const inWay = c.pos.x > 5.7 && c.pos.x < 7.5 && c.pos.z > 28.8 && c.pos.z < 31.2;
            if (d.openT <= 0 && !inWay) {
                d.open = 0;
                d.box.off = false;
                SFX.play('thud', 40);
                this.hud.floatText(new THREE.Vector3(6.6, 1.5, 29.6), 'バタン', '#ffffff', 22);
            }
            return;
        }
        const { r } = this.dims();
        if (c.pos.x + r < 6 || c.pos.x - r > 7.2 || c.pos.y > 1) return;
        const inside = c.pos.z < 29.45 && c.pos.z + r > 29.38 && dir.z > 0.5;
        const outside = c.pos.z > 29.75 && c.pos.z - r < 29.82 && dir.z < -0.5;
        if (inside && c.w >= 35) {
            d.open = 1;
            d.openT = 5;
            d.box.off = true;
            SFX.play('thud', 60);
            this.shake = 0.03;
            this.hud.floatText(this.headPos(), 'ギィィ…', '#ffd166', 26);
            this.sayOnce('door', ['体重で扉をこじ開けた', 'デブは扉も開けられる']);
        } else if ((inside || outside) && d.msgT <= 0) {
            d.msgT = 1.5;
            this.hud.floatText(this.headPos(), inside ? `ビクともしない（${(35 - c.w).toFixed(1)}kg 足りない）` : '外からは開かない', '#ffffff', 20);
        }
    }

    // ---------------------------------------------------------------- 猫の行動

    startCharge() {
        const c = this.cat;
        if (this.state !== 'play' || c.stuck || !c.onGround || c.hackT > 0) return;
        c.charging = true;
        c.charge = 0;
    }

    releaseJump() {
        const c = this.cat;
        if (!c.charging) return;
        c.charging = false;
        if (this.state !== 'play' || c.stuck || !c.onGround) return;
        const h = CFG.jumpHeight(c.w, c.charge);
        if (h < 0.12) this.sayOnce('cantJump', NARRATOR.cantJump);
        c.vel.y = Math.sqrt(2 * CFG.GRAVITY * h);
        const dir = this.input();
        if (dir.lengthSq() === 0) dir.set(Math.cos(this.yaw), 0, Math.sin(this.yaw));
        const boost = (0.5 + c.charge * 0.9) * (1 - CFG.body(c.w).fat * 0.5);
        c.vel.x += dir.x * boost;
        c.vel.z += dir.z * boost;
        c.onGround = false;
        c.heading = Math.atan2(dir.z, dir.x);
        c.charge = 0;
        SFX.play('jump');
    }

    // 猫パンチ: 見ている方向のゴミ箱・カラス・ネズミ・ボスに当たる
    punch() {
        const c = this.cat;
        if (this.state !== 'play' || c.stuck || c.punchCd > 0 || c.hackT > 0) return;
        this.wake();
        c.punchCd = CFG.PUNCH_COOLDOWN;
        c.punchT = 0.25;
        c.heading = this.yaw;
        const fwd = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
        const reach = CFG.punchReach(c.w);
        const { b } = this.dims();
        const origin = c.pos.clone().addScaledVector(fwd, b.length * 0.3);
        const inReach = (p, extra, dyMax = 0.5) => {
            const d = new THREE.Vector3(p.x - origin.x, 0, p.z - origin.z);
            const dist = d.length();
            if (dist > reach + extra) return false;
            if (dist > 0.05 && d.normalize().dot(fwd) < 0.3) return false;
            return p.y > c.pos.y - 0.3 && p.y < c.pos.y + b.height + dyMax;
        };
        SFX.play('swipe');
        this.clawFx(origin.clone().addScaledVector(fwd, reach * 0.6).setY(c.pos.y + b.height * 0.6), this.yaw);
        let hit = false;
        this.trash.forEach(t => {
            if (t.down || !inReach(t.pos, 0.27)) return;
            t.knock(fwd.x, fwd.z);
            hit = true;
            SFX.play('thud', 20);
            this.hud.floatText(t.pos.clone().setY(0.9), 'ガシャーン', '#ffffff', 22);
            const n = 1 + (Math.random() < 0.5 ? 1 : 0);
            for (let k = 0; k < n; k++) {
                const type = ['bone', 'zanpan', 'bento', 'treat', 'bone'][Math.floor(Math.random() * 5)];
                const f = new Food(this.scene, type, t.pos.x + fwd.x * 0.4, 0.4, t.pos.z + fwd.z * 0.4);
                f.toss(fwd.x * (1 + Math.random()) + (Math.random() - 0.5), 2, fwd.z * (1 + Math.random()) + (Math.random() - 0.5), 0);
                f.life = 60;
                this.foods.push(f);
            }
            this.sayOnce('trash', ['ゴミ箱は猫の冷蔵庫', '町の美化にご協力ください']);
        });
        this.crows.forEach(cr => {
            if (inReach(cr.pos, 0.2, 0.8) && cr.scare(this)) hit = true;
        });
        this.mice.forEach(m => {
            if (!m.alive || !inReach(m.pos, 0.05)) return;
            m.remove();
            const f = new Food(this.scene, 'mouse', m.pos.x, 0, m.pos.z);
            f.life = 60;
            this.foods.push(f);
            this.hud.floatText(m.pos.clone().setY(0.2), 'しとめた!', '#ffd166', 22);
            SFX.play('squeak');
            hit = true;
        });
        Object.values(this.bosses).forEach(bs => {
            if (bs.state === 'defeated' || !inReach(bs.pos, bs.r)) return;
            bs.takeHit(this, fwd);
            hit = true;
        });
        this.npcs.forEach(n => {
            if (!inReach(n.pos, 0.12)) return;
            this.hud.bubble(n, 'いたっ! なにすんのさ', 2.5);
            hit = true;
        });
        if (hit) SFX.play('hit');
    }

    spit() {
        const c = this.cat;
        if (this.state !== 'play' || c.hackT > 0) return;
        const amt = CFG.spitAmount(c.w);
        if (c.w - amt < CFG.MIN_WEIGHT) {
            this.hud.floatText(this.headPos(), 'もう吐けない', '#ffffff', 18);
            return;
        }
        this.wake();
        c.hackT = CFG.SPIT_TIME;
        c.charging = false;
        SFX.play('hack');
    }

    finishSpit() {
        const c = this.cat;
        const amt = CFG.spitAmount(c.w);
        const fwd = new THREE.Vector3(Math.cos(c.heading), 0, Math.sin(c.heading));
        const mouth = this.headPos().addScaledVector(fwd, 0.05);
        const ball = part(new THREE.SphereGeometry(0.03 + amt * 0.004, 8, 6), toon(0xb58a5e), 0.003);
        ball.position.copy(mouth);
        this.scene.add(ball);
        const v = new THREE.Vector3(fwd.x * 1.5, 0.8, fwd.z * 1.5);
        const floor = c.pos.y;
        this.fx.push({ obj: ball, t: 0, dur: 5, step: (k, dt) => {
            if (ball.position.y > floor + 0.03) {
                v.y -= 9.8 * dt;
                ball.position.addScaledVector(v, dt);
            } else ball.position.y = floor + 0.03;
        } });
        this.hud.floatText(this.headPos(), `オエッ -${amt}kg`, '#c9a27e', 20);
        this.setWeight(c.w - amt);
    }

    meow() {
        if (this.state !== 'play') return;
        const c = this.cat;
        this.wake();
        c.meowT = 0.5;
        SFX.play('meow', c.w > 40 ? 0.7 : 1.1);
        this.hud.floatText(this.headPos(), c.w > 40 ? 'ンナ゛ァ〜' : 'ニャー', '#ffffff', 22);
        const dist = p => Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
        this.npcs.forEach(n => { if (dist(n.pos) < 3.2) n.talk(this); });
        Object.values(this.bosses).forEach(b => { if (dist(b.pos) < 3.2 && Math.abs(b.pos.y - c.pos.y) < 1) b.talk(this); });
        this.crows.forEach(cr => { if (dist(cr.pos) < 4) cr.scare(this); });
        const gm = this.humans.find(h => h.kind === 'grandma');
        if (gm && dist(gm.pos) < 2.6) {
            if ((this.grandmaT || 0) < this.time) {
                this.grandmaT = this.time + 12;
                const f = new Food(this.scene, 'treat', gm.pos.x + 0.2, 0, gm.pos.z + 0.9);
                f.life = 60;
                this.foods.push(f);
                this.hud.bubble(gm, c.w >= 30 ? 'あらまぁ、ずいぶん立派になって' : 'あらまぁ、かわいい猫ちゃん。はい、おやつ', 3.5);
            } else this.hud.bubble(gm, 'さっきあげたでしょう', 2.5);
        }
        const fm = this.humans.find(h => h.kind === 'fishmonger');
        if (fm && dist(fm.pos) < 3) this.hud.bubble(fm, c.w >= 30 ? 'でかっ… 何食ったらそうなるんだ' : '売りもんはやらねえぞ', 2.5);
    }

    headPos() {
        const c = this.cat;
        const b = CFG.body(c.w);
        const fwd = new THREE.Vector3(Math.cos(c.heading), 0, Math.sin(c.heading));
        return c.pos.clone().addScaledVector(fwd, b.length * 0.5 + b.head * 0.6).setY(c.pos.y + (c.squeeze ? b.height * 0.55 : b.height * 0.85));
    }

    // 口元に食べ物があれば食べる
    updateEating(dt) {
        const c = this.cat;
        if (c.eatT > 0) {
            c.eatT -= dt;
            if (c.eatT <= 0) this.finishBite();
            return;
        }
        if (!c.onGround || c.stuck || c.hackT > 0) return;
        const mouth = this.headPos();
        const b = CFG.body(c.w);
        for (const f of this.foods) {
            if (!f.alive || f.falling > 0) continue;
            const dy = f.pos.y - c.pos.y;
            if (dy < -0.15 || dy > b.height * 0.9) continue;
            const d = Math.hypot(f.pos.x - mouth.x, f.pos.z - mouth.z);
            if (d > 0.12 + b.head + b.width * 0.2) continue;
            c.eatT = 0.45;
            c.eatFood = f;
            c.vel.x = c.vel.z = 0;
            this.wake();
            SFX.play('eat');
            return;
        }
        // ネズミは触れたら捕まえて食べる
        for (const m of this.mice) {
            if (!m.alive || c.pos.y > 0.1) continue;
            if (Math.hypot(m.pos.x - mouth.x, m.pos.z - mouth.z) < 0.1 + b.width * 0.3) {
                m.remove();
                SFX.play('squeak');
                const food = new Food(this.scene, 'mouse', m.pos.x, 0, m.pos.z);
                this.foods.push(food);
                c.eatT = 0.45;
                c.eatFood = food;
                return;
            }
        }
    }

    finishBite() {
        const c = this.cat;
        const f = c.eatFood;
        c.eatFood = null;
        if (!f || !f.alive) return;
        const kg = f.bite();
        if (!f.alive) this.scheduleRespawn(f);
        const pos = this.headPos();
        if (f.type === 'catnip') {
            c.high = CFG.HIGH_TIME;
            SFX.play('meow', 1.5);
            this.hud.floatText(pos, 'ニャハハハハ', '#a7c957', 26);
            this.say(NARRATOR.pick(NARRATOR.high));
        } else {
            SFX.play(kg >= 1 ? 'gulp' : 'eat');
            this.hud.floatText(pos, `${f.type === 'mouse' ? 'ムシャ' : 'モグ'} +${Math.round(kg * 10) / 10}kg`, '#ffd166', kg >= 1 ? 24 : 20);
        }
        this.setWeight(c.w + kg);
    }

    scheduleRespawn(f) {
        const r = f.spawn;
        if (!r || !r.food) return;
        r.food = null;
        r.timer = FOODS[r.type].respawn || 30;
    }

    crowSteal(crow, f) {
        f.remove();
        this.scheduleRespawn(f);
        this.hud.floatText(f.pos.clone().setY(f.pos.y + 0.4), `カラスに${f.def.name}を取られた!`, '#ff9aa8', 20, 1.6);
        this.sayOnce('crow', ['カラスは町の強敵', 'パンチか鳴き声で追い払え']);
    }

    setWeight(nw) {
        const c = this.cat;
        nw = Math.round(nw * 10) / 10;
        const grew = nw > c.w;
        c.w = nw;
        if (nw < CFG.MIN_WEIGHT) return this.fail('thin');
        if (nw >= CFG.BURST_WEIGHT) return this.fail('burst');
        if (nw > Save.data.maxWeight) Save.data.maxWeight = nw;
        NARRATOR.milestones.forEach(([kg, line]) => {
            if (nw >= kg && !this.milestones[kg]) {
                this.milestones[kg] = true;
                this.say(line);
            }
        });
        this.updateCatShape();
        if (grew) this.resolveGrow();
        else if (c.stuck) this.tryUnstuck();
    }

    // 太って壁にめり込んだら押し出す。出られなければ詰まる
    resolveGrow() {
        const c = this.cat;
        const { r, H, hc } = this.dims();
        if (!this.overlaps(c.pos, r, hc)) {
            c.squeeze = this.overlaps(c.pos, r, H);
            return;
        }
        const np = new THREE.Vector3();
        for (let d = 0.02; d <= 0.3; d += 0.02) {
            for (let k = 0; k < 16; k++) {
                const a = (k / 16) * Math.PI * 2;
                np.set(c.pos.x + Math.cos(a) * d, c.pos.y, c.pos.z + Math.sin(a) * d);
                if (!this.overlaps(np, r, hc)) {
                    c.pos.copy(np);
                    c.squeeze = this.overlaps(c.pos, r, H);
                    return;
                }
            }
        }
        // 台の上なら上に押し出してもよい
        for (let d = 0.02; d <= 0.15; d += 0.02) {
            np.copy(c.pos);
            np.y += d;
            if (!this.overlaps(np, r, hc)) {
                c.pos.copy(np);
                return;
            }
        }
        if (!c.stuck) {
            c.stuck = true;
            c.stuckT = CFG.STUCK_TIME;
            c.squeeze = true;
            SFX.play('stuck');
            SFX.play('meow', 0.8);
            this.shake = 0.03;
            this.hud.floatText(this.headPos(), '詰まった!!', '#ff4d6d', 30);
            this.say(NARRATOR.pick(NARRATOR.stuckStart));
        }
    }

    tryUnstuck() {
        const c = this.cat;
        const { r, H, hc } = this.dims();
        if (this.overlaps(c.pos, r, hc)) return;
        c.stuck = false;
        c.squeeze = this.overlaps(c.pos, r, H);
        SFX.play('pop');
        this.hud.floatText(this.headPos(), 'スポッ', '#3fdc7f', 26);
    }

    updateCatShape() {
        const c = this.cat;
        c.r = this.dims().r;
    }

    scare(angle, height, text, speed = 2.2) {
        const c = this.cat;
        this.wake();
        c.charging = false;
        c.eatT = 0;
        c.eatFood = null;
        c.scaredT = 1.0;
        c.vel.set(Math.cos(angle) * speed, Math.sqrt(2 * CFG.GRAVITY * height), Math.sin(angle) * speed);
        c.onGround = false;
        SFX.play('hiss');
        this.shake = 0.02;
        this.hud.floatText(this.headPos(), text, '#ff4d6d', 28);
    }

    // ---------------------------------------------------------------- 町の出来事

    dogBite(dog) {
        const c = this.cat;
        this.scare(Math.atan2(c.pos.z - dog.pos.z, c.pos.x - dog.pos.x), 0.5, 'ギャッ!!', 3);
        this.sayOnce('dog', ['犬は猫の天敵', '30kg あれば犬も黙る…かも']);
    }

    broomHit(fm) {
        const c = this.cat;
        if (c.w >= 30) {
            this.hud.floatText(this.headPos(), '…重くて動かない', '#ffffff', 22);
            this.hud.bubble(fm, 'ぐっ… びくともしねえ!!', 2.5);
            this.sayOnce('broomFail', ['ほうきの敗北', '重さこそ力']);
            return;
        }
        this.scare(-Math.PI / 2 + (Math.random() - 0.5) * 0.4, 0.6, 'フギャッ!!', 3.2);
        this.sayOnce('broom', NARRATOR.broom);
    }

    bossHit(bs) {
        const c = this.cat;
        const ratio = bs.w / c.w;
        if (ratio < 0.6) {
            this.hud.floatText(this.headPos(), 'びくともしない', '#3fdc7f', 22);
            return;
        }
        this.scare(Math.atan2(c.pos.z - bs.pos.z, c.pos.x - bs.pos.x), 0.25 + Math.min(0.4, ratio * 0.15), 'ぐはっ', 2 * Math.min(2.2, ratio));
    }

    truckHit() {
        if (this.state !== 'play') return;
        this.shake = 0.12;
        SFX.play('boom');
        this.fail('car');
    }

    onBossEngage(bs) {
        this.activeBoss = bs;
        SFX.play('warn');
        this.hud.bossBanner(bs);
        const ratio = this.cat.w / bs.w;
        if (ratio < 0.75) this.say(`${bs.def.name}は ${bs.w}kg。今のままだとパンチが効かない`);
        else this.say(NARRATOR.pick(['ファイッ!', '猫同士の戦いが始まった', '縄張り争いだ']));
    }

    onBossDisengage(bs) {
        if (this.activeBoss === bs) this.activeBoss = null;
        this.say('逃げた。体力は回復された');
    }

    onBossDefeated(bs) {
        if (this.activeBoss === bs) this.activeBoss = null;
        Save.data.bosses[bs.id] = true;
        Save.save();
        SFX.play('clear');
        this.shake = 0.04;
        const n = BOSS_IDS.filter(id => Save.data.bosses[id]).length;
        this.hud.banner(`${bs.def.name} に勝った!!`, n >= 3 ? '神社の「町内会長の座」へ向かえ!' : `ボス ${n}/3`);
        this.say(n >= 3 ? '町のボスを全員倒した。神社へ!' : NARRATOR.pick(['デブの勝利', '体重は正義', '縄張りを奪った']));
    }

    // 場所ごとの仕掛け: バッジ・焼き台・町内会長の座
    updatePlaces(dt) {
        const c = this.cat;
        this.badges.forEach(bd => {
            if (!bd.alive) return;
            const dy = c.pos.y - bd.pos.y;
            if (Math.hypot(bd.pos.x - c.pos.x, bd.pos.z - c.pos.z) < 0.25 + c.r * 0.6 && dy > -0.35 && dy < 0.5) {
                bd.remove();
                Save.data.badges.push(bd.id);
                Save.save();
                SFX.play('pop');
                SFX.play('clear');
                this.hud.floatText(this.headPos(), `猫缶バッジ ゲット! ${Save.data.badges.length}/10`, '#ffd166', 26, 1.8);
                if (Save.data.badges.length >= 10) this.say('バッジ全部集めた。暇なの?');
            }
        });
        this.badges = this.badges.filter(b => b.alive);
        // 焼き台の上は熱い
        for (const g of this.sp.grills) {
            if (c.onGround && c.pos.y >= g.min.y - 0.05 && c.pos.x > g.min.x && c.pos.x < g.max.x && c.pos.z > g.min.z && c.pos.z < g.max.z && c.scaredT <= 0) {
                this.scare(-Math.PI / 2, 0.6, 'アチチッ!!', 1.5);
                this.sayOnce('grill', ['焼き猫になるところだった', '焼き台に乗るな']);
            }
        }
        // 町内会長の座
        const s = this.sp.seat;
        const onSeat = c.onGround && Math.abs(c.pos.y - s.y) < 0.06 && c.pos.x > s.x0 && c.pos.x < s.x1 && c.pos.z > s.z0 && c.pos.z < s.z1;
        if (onSeat) {
            const n = BOSS_IDS.filter(id => Save.data.bosses[id]).length;
            if (n < 3) {
                if (!c.seatMsg) {
                    c.seatMsg = true;
                    this.hud.floatText(this.headPos(), `まだ座る資格がない（ボス ${n}/3）`, '#ffffff', 22, 2);
                }
            } else {
                c.seatT += dt;
                if (c.seatT > 1.5 && !Save.data.cleared) this.ending();
            }
        } else {
            c.seatT = 0;
            c.seatMsg = false;
        }
    }

    // 住人・食べ物の復活・演出
    updateTown(dt) {
        const t = this.time;
        this.foods.forEach(f => {
            f.update(dt);
            if (f.life !== undefined) {
                f.life -= dt;
                if (f.life <= 0 && f !== this.cat.eatFood) f.remove();
            }
        });
        this.foods = this.foods.filter(f => f.alive);
        this.spawnRecs.forEach(r => {
            if (r.food) return;
            r.timer -= dt;
            if (r.timer > 0) return;
            if (Math.hypot(r.x - this.cat.pos.x, r.z - this.cat.pos.z) < 2) return;
            r.food = new Food(this.scene, r.type, r.x, r.y, r.z, r);
            this.foods.push(r.food);
        });
        this.badges.forEach(b => b.update(dt, t));
        this.trash.forEach(tc => tc.update(dt));
        this.mice = this.mice.filter(m => m.alive);
        this.mice.forEach(m => m.update(dt, this));
        this.mouseT -= dt;
        if (this.mice.length < this.sp.mice.count && this.mouseT <= 0) {
            this.mouseT = 20;
            this.mice.push(new Mouse(this.scene, this.sp.mice));
        }
        if (this.state === 'play') {
            this.crows.forEach(cr => cr.update(dt, this));
            this.dog.update(dt, this);
            this.humans.forEach(h => h.update(dt, this));
        }
        if (this.state !== 'idle') this.truck.update(dt, this);
        this.npcs.forEach(n => n.update(dt, this));
        Object.values(this.bosses).forEach(b => b.update(dt, this));
        // 扉のアニメーション
        const d = this.door;
        const target = d.open ? 1 : 0;
        d.k = (d.k || 0) + (target - (d.k || 0)) * Math.min(1, dt * 6);
        d.mesh.rotation.y = -d.k * 1.5;
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

    fail(reason) {
        if (this.state !== 'play') return;
        this.state = 'fail';
        Save.data.deaths++;
        Save.data.weight = CFG.START_WEIGHT;
        Save.save();
        const line = NARRATOR.death(reason, Save.data.deaths);
        this.say(line);
        SFX.play(reason === 'burst' ? 'boom' : 'fail');
        if (reason === 'burst' || reason === 'car') {
            this.shake = 0.1;
            this.model.root.visible = false;
            this.burstFx();
        }
        this.cat.stuck = reason === 'stuck';
        this.activeBoss = null;
        this.hud.showResult('fail', {
            title: DEATHS[reason] || '失敗',
            line: `天の声「${line}」`,
            stats: `体重 ${this.cat.w.toFixed(1)}kg　総失敗 ${Save.data.deaths} 回　（倒したボスと集めたバッジはそのまま）`,
            retryLabel: '家から再開'
        }, () => this.respawn(), null);
    }

    ending() {
        this.state = 'clear';
        Save.data.cleared = true;
        Save.save();
        SFX.play('clear');
        SFX.play('meow', 1.2);
        const mins = Math.floor(Save.data.playTime / 60), secs = Math.floor(Save.data.playTime % 60);
        this.hud.showResult('clear', {
            title: '町内会長 就任!!',
            line: '天の声「こうして町は、デブ猫が治めることになった」',
            stats: `プレイ時間 ${mins}分${secs}秒　体重 ${this.cat.w.toFixed(1)}kg　失敗 ${Save.data.deaths} 回　猫缶バッジ ${Save.data.badges.length}/10`,
            nextLabel: '散歩を続ける'
        }, null, () => {
            this.hud.hideResult();
            this.state = 'play';
            this.say('町内会長の見回りだ');
        });
    }

    // HUD 用: やることリスト
    objectives() {
        const b = Save.data.bosses;
        const list = BOSS_IDS.map(id => ({ label: `${BOSSES[id].name}（${BOSSES[id].w}kg）を倒す`, hint: `${BOSSES[id].where}。${BOSSES[id].hint}`, done: !!b[id] }));
        const all = list.every(o => o.done);
        list.push({ label: '神社の「町内会長の座」に座る', hint: all ? '神社は北の階段の上' : 'ボスを 3 匹倒してから', done: !!Save.data.cleared, locked: !all });
        return list;
    }

    // いちばん近い未達成の目標
    focusObjective(list) {
        if (list[3] && !list[3].locked && !list[3].done) return 3;
        let best = -1, bd = 1e9;
        BOSS_IDS.forEach((id, i) => {
            if (list[i].done) return;
            const b = this.bosses[id];
            const d = Math.hypot(b.pos.x - this.cat.pos.x, b.pos.z - this.cat.pos.z);
            if (d < bd) { bd = d; best = i; }
        });
        return best;
    }

    areaName() {
        const p = this.cat.pos;
        const a = this.sp.areas.find(a => p.x >= a.x0 && p.x <= a.x1 && p.z >= a.z0 && p.z <= a.z1 && (a.y === undefined || p.y >= a.y));
        return a ? a.name : '';
    }

    // ---------------------------------------------------------------- 見た目

    visualState() {
        const c = this.cat;
        return {
            w: c.vw, t: this.time,
            speed: Math.hypot(c.vel.x, c.vel.z),
            onGround: c.onGround,
            air: !c.onGround && c.airT > 0.06,
            airPitch: c.onGround ? 0 : Math.max(-0.4, Math.min(0.4, -c.vel.y * 0.08)),
            crouch: c.charging ? 0.5 + c.charge * 0.5 : 0,
            charge: c.charging ? c.charge : 0,
            squeeze: c.squeeze,
            punch: c.punchT > 0 ? 1 - c.punchT / 0.25 : 0,
            eating: c.eatT > 0,
            hack: c.hackT > 0,
            loaf: c.loaf && !c.sleeping,
            sleep: c.sleeping,
            high: c.high > 0,
            scared: c.scaredT > 0 ? 1 : 0,
            stuck: c.stuck,
            meow: c.meowT > 0,
            angry: !!this.activeBoss,
            lookYaw: c.lookYaw,
            height: 0
        };
    }

    syncModel() {
        const c = this.cat;
        const root = this.model.root;
        root.position.copy(c.pos);
        root.rotation.set(0, -c.heading, 0);
        const hack = c.hackT > 0 ? Math.sin(this.time * 30) * 0.03 : 0;
        const squash = c.stuck ? 1 + Math.sin(this.time * 25) * 0.04 : 1;
        root.scale.set(1 + hack, squash, 1);
    }

    placeCameraNow() {
        this.updateCamera(1, true);
    }

    // 三人称カメラ: 猫の後ろ上から。建物にめり込まないように手前に寄る
    updateCamera(dt, snap) {
        const c = this.cat;
        const { b, H } = this.dims();
        const dist = 1.0 + H * 2.2 + b.width * 1.6;
        const target = new THREE.Vector3(c.pos.x, c.pos.y + H * 0.8, c.pos.z);
        this.camTarget.lerp(target, snap ? 1 : Math.min(1, dt * 12));
        const dir = new THREE.Vector3(-Math.cos(this.pitch) * Math.cos(this.yaw), Math.sin(this.pitch), -Math.cos(this.pitch) * Math.sin(this.yaw));
        let d = dist;
        const hit = this.rayBoxes(this.camTarget, dir, dist);
        if (hit < d) d = Math.max(0.15, hit - 0.1);
        const want = this.camTarget.clone().addScaledVector(dir, d);
        want.y = Math.max(0.08, want.y);
        this.camPos.lerp(want, snap ? 1 : Math.min(1, dt * 14));
        const cam = this.camera;
        cam.position.copy(this.camPos);
        if (this.shake > 0) {
            cam.position.x += (Math.random() - 0.5) * this.shake;
            cam.position.y += (Math.random() - 0.5) * this.shake;
            this.shake = Math.max(0, this.shake - dt * 0.15);
        }
        cam.up.set(0, 1, 0);
        if (c.high > 0) cam.up.set(Math.sin(this.time * 1.7) * 0.12, 1, 0).normalize();
        cam.lookAt(this.camTarget);
        const fov = c.dashing ? 66 : 58;
        if (Math.abs(cam.fov - fov) > 0.1) {
            cam.fov += (fov - cam.fov) * Math.min(1, dt * 6);
            cam.updateProjectionMatrix();
        }
    }

    // 建物の箱にレイが当たる距離
    rayBoxes(o, d, maxT) {
        let best = maxT;
        const x0 = Math.min(o.x, o.x + d.x * maxT), x1 = Math.max(o.x, o.x + d.x * maxT);
        const z0 = Math.min(o.z, o.z + d.z * maxT), z1 = Math.max(o.z, o.z + d.z * maxT);
        for (const c of this.town.grid.query(x0, z0, x1, z1, this.near_)) {
            // 猫より低い生け垣や段差ではカメラを寄せない
            if (c.off || c.noCam || c.max.y < o.y + 0.35) continue;
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
            if (ok && t0 > 0.02 && t0 < best) best = t0;
        }
        return best;
    }

    // ---------------------------------------------------------------- 演出

    clawFx(pos, yaw) {
        const g = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
        for (let i = -1; i <= 1; i++) {
            const arc = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.005, 4, 16, 1.4), mat);
            arc.position.y = i * 0.04;
            arc.rotation.x = Math.PI / 2;
            g.add(arc);
        }
        g.position.copy(pos);
        g.rotation.y = -yaw + Math.PI * 0.8;
        this.scene.add(g);
        this.fx.push({ obj: g, t: 0, dur: 0.18, step: k => { mat.opacity = 0.9 * (1 - k); g.scale.setScalar(1 + k * 0.5); } });
    }

    burstFx() {
        const c = this.cat;
        const mat = toon(0xffd8a0);
        for (let i = 0; i < 40; i++) {
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.03 + Math.random() * 0.05, 6, 5), mat);
            m.position.copy(c.pos).setY(c.pos.y + 0.4);
            this.scene.add(m);
            const v = new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6);
            const floor = c.pos.y;
            this.fx.push({ obj: m, t: 0, dur: 2.5, step: (k, dt) => {
                v.y -= 9.8 * dt;
                m.position.addScaledVector(v, dt);
                if (m.position.y < floor + 0.02) { m.position.y = floor + 0.02; v.multiplyScalar(0.4); }
            } });
        }
    }

    updateFx(dt) {
        this.fx = this.fx.filter(f => {
            f.t += dt;
            f.step(Math.min(1, f.t / f.dur), dt);
            if (f.t >= f.dur) {
                this.scene.remove(f.obj);
                return false;
            }
            return true;
        });
    }
}
