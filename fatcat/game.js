// ゲームの中身: 猫の操作・当たり判定・食事・パンチ・詰まり・敵・ステージの目標・カメラ
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CFG, NARRATOR, DEATHS, Save } from './config.js';
import { SFX } from './audio.js';
import { ROOM } from './world.js';
import { PropSystem } from './props.js';
import { Mouse, Roomba, Food, Cucumber } from './entities.js';
import { STAGES } from './stages.js';

const UP = new THREE.Vector3(0, 1, 0);

export class Game {
    constructor({ scene, camera, world, colliders, holes, catModel, hud }) {
        this.scene = scene;
        this.camera = camera;
        this.world = world;
        this.staticColliders = colliders;
        this.holes = holes;
        this.model = catModel;
        this.hud = hud;
        this.props = new PropSystem(scene, world, (p, pos) => this.onBreak(p, pos));
        this.keys = {};
        this.yaw = -Math.PI / 2;
        this.pitch = 0.45;
        this.camPos = new THREE.Vector3(4, 1.5, 5);
        this.camTarget = new THREE.Vector3();
        this.shake = 0;
        this.state = 'idle';
        this.fx = [];

        // 猫の物理ボディ（キネマティック: 小物を押しのける）
        this.catBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
        this.world.addBody(this.catBody);
        this.catShapeW = -1;
    }

    // ---------------------------------------------------------------- ステージ

    load(index) {
        this.unload();
        this.index = index;
        const st = STAGES[index];
        this.stage = st;
        this.time = 0;
        this.damage = 0;
        this.eaten = {};
        this.bossEaten = false;
        this.narration = null;
        this.saidOnce = {};
        this.milestones = {};
        this.rainT = 1;
        this.mouseT = 3;
        this.state = 'play';
        this.result = null;

        const [sx, sz, heading] = st.start;
        this.cat = {
            pos: new THREE.Vector3(sx, 0, sz), vel: new THREE.Vector3(),
            heading, w: st.weight, vw: st.weight,
            onGround: true, squeeze: false, charge: 0, charging: false,
            punchT: 0, punchCd: 0, eatT: 0, eatFood: null, hackT: 0,
            idle: 0, loaf: false, sleeping: false, zzz: 0,
            high: 0, scaredT: 0, stuck: false, stuckT: 0, meowT: 0,
            airT: 0, fallV: 0, lookYaw: 0
        };
        this.yaw = heading;
        this.pitch = 0.42;

        (st.props || []).forEach(([type, x, y, z, rot, id]) => {
            const p = this.props.add(type, x, y, z, rot || 0);
            p.id = id;
        });
        this.props.updatePushable(this.cat.w);
        this.foods = (st.foods || []).map(([type, x, y, z]) => new Food(this.scene, type, x, y, z, Math.random() * 6));
        this.mice = [];
        for (let i = 0; i < (st.mice || 0); i++) this.spawnMouse(true);
        this.roombas = (st.roombas || []).map(([x, z]) => new Roomba(this.scene, x, z));
        this.boss = st.boss ? new Roomba(this.scene, st.boss[0], st.boss[1], st.boss[2], true) : null;
        this.cucumbers = (st.cucumbers || []).map(([x, z, r]) => new Cucumber(this.scene, x, z, r || 0));
        this.objectives = st.objectives.map(o => ({ ...o, done: false, timer: 0 }));

        this.updateCatShape();
        this.model.root.visible = true;
        this.model.update(this.visualState(0), 0);
        this.placeCameraNow();
        this.hud.startStage(st, index);
        this.say(NARRATOR.pick(['さあ、猫の時間だ', '今日も好き勝手に生きよう', '健康診断は来週です']));
    }

    unload() {
        this.props.clear();
        (this.foods || []).forEach(f => f.remove());
        (this.mice || []).forEach(m => m.remove());
        (this.roombas || []).forEach(r => r.remove());
        if (this.boss) this.boss.remove();
        (this.cucumbers || []).forEach(c => c.remove());
        this.fx.forEach(f => this.scene.remove(f.obj));
        this.foods = [];
        this.mice = [];
        this.roombas = [];
        this.boss = null;
        this.cucumbers = [];
        this.fx = [];
    }

    spawnMouse(anywhere) {
        let x, z;
        if (anywhere) {
            for (let k = 0; k < 20; k++) {
                x = 0.5 + Math.random() * 9;
                z = 0.5 + Math.random() * 6;
                if (!this.footprintBlocked(x, z, 0.05)) break;
            }
        } else {
            const h = this.holes[Math.floor(Math.random() * this.holes.length)];
            x = h.x + h.dir * 0.08;
            z = h.z;
        }
        this.mice.push(new Mouse(this.scene, x, z));
    }

    footprintBlocked(x, z, r) {
        return this.staticColliders.some(c => c.min.y < 0.3 && x > c.min.x - r && x < c.max.x + r && z > c.min.z - r && z < c.max.z + r);
    }

    // ---------------------------------------------------------------- 当たり判定

    get colliders() {
        return this.staticColliders;
    }

    dims() {
        const b = CFG.body(this.cat.w);
        return { b, r: Math.max(0.07, b.width / 2), H: b.height, hc: b.height * CFG.CROUCH_RATIO };
    }

    // 猫の箱 (足元 pos、半径 r、高さ h) が壁や家具に重なるか
    overlaps(pos, r, h) {
        const x0 = pos.x - r, x1 = pos.x + r, y0 = pos.y + 0.001, y1 = pos.y + h, z0 = pos.z - r, z1 = pos.z + r;
        if (x0 < 0 || x1 > ROOM.w || z0 < 0 || z1 > ROOM.d || y1 > ROOM.h) return true;
        for (const c of this.staticColliders) {
            if (x1 > c.min.x && x0 < c.max.x && y1 > c.min.y && y0 < c.max.y && z1 > c.min.z && z0 < c.max.z) return true;
        }
        for (const p of this.props.blockers()) {
            const b = p.body.position, s = p.def.size;
            if (x1 > b.x - s[0] / 2 && x0 < b.x + s[0] / 2 && y1 > b.y - s[1] / 2 && y0 < b.y + s[1] / 2 && z1 > b.z - s[2] / 2 && z0 < b.z + s[2] / 2) return true;
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
                // 小さな段差は乗り越える
                if (c.onGround) {
                    np.y += 0.05;
                    if (!this.overlaps(np, r, h)) {
                        c.pos.copy(np);
                        continue;
                    }
                }
            }
            return true;
        }
        return false;
    }

    // ---------------------------------------------------------------- 更新

    update(dt) {
        if (this.state === 'idle') return;
        const c = this.cat;
        if (this.state === 'play') {
            this.time += dt;
            this.updateCat(dt);
            if (this.state === 'play') this.updateEating(dt);
            if (this.state === 'play') this.updateWorldThings(dt);
            if (this.state === 'play') this.updateObjectives(dt);
            if (this.state === 'play' && this.stage.timeLimit && this.time >= this.stage.timeLimit) this.fail('time');
        }
        this.world.step(1 / 60, dt, 4);
        this.props.update(dt);
        this.updateCatBody(dt);
        this.updateFx(dt);
        c.vw += (c.w - c.vw) * Math.min(1, dt * 6);
        this.model.update(this.visualState(dt), dt);
        this.syncModel(dt);
        this.updateCamera(dt);
        this.hud.update(this, dt);
    }

    input() {
        const k = this.keys;
        let fx = 0, fz = 0;
        if (k.KeyW || k.ArrowUp) fz += 1;
        if (k.KeyS || k.ArrowDown) fz -= 1;
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
        const { b } = this.dims();
        c.punchT = Math.max(0, c.punchT - dt);
        c.punchCd -= dt;
        c.high = Math.max(0, c.high - dt);
        c.scaredT = Math.max(0, c.scaredT - dt);
        c.meowT = Math.max(0, c.meowT - dt);
        if (this.keys.ArrowLeft) this.yaw -= dt * 2;
        if (this.keys.ArrowRight) this.yaw += dt * 2;

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
        let spd = CFG.speed(c.w) * (this.keys.ShiftLeft || this.keys.ShiftRight ? 1.6 : 1) * (c.high > 0 ? 1.4 : 1);
        if (c.charging) spd *= 0.25;
        if (c.squeeze) spd *= 0.5;
        if (busy) spd = 0;
        const grip = c.onGround ? CFG.grip(c.w) : 1.5;
        const f = Math.min(1, grip * dt);
        c.vel.x += (dir.x * spd - c.vel.x) * f;
        c.vel.z += (dir.z * spd - c.vel.z) * f;

        if (c.charging) c.charge = Math.min(1, c.charge + dt / 0.6);

        // ボス戦: ルンバ大魔王に吸い寄せられる
        if (this.boss && this.boss.alive) {
            const d = new THREE.Vector3().subVectors(this.boss.pos, c.pos).setY(0);
            const dist = d.length();
            if (dist < this.boss.r + 1.2 && dist > 0.01) c.vel.addScaledVector(d.normalize(), 0.8 * dt);
        }

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
        let look = this.yaw - c.heading;
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
        if (c.pos.y < -1) c.pos.set(4, 0, 3.5);
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
        SFX.play('land', c.w);
        if (c.w >= 30 && impact > 3) {
            this.shake = Math.min(0.08, c.w / 1000);
            this.hud.floatText(c.pos.clone(), 'ドスン', '#ffd166', 22);
            // 重い着地は周りの小物を揺らす
            this.props.items.forEach(p => {
                if (p.broken || p.body.type !== CANNON.Body.DYNAMIC) return;
                const d = p.body.position.distanceTo(new CANNON.Vec3(c.pos.x, c.pos.y, c.pos.z));
                if (d < 1.2) {
                    p.body.wakeUp();
                    p.body.velocity.y += (1.2 - d) * c.w * 0.03;
                }
            });
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

    // 猫パンチ: 見ている方向の小物を叩き飛ばし、ネズミを仕留める
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
        const origin = c.pos.clone().addScaledVector(fwd, b.length * 0.35);
        const inReach = (p, extra) => {
            const d = new THREE.Vector3(p.x - origin.x, 0, p.z - origin.z);
            const dist = d.length();
            if (dist > reach + extra) return false;
            if (dist > 0.05 && d.normalize().dot(fwd) < 0.35) return false;
            return p.y > c.pos.y - 0.12 && p.y < c.pos.y + b.height + 0.25;
        };
        SFX.play('swipe');
        this.clawFx(origin.clone().addScaledVector(fwd, reach * 0.6).setY(c.pos.y + b.height * 0.7), this.yaw);
        let hit = false;
        this.props.items.forEach(p => {
            if (p.broken) return;
            const pos = p.body.position;
            if (!inReach(pos, Math.max(p.def.size[0], p.def.size[2] || p.def.size[0]) * 0.5)) return;
            this.props.impulse(p, fwd, CFG.punchPower(c.w));
            hit = true;
        });
        this.mice.forEach(m => {
            if (!m.alive || !inReach(m.pos, 0.05)) return;
            m.remove();
            this.foods.push(new Food(this.scene, 'mouse', m.pos.x, 0, m.pos.z, -m.dir));
            this.hud.floatText(m.pos.clone().setY(0.2), 'しとめた!', '#ffd166', 22);
            SFX.play('squeak');
            hit = true;
        });
        [...this.roombas, this.boss].forEach(r => {
            if (!r || !r.alive || !inReach(r.pos, r.r)) return;
            r.turn = 0.6;
            r.pos.addScaledVector(fwd, 0.08 + c.w * 0.004);
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
        const p = this.props.add('hairball', mouth.x, Math.max(0.02, mouth.y - 0.03), mouth.z);
        p.body.velocity.set(fwd.x * 1.5, 0.8, fwd.z * 1.5);
        this.hud.floatText(this.headPos(), `オエッ -${amt}kg`, '#c9a27e', 20);
        this.setWeight(c.w - amt, 'spit');
    }

    meow() {
        if (this.state !== 'play') return;
        const c = this.cat;
        this.wake();
        c.meowT = 0.5;
        SFX.play('meow', c.w > 40 ? 0.7 : 1.1);
        this.hud.floatText(this.headPos(), c.w > 40 ? 'ンナ゛ァ〜' : 'ニャー', '#ffffff', 22);
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
            if (dy < -0.1 || dy > b.height * 0.9) continue;
            const d = Math.hypot(f.pos.x - mouth.x, f.pos.z - mouth.z);
            if (d > 0.1 + b.head + b.width * 0.2) continue;
            c.eatT = f.type === 'toy' ? 0.2 : 0.45;
            c.eatFood = f;
            c.vel.x = c.vel.z = 0;
            this.wake();
            SFX.play('eat');
            return;
        }
        // ネズミは触れたら捕まえて食べる
        for (const m of this.mice) {
            if (!m.alive || c.pos.y > 0.1) continue;
            if (Math.hypot(m.pos.x - mouth.x, m.pos.z - mouth.z) < 0.08 + b.width * 0.3) {
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
        const done = !f.alive || f.bites <= 0;
        if (done) this.eaten[f.type] = (this.eaten[f.type] || 0) + 1;
        const pos = this.headPos();
        if (f.type === 'toy') {
            f.remove();
            SFX.play('meow', 1.3);
            this.hud.floatText(pos, 'おもちゃ ゲット!', '#3fdc7f', 24);
            return;
        }
        if (f.type === 'catnip') {
            c.high = CFG.HIGH_TIME;
            SFX.play('meow', 1.5);
            this.hud.floatText(pos, 'ニャハハハハ', '#a7c957', 26);
            this.say(NARRATOR.pick(NARRATOR.high));
        } else {
            SFX.play(kg >= 1 ? 'gulp' : 'eat');
            this.hud.floatText(pos, `${f.type === 'mouse' ? 'ムシャ' : 'モグ'} +${Math.round(kg * 10) / 10}kg`, '#ffd166', kg >= 1 ? 24 : 20);
        }
        if (done && f.type !== 'kibble') f.remove();
        this.setWeight(c.w + kg, 'eat');
    }

    setWeight(nw, cause) {
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
        this.props.updatePushable(nw);
        this.updateCatShape();
        if (grew) this.resolveGrow();
        else if (c.stuck) this.tryUnstuck();
    }

    // 太って家具にめり込んだら押し出す。出られなければ詰まる
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
        const b = CFG.body(c.w);
        if (Math.abs(this.catShapeW - c.w) < 0.05) return;
        this.catShapeW = c.w;
        while (this.catBody.shapes.length) this.catBody.removeShape(this.catBody.shapes[0]);
        this.catBody.addShape(new CANNON.Box(new CANNON.Vec3(b.length / 2, b.height / 2, Math.max(0.07, b.width / 2))));
    }

    updateCatBody() {
        const c = this.cat;
        if (!c) return;
        const b = CFG.body(c.w);
        const h = c.squeeze ? b.height * CFG.CROUCH_RATIO : b.height;
        this.catBody.position.set(c.pos.x, c.pos.y + h / 2, c.pos.z);
        this.catBody.velocity.set(c.vel.x, c.vel.y, c.vel.z);
        this.catBody.quaternion.setFromEuler(0, -c.heading, 0);
    }

    // ---------------------------------------------------------------- 周りのもの

    updateWorldThings(dt) {
        const c = this.cat;
        const { b, r } = this.dims();
        const t = this.time;

        this.foods.forEach(f => f.update(dt, t));
        this.mice = this.mice.filter(m => m.alive);
        this.mice.forEach(m => m.update(dt, this));
        this.mouseT -= dt;
        if (this.mouseT <= 0) {
            this.mouseT = 6;
            if (this.mice.length < (this.stage.mice || 0)) this.spawnMouse(false);
        }

        // ルンバ: 当たるとびっくりして跳ねる
        this.roombas.forEach(rb => {
            rb.update(dt, this);
            const d = Math.hypot(rb.pos.x - c.pos.x, rb.pos.z - c.pos.z);
            if (d < rb.r + r && c.pos.y < 0.12 && c.scaredT <= 0 && !c.stuck) {
                this.scare(Math.atan2(c.pos.z - rb.pos.z, c.pos.x - rb.pos.x), 0.45, 'フギャッ!!');
                rb.turn = 0.8;
            }
        });

        if (this.boss && this.boss.alive) this.updateBoss(dt);

        this.cucumbers.forEach(k => {
            k.cool -= dt;
            if (k.cool > 0 || c.airT > 0 || c.stuck) return;
            if (Math.hypot(k.pos.x - c.pos.x, k.pos.z - c.pos.z) > r + 0.28) return;
            k.cool = 2.5;
            this.scare(Math.atan2(c.pos.z - k.pos.z, c.pos.x - k.pos.x), 0.75, 'フギャーッ!!');
            this.sayOnce('scared', NARRATOR.scared);
        });

        // おやつの雨
        if (this.stage.rain) {
            this.rainT -= dt;
            if (this.rainT <= 0 && this.foods.filter(f => f.alive).length < 30) {
                this.rainT = this.stage.rain * (0.5 + Math.random());
                for (let k = 0; k < 10; k++) {
                    const x = 0.6 + Math.random() * 5, z = 1.3 + Math.random() * 5;
                    if (this.footprintBlocked(x, z, 0.1)) continue;
                    const f = new Food(this.scene, Math.random() < 0.3 ? 'fish' : 'treat', x, 0, z, Math.random() * 6);
                    f.falling = 1;
                    this.foods.push(f);
                    break;
                }
            }
        }
        this.foods = this.foods.filter(f => f.alive || f.type === 'kibble');
    }

    scare(angle, height, text) {
        const c = this.cat;
        this.wake();
        c.charging = false;
        c.eatT = 0;
        c.eatFood = null;
        c.scaredT = 1.2;
        c.vel.set(Math.cos(angle) * 2.2, Math.sqrt(2 * CFG.GRAVITY * height), Math.sin(angle) * 2.2);
        c.onGround = false;
        SFX.play('hiss');
        this.shake = 0.02;
        this.hud.floatText(this.headPos(), text, '#ff4d6d', 28);
    }

    updateBoss(dt) {
        const bs = this.boss;
        const c = this.cat;
        const { b } = this.dims();
        bs.update(dt, this);
        // 近くのおやつを吸い込んで大きくなる
        this.foods.forEach(f => {
            if (!f.alive || f.falling > 0 || f.pos.y > 0.05) return;
            const dx = bs.pos.x - f.pos.x, dz = bs.pos.z - f.pos.z;
            const d = Math.hypot(dx, dz);
            if (d > bs.r + 0.5) return;
            f.pos.x += dx / d * dt * 0.8;
            f.pos.z += dz / d * dt * 0.8;
            f.mesh.position.x = f.pos.x;
            f.mesh.position.z = f.pos.z;
            if (d < bs.r) {
                f.remove();
                bs.setRadius(Math.min(0.8, bs.r + 0.012));
                if ((this.bossMsgT || 0) < this.time) {
                    this.hud.floatText(bs.pos.clone().setY(0.4), 'ルンバが食べた', '#ff4d6d', 20);
                    this.bossMsgT = this.time + 1.5;
                }
            }
        });
        const d = Math.hypot(bs.pos.x - c.pos.x, bs.pos.z - c.pos.z);
        if (d < bs.r + b.width * 0.45 && c.pos.y < 0.3) {
            if (b.width > bs.r * 2) {
                // 丸のみ
                bs.remove();
                this.bossEaten = true;
                SFX.play('gulp');
                this.shake = 0.06;
                this.hud.floatText(this.headPos(), 'ルンバ大魔王 丸のみ!! +10kg', '#ffd166', 32);
                this.say('ルンバを食べる猫。前代未聞');
                this.setWeight(c.w + 10, 'eat');
            } else if ((this.bossHitT || 0) < this.time) {
                this.bossHitT = this.time + 1.2;
                this.scare(Math.atan2(c.pos.z - bs.pos.z, c.pos.x - bs.pos.x), 0.3, '吸われた! -2kg');
                this.setWeight(c.w - 2, 'sucked');
            }
        }
    }

    // ---------------------------------------------------------------- 目標

    updateObjectives(dt) {
        const c = this.cat;
        this.objectives.forEach(o => {
            if (o.done) return;
            switch (o.type) {
                case 'eat': o.done = (this.eaten[o.food] || 0) >= 1; break;
                case 'collect': o.done = (this.eaten[o.food] || 0) >= 1; break;
                case 'treats': o.done = (this.eaten.treat || 0) >= o.count; break;
                case 'damage': o.done = this.damage >= o.yen; break;
                case 'eatBoss': o.done = this.bossEaten; break;
                case 'knock':
                    o.done = o.ids.every(id => this.props.items.some(p => p.id === id && (p.broken || p.knocked)));
                    break;
                case 'stay': {
                    const [x0, y0, z0, x1, y1, z1] = o.region;
                    const inside = c.pos.x > x0 && c.pos.x < x1 && c.pos.y >= y0 && c.pos.y < y1 && c.pos.z > z0 && c.pos.z < z1 && c.onGround;
                    o.timer = inside ? o.timer + dt : 0;
                    if (o.timer >= o.secs) o.done = true;
                    break;
                }
            }
            if (o.done) {
                SFX.play('pop');
                this.hud.floatText(this.headPos(), `✔ ${o.label}`, '#3fdc7f', 22, 1.6);
            }
        });
        if (this.objectives.every(o => o.done)) this.clear();
    }

    onBreak(p, pos) {
        SFX.play('shatter');
        if (!p.def.price) return;
        this.damage += p.def.price;
        Save.data.damageTotal = (Save.data.damageTotal || 0) + p.def.price;
        this.hud.floatText(pos, `ガシャーン!! ${p.def.name} ¥${p.def.price.toLocaleString()}`, '#ff9aa8', p.def.price >= 50000 ? 26 : 20, 1.6);
        if (p.def.price >= 10000) this.say(NARRATOR.pick(NARRATOR.smash));
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
        Save.save();
        const line = NARRATOR.death(reason, Save.data.deaths);
        this.say(line);
        SFX.play(reason === 'burst' ? 'boom' : 'fail');
        if (reason === 'burst') {
            this.shake = 0.1;
            this.model.root.visible = false;
            this.burstFx();
        }
        this.cat.stuck = reason === 'stuck';
        this.hud.showResult('fail', {
            title: DEATHS[reason] || '失敗',
            line: `天の声「${line}」`,
            stats: `体重 ${this.cat.w.toFixed(1)}kg　被害総額 ¥${this.damage.toLocaleString()}　総失敗 ${Save.data.deaths} 回`
        }, () => this.onRetry && this.onRetry(), null);
    }

    clear() {
        if (this.state !== 'play') return;
        this.state = 'clear';
        Save.data.unlocked = Math.max(Save.data.unlocked, Math.min(this.index + 1, STAGES.length - 1));
        const best = Save.data.best[this.index];
        const newBest = !best || this.time < best;
        if (newBest) Save.data.best[this.index] = this.time;
        Save.save();
        SFX.play('clear');
        SFX.play('meow', 1.2);
        const line = NARRATOR.pick(NARRATOR.clear);
        this.say(line);
        const last = this.index + 1 >= STAGES.length;
        this.hud.showResult('clear', {
            title: last ? '全ステージクリア!!' : 'STAGE CLEAR!',
            line: `天の声「${line}」`,
            stats: `タイム ${this.time.toFixed(1)}秒${newBest ? '（自己ベスト!）' : ''}　体重 ${this.cat.w.toFixed(1)}kg　被害総額 ¥${this.damage.toLocaleString()}`,
            nextLabel: last ? 'タイトルへ' : '次のステージ'
        }, () => this.onRetry && this.onRetry(), () => this.onNext && this.onNext());
    }

    // ---------------------------------------------------------------- 見た目

    visualState() {
        const c = this.cat;
        const b = CFG.body(c.vw);
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
            lookYaw: c.lookYaw,
            height: c.onGround ? 0 : 0
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

    // 三人称カメラ: 猫の後ろ上から。壁や家具にめり込まないように手前に寄る
    updateCamera(dt, snap) {
        const c = this.cat;
        const { b, H } = this.dims();
        const dist = 0.7 + H * 1.8 + b.width * 1.5;
        const target = new THREE.Vector3(c.pos.x, c.pos.y + H * 0.7, c.pos.z);
        this.camTarget.lerp(target, snap ? 1 : Math.min(1, dt * 12));
        const dir = new THREE.Vector3(-Math.cos(this.pitch) * Math.cos(this.yaw), Math.sin(this.pitch), -Math.cos(this.pitch) * Math.sin(this.yaw));
        let d = dist;
        const hit = this.rayBoxes(this.camTarget, dir, dist);
        if (hit < d) d = Math.max(0.15, hit - 0.08);
        const want = this.camTarget.clone().addScaledVector(dir, d);
        want.x = Math.max(0.08, Math.min(ROOM.w - 0.08, want.x));
        want.z = Math.max(0.08, Math.min(ROOM.d - 0.08, want.z));
        want.y = Math.max(0.08, Math.min(ROOM.h - 0.08, want.y));
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
    }

    // 家具や壁の箱にレイが当たる距離
    rayBoxes(o, d, maxT) {
        let best = maxT;
        for (const c of this.staticColliders) {
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
            const arc = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.004, 4, 16, 1.4), mat);
            arc.position.y = i * 0.035;
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
        const mat = new THREE.MeshStandardMaterial({ color: 0xd98a3d, roughness: 1 });
        for (let i = 0; i < 40; i++) {
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.03 + Math.random() * 0.05, 6, 5), mat);
            m.position.copy(c.pos).setY(c.pos.y + 0.4);
            this.scene.add(m);
            const v = new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6);
            this.fx.push({ obj: m, t: 0, dur: 2.5, step: (k, dt) => {
                v.y -= 9.8 * dt;
                m.position.addScaledVector(v, dt);
                if (m.position.y < 0.02) { m.position.y = 0.02; v.multiplyScalar(0.4); }
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
