// 町の猫たち: ヒントをくれる猫と、縄張りを守るボス猫
import * as THREE from 'three';
import { CFG, BOSSES } from './config.js';
import { CatModel } from './catmodel.js';

function turnTo(cur, target, k) {
    let d = target - cur;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return cur + d * Math.min(1, k);
}

// ---------------------------------------------------------------- 話しかけると教えてくれる猫

export class NpcCat {
    constructor(scene, def) {
        this.def = def;
        this.model = new CatModel(def.palette);
        this.w = 5;
        this.home = new THREE.Vector3(def.x, 0, def.z);
        this.pos = this.home.clone();
        this.heading = Math.random() * Math.PI * 2;
        this.target = null;
        this.t = 2 + Math.random() * 3;
        this.line = 0;
        this.greeted = false;
        this.talkT = 0;
        this.speed = 0;
        scene.add(this.model.root);
        this.model.root.position.copy(this.pos);
        this.model.update({ w: this.w, t: 0, speed: 0, onGround: true, loaf: true }, 0);
    }

    talk(game) {
        const text = this.def.lines[this.line % this.def.lines.length];
        this.line++;
        this.talkT = 0.5;
        game.hud.bubble(this, text, 5);
        game.sfx('meowNpc');
    }

    update(dt, game) {
        const c = game.cat;
        const d = Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z);
        this.t -= dt;
        this.talkT = Math.max(0, this.talkT - dt);
        if (!this.greeted && d < 2.2 && Math.abs(c.pos.y) < 0.5) {
            this.greeted = true;
            this.talk(game);
        }
        let want = this.heading;
        this.speed = 0;
        if (d < 3) {
            want = Math.atan2(c.pos.z - this.pos.z, c.pos.x - this.pos.x);
            this.target = null;
        } else if (this.target) {
            const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
            if (Math.hypot(dx, dz) < 0.1) this.target = null;
            else {
                want = Math.atan2(dz, dx);
                this.speed = 0.6;
            }
        } else if (this.t <= 0) {
            this.t = 3 + Math.random() * 5;
            const a = Math.random() * Math.PI * 2;
            this.target = this.home.clone().add(new THREE.Vector3(Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2));
        }
        this.heading = turnTo(this.heading, want, dt * 5);
        this.pos.x += Math.cos(this.heading) * this.speed * dt;
        this.pos.z += Math.sin(this.heading) * this.speed * dt;
        const root = this.model.root;
        root.position.copy(this.pos);
        root.rotation.y = -this.heading;
        const visible = game.near(this.pos, 30);
        root.visible = visible;
        if (visible) {
            this.model.update({
                w: this.w, t: game.time, speed: this.speed, onGround: true,
                loaf: !this.target && d > 3, meow: this.talkT > 0, happy: d < 3 && this.talkT <= 0
            }, dt);
        }
    }
}

// ---------------------------------------------------------------- ボス猫

const TAUNT = {
    mike: ['ここはあたしの屋上だよ。降りな', 'あら、かわいい子。でも容赦しないよ'],
    buchi: ['砂場はオレの縄張りだ!!', 'ブチ様の砂場に何の用だ'],
    kuro: ['…誰だ。路地裏に入ってきたのは', '…出口はない。痩せて帰れ']
};
const LOSE = {
    mike: '…やるじゃないか。屋上は好きに使いな',
    buchi: '…参った。腹減ったから寝る',
    kuro: '…フン。認めてやる'
};
const WIN_IDLE = {
    mike: ['いい眺めだろ?', '町内会長の座は神社の上さ'],
    buchi: ['次は負けねえ…Zzz', '腹減った'],
    kuro: ['…扉は重い。35kg だ', '…悪くない腹だ']
};

export class BossCat {
    constructor(scene, id, spawn, defeated) {
        this.id = id;
        this.def = BOSSES[id];
        this.w = this.def.w;
        this.spawn = spawn;
        this.arena = spawn.arena;
        this.model = new CatModel(this.def.palette);
        this.pos = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
        this.heading = Math.PI / 2;
        this.hp = 100;
        this.state = defeated ? 'defeated' : 'idle';
        this.fighting = false;
        this.t = 0;
        this.flinch = 0;
        this.hop = 0;
        this.leaveT = 0;
        this.vel = new THREE.Vector3();
        this.idleLine = 0;
        scene.add(this.model.root);
        this.model.root.position.copy(this.pos);
        this.model.update({ w: this.w, t: 0, speed: 0, onGround: true, loaf: defeated, happy: defeated }, 0);
    }

    get r() {
        return CFG.body(this.w).width / 2;
    }

    inArena(p, margin = 0.6) {
        const [x0, z0, x1, z1] = this.arena;
        return p.x > x0 - margin && p.x < x1 + margin && p.z > z0 - margin && p.z < z1 + margin && Math.abs(p.y - this.pos.y) < 0.9;
    }

    // 猫パンチを受けた。体重の比でダメージが決まる
    takeHit(game, fwd) {
        const ratio = game.cat.w / this.w;
        let dmg = ratio < 0.75 ? 1 : 12 * Math.min(2.5, ratio * ratio);
        if (this.state === 'rest') dmg *= 1.5;
        this.hp = Math.max(0, this.hp - dmg);
        this.flinch = 0.3;
        const push = ratio < 0.75 ? 0.03 : 0.12 * Math.min(2.5, ratio);
        this.pos.x += fwd.x * push;
        this.pos.z += fwd.z * push;
        if (ratio < 0.75) game.hud.floatText(this.headPos(), '効いてない…（体重が足りない）', '#ffffff', 20);
        else game.hud.floatText(this.headPos(), `-${Math.round(dmg)}`, '#ffd166', 26);
        if (!this.fighting) this.engage(game);
        if (this.hp <= 0) this.lose(game);
    }

    engage(game) {
        this.fighting = true;
        this.state = 'approach';
        this.t = 0.5;
        const list = TAUNT[this.id];
        game.hud.bubble(this, list[Math.floor(Math.random() * list.length)], 3.5);
        game.onBossEngage(this);
    }

    lose(game) {
        this.state = 'defeated';
        this.fighting = false;
        game.hud.bubble(this, LOSE[this.id], 5);
        game.onBossDefeated(this);
    }

    talk(game) {
        if (this.state !== 'defeated') return;
        const list = WIN_IDLE[this.id];
        game.hud.bubble(this, list[this.idleLine++ % list.length], 4);
    }

    headPos() {
        const b = CFG.body(this.w);
        return this.pos.clone().setY(this.pos.y + b.height + 0.1);
    }

    update(dt, game) {
        const c = game.cat;
        const toCat = new THREE.Vector3(c.pos.x - this.pos.x, 0, c.pos.z - this.pos.z);
        const d = toCat.length();
        this.t -= dt;
        this.flinch = Math.max(0, this.flinch - dt);
        let speed = 0;
        let want = this.heading;
        const catIn = this.inArena(c.pos) && game.state === 'play';

        if (this.state === 'defeated') {
            if (d < 3) want = Math.atan2(toCat.z, toCat.x);
        } else if (!this.fighting) {
            if (catIn && d < 6) this.engage(game);
            // 縄張りをゆっくり見回る
            want = Math.sin(game.time * 0.3 + this.w) * Math.PI;
            speed = 0.25;
        } else {
            if (!catIn) {
                this.leaveT += dt;
                if (this.leaveT > 2.5) {
                    // 逃げたら体力は元どおり
                    this.fighting = false;
                    this.hp = 100;
                    this.state = 'idle';
                    game.onBossDisengage(this);
                }
            } else this.leaveT = 0;
            switch (this.state) {
                case 'approach':
                    want = Math.atan2(toCat.z, toCat.x);
                    speed = d > 0.9 + this.r ? 1.6 : 0;
                    if (this.t <= 0 && d < 2.2 + this.r && catIn) {
                        this.state = 'windup';
                        this.t = 0.55;
                    }
                    break;
                case 'windup':
                    want = Math.atan2(toCat.z, toCat.x);
                    if (this.t <= 0) {
                        this.state = 'leap';
                        this.t = 0.38;
                        this.hit = false;
                        this.vel.set(Math.cos(this.heading), 0, Math.sin(this.heading)).multiplyScalar(Math.min(6, 2 + d * 2.2));
                        game.sfx('hiss');
                    }
                    break;
                case 'leap':
                    this.pos.addScaledVector(this.vel, dt);
                    this.hop = Math.sin(Math.PI * (1 - this.t / 0.38)) * 0.25;
                    if (!this.hit && d < this.r + c.r + 0.1 && Math.abs(c.pos.y - this.pos.y) < 0.6) {
                        this.hit = true;
                        game.bossHit(this);
                    }
                    if (this.t <= 0) {
                        this.state = 'rest';
                        this.t = 1.0;
                        this.hop = 0;
                    }
                    break;
                case 'rest':
                    if (this.t <= 0) {
                        this.state = 'approach';
                        this.t = 0.8 + Math.random() * 0.8;
                    }
                    break;
            }
        }
        this.heading = turnTo(this.heading, want, dt * (this.state === 'windup' ? 12 : 6));
        this.pos.x += Math.cos(this.heading) * speed * dt;
        this.pos.z += Math.sin(this.heading) * speed * dt;
        const [x0, z0, x1, z1] = this.arena;
        const r = this.r;
        this.pos.x = Math.max(x0 + r, Math.min(x1 - r, this.pos.x));
        this.pos.z = Math.max(z0 + r, Math.min(z1 - r, this.pos.z));

        const root = this.model.root;
        root.position.set(this.pos.x, this.pos.y + this.hop, this.pos.z);
        root.rotation.y = -this.heading;
        root.visible = game.near(this.pos, 35);
        if (root.visible) {
            const look = Math.atan2(toCat.z, toCat.x) - this.heading;
            this.model.update({
                w: this.w, t: game.time, speed, onGround: this.hop === 0,
                air: this.hop > 0.02,
                crouch: this.state === 'windup' ? 0.8 : 0,
                charge: this.state === 'windup' ? 1 : 0,
                scared: this.flinch > 0,
                angry: this.fighting,
                loaf: this.state === 'defeated' && d > 1.2,
                happy: this.state === 'defeated',
                punch: 0,
                lookYaw: Math.atan2(Math.sin(look), Math.cos(look)) * 0.5
            }, dt);
        }
    }
}
