// メインのゲームシーン
// 猫の移動・壁判定は自前（詰まり判定を正確にするため）、敵と毛玉は Arcade Physics。

// grid の値
const G_FLOOR = 0, G_WALL = 1, G_GATE = 2, G_FRAGILE = 5, G_PIT = 6, G_BOX = 7, G_CRACK = 8, G_SHELF = 9;

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data) {
        this.stageIndex = data.stage || 0;
        this.level = LEVELS[this.stageIndex];
    }

    create() {
        this.state = 'play';
        this.deathReason = null;
        this.stageTime = 0;
        this.spitTimer = 0;
        this.msgCooldown = 0;
        this.warnTimer = 0;
        this.rainTimer = 1;
        this.damage = 0;
        this.items = [];
        this.holes = [];
        this.props = [];
        this.cucumbers = [];
        this.gateOpen = false;
        this.boss = null;
        this.bossDefeated = false;
        this.vac = null;
        this.narration = null;
        this.milestonesHit = {};
        this.saidOnce = {};

        this.parseLevel();
        this.buildMap();
        this.createGroups();
        this.createCat();
        this.spawnEntities();
        this.createSigns();
        this.createVacuum();
        this.setupInput();
        this.setupCamera();

        this.scene.stop('HudScene');
        this.scene.launch('HudScene');
        this.say(NARRATOR.pick(NARRATOR.start));
    }

    // ---------------------------------------------------------------- マップ

    parseLevel() {
        const rows = this.level.map;
        const codes = { '#': G_WALL, 'W': G_GATE, '~': G_FRAGILE, '=': G_BOX, '_': G_SHELF };
        this.H = rows.length;
        this.W = Math.max(...rows.map(r => r.length));
        this.grid = [];
        this.gateTiles = [];
        this.spawns = [];
        for (let y = 0; y < this.H; y++) {
            const row = [];
            for (let x = 0; x < this.W; x++) {
                const ch = rows[y][x] || '#';
                let t = ch in codes ? codes[ch] : G_FLOOR;
                if (FC.PROPS[ch]) t = G_SHELF;
                if (t === G_GATE) this.gateTiles.push({ x, y });
                if (!(ch in codes) && ch !== '.') this.spawns.push({ ch, x, y });
                row.push(t);
            }
            this.grid.push(row);
        }
    }

    tileIndex(v, x, y) {
        if (v === G_FLOOR) return (x + y) % 2 ? 4 : 0;
        if (v === G_GATE) return this.gateOpen ? 3 : 2;
        return v;
    }

    buildMap() {
        const T = FC.TILE;
        const data = this.grid.map((row, y) => row.map((v, x) => this.tileIndex(v, x, y)));
        this.map = this.make.tilemap({ data, tileWidth: T, tileHeight: T });
        const tileset = this.map.addTilesetImage('fc_tiles', 'fc_tiles_x', T, T, 1, 2);
        this.layer = this.map.createLayer(0, tileset, 0, 0);
        this.layer.setCollision([G_WALL, G_GATE, G_BOX, G_SHELF]);
        this.worldW = this.W * T;
        this.worldH = this.H * T;
        this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

        if (this.gateTiles.length) {
            const top = this.gateTiles.reduce((a, b) => (b.y < a.y ? b : a));
            this.gateLabel = this.add.text((top.x + 0.5) * T, top.y * T - 6, '', {
                fontFamily: FONT, fontSize: '18px', color: '#ff4d6d', fontStyle: 'bold',
                backgroundColor: '#000000cc', padding: { x: 6, y: 3 }
            }).setOrigin(0.5, 1).setDepth(15);
            this.refreshGateLabel();
        }
    }

    setTile(tx, ty, v) {
        this.grid[ty][tx] = v;
        this.layer.putTileAt(this.tileIndex(v, tx, ty), tx, ty);
    }

    gridAt(x, y) {
        const tx = Math.floor(x / FC.TILE), ty = Math.floor(y / FC.TILE);
        if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return G_WALL;
        return this.grid[ty][tx];
    }

    solid(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return true;
        const v = this.grid[ty][tx];
        return v === G_WALL || v === G_BOX || v === G_SHELF || (v === G_GATE && !this.gateOpen);
    }

    solidAt(x, y) {
        return this.solid(Math.floor(x / FC.TILE), Math.floor(y / FC.TILE));
    }

    // 直径 d の猫の足元のタイルを順に fn に渡す。fn が false を返したら中断して false
    footprint(x, y, d, fn) {
        const T = FC.TILE;
        const h = d / 2 - 0.01;
        const x0 = Math.floor((x - h) / T), x1 = Math.floor((x + h) / T);
        const y0 = Math.floor((y - h) / T), y1 = Math.floor((y + h) / T);
        for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
                if (fn(tx, ty) === false) return false;
            }
        }
        return true;
    }

    fits(x, y, d) {
        return this.footprint(x, y, d, (tx, ty) => !this.solid(tx, ty));
    }

    // 壁を突き抜けずに行ける近くの空き位置を探す
    findFreeNear(x, y, d, maxR) {
        for (let r = 2; r <= maxR; r += 2) {
            for (let k = 0; k < 16; k++) {
                const a = (k / 16) * Math.PI * 2;
                const nx = x + Math.cos(a) * r;
                const ny = y + Math.sin(a) * r;
                if (!this.fits(nx, ny, d)) continue;
                let clear = true;
                for (let s = 4; s < r; s += 4) {
                    if (this.solidAt(x + Math.cos(a) * s, y + Math.sin(a) * s)) { clear = false; break; }
                }
                if (clear) return { x: nx, y: ny };
            }
        }
        return null;
    }

    updateGate() {
        if (!this.level.gateWeight) return;
        const open = this.cat.w >= this.level.gateWeight;
        if (open === this.gateOpen) return;
        this.gateOpen = open;
        this.gateTiles.forEach(g => this.setTile(g.x, g.y, G_GATE));
        this.refreshGateLabel();
        SFX.play('gate');
        if (!open && !this.fits(this.cat.x, this.cat.y, this.cat.d)) this.die('door');
    }

    refreshGateLabel() {
        if (!this.gateLabel) return;
        const w = this.level.gateWeight;
        this.gateLabel.setText(this.gateOpen ? `OPEN (${w}kg以上)` : `${w}kg以上で開く`);
        this.gateLabel.setColor(this.gateOpen ? '#3fdc7f' : '#ff4d6d');
    }

    breakBox(tx, ty) {
        if (this.grid[ty][tx] !== G_BOX) return;
        this.setTile(tx, ty, G_FLOOR);
        this.puff((tx + 0.5) * FC.TILE, (ty + 0.5) * FC.TILE, 40, 0xc49a5c);
    }

    crackFloor(tx, ty) {
        if (this.grid[ty][tx] !== G_FRAGILE) return;
        this.setTile(tx, ty, G_CRACK);
        SFX.play('crack');
        this.time.delayedCall(170, () => {
            if (this.grid[ty][tx] === G_CRACK) this.setTile(tx, ty, G_PIT);
        });
    }

    // ---------------------------------------------------------------- 生成

    createGroups() {
        this.enemies = this.physics.add.group();
        this.hairballs = this.physics.add.group();

        this.physics.add.collider(this.enemies, this.layer);
        this.physics.add.collider(this.hairballs, this.layer, h => this.landHairball(h));
        this.physics.add.overlap(this.hairballs, this.enemies, (h, e) => {
            if (!h.active || !e.active) return;
            this.damageEnemy(e, h.amt * 12);
            this.landHairball(h);
        });
    }

    createCat() {
        const T = FC.TILE;
        const p = this.spawns.find(s => s.ch === 'P');
        const w = FC.START_WEIGHT;
        this.cat = {
            x: (p.x + 0.5) * T, y: (p.y + 0.5) * T,
            w, d: FC.diameter(w),
            vx: 0, vy: 0, kbx: 0, kby: 0,
            heading: 0, aim: 0, invuln: 0, walk: 0,
            air: null, pressAt: null, crouch: 0,
            punchT: 0, punchCd: 0,
            idle: 0, sleeping: false, zzz: 0,
            high: 0, scaredT: 0,
            stuck: false, stuckTimer: 0
        };
        this.catShadow = this.add.ellipse(this.cat.x, this.cat.y, 10, 10, 0x000000, 0.3).setDepth(9);
        this.catGfx = this.add.graphics().setDepth(10);
    }

    spawnEntities() {
        const T = FC.TILE;
        this.spawns.forEach(s => {
            const x = (s.x + 0.5) * T;
            const y = (s.y + 0.5) * T;
            if (FC.PROPS[s.ch]) {
                this.spawnProp(s.ch, x, y);
                return;
            }
            switch (s.ch) {
                case 'm': this.spawnEnemy('mouse', x, y); break;
                case 'd': this.spawnEnemy('dog', x, y); break;
                case 'D': this.spawnEnemy('bigdog', x, y); break;
                case 'B': this.boss = this.spawnEnemy('boss', x, y); break;
                case 'R': this.boss = this.spawnEnemy('roomba', x, y); break;
                case 'f': this.addItem(x, y, 1); break;
                case 'F': this.addItem(x, y, 3); break;
                case 'c': this.addItem(x, y, 0.2, 0, 'catnip'); break;
                case 'k':
                    this.cucumbers.push({ x, y, cool: 0, s: this.add.image(x, y, 'fc_cucumber').setDepth(4).setRotation(Math.random() * Math.PI) });
                    break;
                case 'h':
                    this.add.image(x, y, 'fc_hole').setDepth(2);
                    this.holes.push({ x, y, t: 2 + Math.random() * 2, mice: [] });
                    break;
                case 'G':
                    this.goal = { x, y };
                    this.add.image(x, y, 'fc_house').setDepth(3);
                    this.goalLabel = this.add.text(x, y - 46, 'GOAL', {
                        fontFamily: FONT, fontSize: '20px', color: '#ffd166', fontStyle: 'bold',
                        stroke: '#000', strokeThickness: 4
                    }).setOrigin(0.5).setDepth(15);
                    this.tweens.add({ targets: this.goalLabel, y: y - 52, yoyo: true, repeat: -1, duration: 600 });
                    break;
            }
        });
        if (this.boss) this.goalLabel.setText(`${this.level.bossName}を倒せ`).setColor('#ff4d6d');
    }

    spawnProp(ch, x, y) {
        const def = FC.PROPS[ch];
        const s = this.add.image(x, y, def.tex).setDepth(5).setRotation((Math.random() - 0.5) * 0.6);
        this.props.push({ x, y, s, def, alive: true });
    }

    spawnEnemy(kind, x, y) {
        const def = FC.ENEMIES[kind];
        const e = this.enemies.create(x, y, def.tex);
        const r = def.bodyR || def.size / 2;
        e.body.setCircle(r, e.width / 2 - r, e.height / 2 - r);
        e.setDepth(def.boss ? 9 : 6);
        e.kind = kind;
        e.def = def;
        e.size = def.size;
        e.hp = def.hp;
        e.maxHp = def.hp;
        e.stun = 0;
        e.wanderT = 0;
        e.wanderA = Math.random() * Math.PI * 2;
        e.chargeCd = 2.5;
        e.windup = 0;
        e.charge = 0;
        if (def.bodyR) e.setScale(e.size / (def.bodyR * 2));
        return e;
    }

    // kind: 'fish'（体重が増える）/ 'mouse'（仕留めたネズミ）/ 'catnip'（またたび）
    addItem(x, y, value, delay = 0, kind = 'fish') {
        const tex = kind === 'catnip' ? 'fc_catnip' : kind === 'mouse' ? 'fc_mouse' : value >= 3 ? 'fc_fish_gold' : 'fc_fish';
        const s = this.add.image(x, y, tex).setDepth(4);
        s.setScale(kind === 'fish' ? Math.min(2.4, 0.6 + value * 0.25) : 1.1);
        if (kind === 'mouse') s.setFlipY(true);
        this.tweens.add({ targets: s, y: y - 4, yoyo: true, repeat: -1, duration: 500 + Math.random() * 300 });
        const it = { s, value, kind, ready: this.stageTime + delay };
        this.items.push(it);
        return it;
    }

    createSigns() {
        const T = FC.TILE;
        (this.level.signs || []).forEach(([x, y, text]) => {
            this.add.text(x * T + 4, y * T + 4, text, {
                fontFamily: FONT, fontSize: '16px', color: '#ffffff',
                backgroundColor: '#000000aa', padding: { x: 8, y: 5 }, lineSpacing: 4
            }).setDepth(14);
        });
    }

    createVacuum() {
        const v = this.level.vacuum;
        if (!v) return;
        this.vac = { x: -140, speed: v.speed, delay: v.delay };
        this.vacGfx = this.add.graphics().setDepth(20);
        this.vacText = this.add.text(0, 0, '掃\n除\n機', {
            fontFamily: FONT, fontSize: '40px', color: '#ff4d6d', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 6, align: 'center'
        }).setOrigin(1, 0.5).setDepth(21);
    }

    setupInput() {
        this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,R,ESC,M,ENTER,E');
        this.input.mouse.disableContextMenu();
        // 左クリック: 短く押すと猫パンチ、長押しして離すと飛びかかり
        this.input.on('pointerdown', p => {
            SFX.init();
            if (p.button !== 0 || this.state !== 'play') return;
            this.cat.pressAt = this.stageTime;
            this.wake();
        });
        this.input.on('pointerup', p => {
            if (p.button !== 0) return;
            const c = this.cat;
            if (this.state !== 'play' || c.pressAt === null) {
                c.pressAt = null;
                return;
            }
            const held = this.stageTime - c.pressAt;
            c.pressAt = null;
            if (held < FC.POUNCE_HOLD) this.punch();
            else this.pounce(Math.min(1, (held - FC.POUNCE_HOLD) / FC.POUNCE_CHARGE));
        });
        this.keys.R.on('down', () => this.retry());
        this.keys.ESC.on('down', () => {
            this.scene.stop('HudScene');
            this.scene.start('TitleScene');
        });
        this.keys.M.on('down', () => { SFX.muted = !SFX.muted; });
        this.keys.E.on('down', () => this.meow());
        const advance = () => {
            SFX.init();
            if (this.state === 'dead') this.retry();
            else if (this.state === 'clear') this.nextStage();
        };
        this.keys.SPACE.on('down', advance);
        this.keys.ENTER.on('down', advance);
    }

    setupCamera() {
        const cam = this.cameras.main;
        cam.setZoom(1.6);
        cam.startFollow(this.catGfx, true, 0.12, 0.12);
        cam.setBackgroundColor('#2a2018');
    }

    say(text) {
        this.narration = { text, at: this.time.now };
    }

    sayOnce(key, list) {
        if (this.saidOnce[key]) return;
        this.saidOnce[key] = true;
        this.say(NARRATOR.pick(list));
    }

    // ---------------------------------------------------------------- ループ

    update(time, deltaMs) {
        const dt = Math.min(deltaMs / 1000, 0.1);
        if (this.state === 'play') {
            this.stageTime += dt;
            this.msgCooldown -= dt;
            this.updateCat(dt);
            this.updateEnemies(dt);
            this.updateHairballs(dt);
            if (this.state === 'play') this.updateItems();
            if (this.state === 'play') this.updateCucumbers(dt);
            this.updateHoles(dt);
            this.updateFishRain(dt);
            this.updateVacuum(dt);
            if (this.state === 'play') this.checkGoal();
            this.updateCameraZoom(dt);
        }
        this.renderCat(dt);
    }

    updateCat(dt) {
        const c = this.cat;
        const k = this.keys;
        const p = this.input.activePointer;
        const wp = this.cameras.main.getWorldPoint(p.x, p.y);
        c.aim = Math.atan2(wp.y - c.y, wp.x - c.x);
        c.invuln = Math.max(0, c.invuln - dt);
        c.punchT = Math.max(0, c.punchT - dt);
        c.punchCd -= dt;
        c.high = Math.max(0, c.high - dt);
        c.scaredT = Math.max(0, c.scaredT - dt);
        c.crouch = c.pressAt !== null && this.stageTime - c.pressAt >= FC.POUNCE_HOLD
            ? Math.min(1, (this.stageTime - c.pressAt - FC.POUNCE_HOLD) / FC.POUNCE_CHARGE + 0.2)
            : 0;

        if (c.w >= FC.BURST_WARN) {
            this.warnTimer -= dt;
            if (this.warnTimer <= 0) {
                SFX.play('warn');
                this.warnTimer = 0.5;
            }
        }

        this.spitTimer -= dt;
        if ((k.SPACE.isDown || p.rightButtonDown()) && this.spitTimer <= 0) {
            this.spitTimer = FC.SPIT_INTERVAL;
            this.wake();
            this.spit();
            if (this.state !== 'play') return;
        }

        if (c.stuck) {
            c.stuckTimer -= dt;
            if (c.stuckTimer <= 0) this.die('stuck');
            return;
        }

        if (c.air) {
            this.updateAir(dt);
            return;
        }

        let ix = 0, iy = 0;
        if (k.A.isDown || k.LEFT.isDown) ix -= 1;
        if (k.D.isDown || k.RIGHT.isDown) ix += 1;
        if (k.W.isDown || k.UP.isDown) iy -= 1;
        if (k.S.isDown || k.DOWN.isDown) iy += 1;
        if (ix || iy) this.wake();

        // またたびで酔っ払うと、入力がぐにゃぐにゃ曲がる
        if (c.high > 0 && (ix || iy)) {
            const a = Math.atan2(iy, ix) + Math.sin(this.stageTime * 2.3) * 0.9;
            ix = Math.cos(a);
            iy = Math.sin(a);
        }
        const len = Math.hypot(ix, iy) || 1;
        let spd = FC.speed(c.w) * (c.high > 0 ? 1.5 : 1);
        if (c.crouch > 0) spd *= 0.3;

        // 慣性: 太るほど加速も減速も遅い
        const f = Math.min(1, FC.grip(c.w) * dt);
        c.vx += ((ix / len) * spd - c.vx) * f;
        c.vy += ((iy / len) * spd - c.vy) * f;
        const moving = Math.hypot(c.vx, c.vy) > 15;
        c.walk = moving ? c.walk + dt * (Math.hypot(c.vx, c.vy) / 160) : 0;

        let dx = (c.vx + c.kbx) * dt;
        let dy = (c.vy + c.kby) * dt;
        const decay = Math.pow(0.03, dt);
        c.kbx *= decay;
        c.kby *= decay;
        const pull = this.externalPull(dt);
        dx += pull.x;
        dy += pull.y;

        const blocked = this.moveCat(dx, dy, ix, iy, spd * dt);
        if (blocked.x) { c.vx = 0; c.kbx = 0; }
        if (blocked.y) { c.vy = 0; c.kby = 0; }

        // 向き: 歩いている方向、止まっているときは狙っている方向
        const target = moving ? Math.atan2(c.vy, c.vx) : c.crouch > 0 || c.punchT > 0 ? c.aim : c.heading;
        c.heading = Phaser.Math.Angle.RotateTo(c.heading, target, 10 * dt);

        // 放っておくと寝る
        c.idle = ix || iy || c.crouch ? 0 : c.idle + dt;
        if (!c.sleeping && c.idle > FC.SLEEP_AFTER) {
            c.sleeping = true;
            this.sayOnce('sleep', NARRATOR.sleep);
        }
        if (c.sleeping) {
            c.zzz -= dt;
            if (c.zzz <= 0) {
                c.zzz = 1.2;
                this.floatText(c.x + c.d * 0.3, c.y - c.d * 0.6, 'Zzz', '#ffffff', 16);
            }
        }

        this.checkFloor();
    }

    // 掃除機やルンバに吸い寄せられる
    externalPull(dt) {
        const c = this.cat;
        const out = { x: 0, y: 0 };
        if (this.vac && this.vac.delay <= 0) {
            const gap = c.x - c.d / 2 - this.vac.x;
            if (gap < 280) out.x -= 75 * (1 - Math.max(0, gap) / 280) * dt;
        }
        const b = this.boss;
        if (b && b.active && b.kind === 'roomba') {
            const dist = Math.hypot(b.x - c.x, b.y - c.y) || 1;
            if (dist < 380) {
                out.x += ((b.x - c.x) / dist) * 55 * dt;
                out.y += ((b.y - c.y) / dist) * 55 * dt;
            }
        }
        return out;
    }

    wake() {
        const c = this.cat;
        c.idle = 0;
        if (c.sleeping) {
            c.sleeping = false;
            this.floatText(c.x, c.y - c.d / 2, 'ハッ', '#ffffff', 18);
        }
    }

    meow() {
        if (this.state !== 'play') return;
        const c = this.cat;
        this.wake();
        SFX.play(c.w > 40 ? 'meow' : 'meowHigh');
        this.floatText(c.x, c.y - c.d / 2 - 10, c.w > 40 ? 'ンナ゛ァ〜' : 'ニャー', '#ffffff', 22);
    }

    moveCat(dx, dy, ix, iy, assistAmount) {
        const c = this.cat;
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
        const sx = dx / steps, sy = dy / steps;
        let blockedX = false, blockedY = false;
        for (let i = 0; i < steps; i++) {
            if (sx && !blockedX) {
                if (this.fits(c.x + sx, c.y, c.d) || this.ram(c.x + sx, c.y)) c.x += sx; else blockedX = true;
            }
            if (sy && !blockedY) {
                if (this.fits(c.x, c.y + sy, c.d) || this.ram(c.x, c.y + sy)) c.y += sy; else blockedY = true;
            }
        }
        // 角でひっかからないよう、穴の位置へ少しずらす
        if (blockedX && ix && !iy) this.slideAssist('x', ix, assistAmount);
        if (blockedY && iy && !ix) this.slideAssist('y', iy, assistAmount);
        return { x: blockedX, y: blockedY };
    }

    // 重ければ段ボール壁に体当たりして壊す
    ram(x, y) {
        const c = this.cat;
        if (c.w < FC.BOX_BREAK) return false;
        const boxes = [];
        const onlyBoxes = this.footprint(x, y, c.d, (tx, ty) => {
            if (!this.solid(tx, ty)) return true;
            if (this.grid[ty][tx] !== G_BOX) return false;
            boxes.push([tx, ty]);
            return true;
        });
        if (!onlyBoxes || !boxes.length) return false;
        boxes.forEach(([tx, ty]) => this.breakBox(tx, ty));
        SFX.play('boom');
        this.cameras.main.shake(150, 0.01);
        if (this.msgCooldown <= 0) {
            this.floatText(c.x, c.y - c.d / 2, 'ドーン!!', '#ffd166', 32);
            this.msgCooldown = 0.5;
        }
        return true;
    }

    slideAssist(axis, dir, amount) {
        const c = this.cat;
        const range = Math.min(20, c.d * 0.6);
        for (let o = 1; o <= range; o++) {
            for (const s of [1, -1]) {
                const px = axis === 'x' ? c.x + dir * 2 : c.x + s * o;
                const py = axis === 'x' ? c.y + s * o : c.y + dir * 2;
                if (!this.fits(px, py, c.d)) continue;
                const step = Math.min(amount, o) * s;
                const nx = axis === 'x' ? c.x : c.x + step;
                const ny = axis === 'x' ? c.y + step : c.y;
                if (this.fits(nx, ny, c.d)) {
                    c.x = nx;
                    c.y = ny;
                }
                return;
            }
        }
    }

    // 薄い床は重いと抜ける。穴の上に乗ったら落ちる（ジャンプ中は平気）
    checkFloor() {
        const c = this.cat;
        if (c.air) return;
        if (c.w > FC.FRAGILE_LIMIT) {
            this.footprint(c.x, c.y, c.d * 0.7, (tx, ty) => {
                if (this.grid[ty] && this.grid[ty][tx] === G_FRAGILE) this.crackFloor(tx, ty);
            });
        }
        if (this.gridAt(c.x, c.y) === G_PIT) this.die('fall');
    }

    setWeight(nw, cause) {
        const c = this.cat;
        nw = Math.round(nw * 10) / 10;
        const grew = nw > c.w;
        c.w = nw;
        c.d = FC.diameter(Math.max(nw, 0.1));
        if (nw < FC.MIN_WEIGHT) {
            this.die(cause === 'bitten' ? 'eaten' : 'thin');
            return;
        }
        if (nw >= FC.BURST_WEIGHT) {
            this.die('burst');
            return;
        }
        if (nw > Save.data.maxWeight) Save.data.maxWeight = nw;

        NARRATOR.milestones.forEach(([kg, line]) => {
            if (nw >= kg && !this.milestonesHit[kg]) {
                this.milestonesHit[kg] = true;
                this.say(line);
            }
        });

        this.updateGate();
        if (this.state !== 'play') return;
        if (grew && !c.air) this.resolveGrow();
        else if (c.stuck) this.tryUnstuck();
    }

    resolveGrow() {
        const c = this.cat;
        if (this.fits(c.x, c.y, c.d)) return;
        const pos = this.findFreeNear(c.x, c.y, c.d, c.d / 2 + 6);
        if (pos) {
            c.x = pos.x;
            c.y = pos.y;
            return;
        }
        if (!c.stuck) {
            c.stuck = true;
            c.stuckTimer = FC.STUCK_TIME;
            c.vx = c.vy = c.kbx = c.kby = 0;
            SFX.play('stuck');
            SFX.play('meow');
            this.cameras.main.shake(300, 0.012);
            this.floatText(c.x, c.y - c.d / 2, '詰まった!!', '#ff4d6d', 30);
            this.say(NARRATOR.pick(NARRATOR.stuckStart));
        }
    }

    tryUnstuck() {
        const c = this.cat;
        let ok = this.fits(c.x, c.y, c.d);
        if (!ok) {
            const pos = this.findFreeNear(c.x, c.y, c.d, 8);
            if (pos) {
                c.x = pos.x;
                c.y = pos.y;
                ok = true;
            }
        }
        if (ok) {
            c.stuck = false;
            SFX.play('pop');
            this.floatText(c.x, c.y - c.d / 2, 'スポッ', '#3fdc7f', 26);
        }
    }

    // ---------------------------------------------------------------- 猫の動き

    // 猫パンチ: 前方の敵を叩き、棚の物を叩き落とす
    punch() {
        const c = this.cat;
        if (c.punchCd > 0 || c.stuck || c.air) return;
        c.punchCd = FC.PUNCH_COOLDOWN;
        c.punchT = 0.14;
        c.heading = c.aim;
        const reach = FC.punchReach(c.w, c.d);
        const a = c.aim;
        SFX.play('swipe');
        this.clawMarks(c.x + Math.cos(a) * (c.d / 2 + 16), c.y + Math.sin(a) * (c.d / 2 + 16), a, c.d);

        const inArc = (x, y, r) => {
            const dist = Math.hypot(x - c.x, y - c.y);
            const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(y - c.y, x - c.x) - a));
            return dist < reach + r && diff < 1.2;
        };
        this.enemies.getChildren().slice().forEach(e => {
            if (!e.active || !inArc(e.x, e.y, e.size / 2)) return;
            this.damageEnemy(e, FC.punchDamage(c.w));
            if (e.active && !e.def.boss) {
                e.stun = 0.35;
                e.setVelocity(Math.cos(a) * 320, Math.sin(a) * 320);
            }
        });
        this.props.forEach(pr => {
            if (pr.alive && inArc(pr.x, pr.y, 14)) this.knockOff(pr, a);
        });
    }

    // 飛びかかり: ためた分だけ遠くへ跳ぶ。着地で踏みつぶす
    pounce(charge) {
        const c = this.cat;
        if (c.stuck || c.air) return;
        // ためた分だけ遠くへ。ただしカーソルより先には跳ばない
        const p = this.input.activePointer;
        const wp = this.cameras.main.getWorldPoint(p.x, p.y);
        const toCursor = Math.hypot(wp.x - c.x, wp.y - c.y);
        const dist = Math.max(30, Math.min(toCursor, FC.pounceMax(c.w) * (0.25 + 0.75 * charge)));
        this.startJump(c.aim, dist, false);
        SFX.play('jet');
    }

    startJump(angle, dist, scared) {
        const c = this.cat;
        const dur = 0.22 + dist / 900;
        c.air = { t: 0, dur, vx: (Math.cos(angle) * dist) / dur, vy: (Math.sin(angle) * dist) / dur, peak: 14 + dist * 0.12, scared };
        c.heading = angle;
        c.vx = c.vy = c.kbx = c.kby = 0;
        c.sleeping = false;
        c.idle = 0;
    }

    updateAir(dt) {
        const c = this.cat;
        const air = c.air;
        air.t += dt;
        this.moveCat(air.vx * dt, air.vy * dt, 0, 0, 0);
        c.walk += dt * 2;
        // 空中で獲物に触れたら捕まえる。デカい相手にはぶつかって止まる
        if (!air.scared) {
            for (const e of this.enemies.getChildren().slice()) {
                if (!e.active || Math.hypot(e.x - c.x, e.y - c.y) > c.d / 2 + e.size / 2) continue;
                if (c.d > e.size) {
                    this.eatEnemy(e);
                    if (this.state !== 'play') return;
                } else {
                    this.damageEnemy(e, FC.pounceDamage(c.w));
                    this.land();
                    return;
                }
            }
        }
        if (air.t >= air.dur) this.land();
    }

    land() {
        const c = this.cat;
        const scared = c.air.scared;
        c.air = null;
        SFX.play('thud');
        const slam = c.w >= FC.SLAM_WEIGHT;
        if (slam) {
            this.cameras.main.shake(200, 0.012);
            this.floatText(c.x, c.y + c.d / 2, 'ドスン!!', '#ffd166', 26);
            this.explosion(c.x, c.y, c.d * 0.8, 0xc9a27e);
        }
        if (!scared) {
            this.enemies.getChildren().slice().forEach(e => {
                if (!e.active) return;
                const dist = Math.hypot(e.x - c.x, e.y - c.y);
                if (dist < c.d / 2 + e.size / 2 + 6) {
                    if (c.d > e.size) this.eatEnemy(e);
                    else this.damageEnemy(e, FC.pounceDamage(c.w));
                } else if (slam && dist < c.d * 0.8 + e.size / 2) {
                    this.damageEnemy(e, FC.pounceDamage(c.w) * 0.5);
                }
            });
            this.props.forEach(pr => {
                if (pr.alive && Math.hypot(pr.x - c.x, pr.y - c.y) < c.d / 2 + 24) this.knockOff(pr, c.heading);
            });
        }
        if (this.state !== 'play') return;
        this.resolveGrow();
        this.checkFloor();
    }

    // 棚の物を叩き落として割る
    knockOff(pr, angle) {
        pr.alive = false;
        const tx = pr.x + Math.cos(angle) * 56, ty = pr.y + Math.sin(angle) * 56;
        this.tweens.add({
            targets: pr.s, x: tx, y: ty, angle: pr.s.angle + 400, duration: 320, ease: 'Quad.easeIn',
            onComplete: () => {
                pr.s.destroy();
                SFX.play('shatter');
                this.puff(tx, ty, 26, 0xffffff);
                this.damage += pr.def.price;
                Save.data.damageTotal = (Save.data.damageTotal || 0) + pr.def.price;
                this.floatText(tx, ty - 10, `ガシャーン!! ${pr.def.name} ¥${pr.def.price.toLocaleString()}`, '#ff9aa8', 18);
                if (pr.def.price >= 10000) this.say(NARRATOR.pick(NARRATOR.smash));
                if (Math.random() < 0.35 && !this.solidAt(tx, ty)) this.addItem(tx, ty, 1, 0.3);
            }
        });
    }

    updateCucumbers(dt) {
        const c = this.cat;
        if (c.air || c.stuck) return;
        this.cucumbers.forEach(k => {
            k.cool -= dt;
            if (k.cool > 0 || Math.hypot(k.x - c.x, k.y - c.y) > c.d / 2 + 26) return;
            k.cool = 2;
            // きゅうりに気づいた猫は真上に跳ねて逃げる
            const a = Math.atan2(c.y - k.y, c.x - k.x) + (Math.random() - 0.5) * 0.8;
            this.startJump(a, FC.SCARE_JUMP, true);
            c.scaredT = 1.2;
            SFX.play('hiss');
            this.cameras.main.shake(150, 0.008);
            this.floatText(c.x, c.y - c.d / 2 - 10, 'フギャーッ!!', '#ff4d6d', 28);
            this.sayOnce('scared', NARRATOR.scared);
        });
    }

    // 吐く: 痩せる + 毛玉攻撃 + 反動で吹っ飛ぶ（ゲロジェット）
    spit() {
        const c = this.cat;
        const amt = FC.spitAmount(c.w);
        if (c.w - amt < FC.MIN_WEIGHT) {
            if (this.msgCooldown <= 0) {
                this.floatText(c.x, c.y - c.d / 2, 'もう吐けない', '#ffffff', 18);
                this.msgCooldown = 0.8;
            }
            return;
        }
        const ca = Math.cos(c.aim), sa = Math.sin(c.aim);
        let sx = c.x + ca * c.d * 0.5, sy = c.y + sa * c.d * 0.5;
        if (this.solidAt(sx, sy)) {
            sx = c.x;
            sy = c.y;
        }
        const h = this.hairballs.create(sx, sy, 'fc_hairball');
        h.setScale(0.6 + amt * 0.15).setDepth(8);
        h.amt = amt;
        h.life = 0.55;
        h.setVelocity(ca * 480, sa * 480);
        if (!c.stuck && !c.air) {
            c.kbx -= ca * FC.SPIT_JET;
            c.kby -= sa * FC.SPIT_JET;
        }
        SFX.play('spit');
        this.floatText(c.x, c.y - c.d / 2, `オエッ -${amt}kg`, '#c9a27e', 16);
        this.setWeight(c.w - amt, 'spit');
    }

    landHairball(h) {
        if (!h.active) return;
        this.addItem(h.x, h.y, Math.round(h.amt * 5) / 10, 0.6);
        h.destroy();
    }

    updateHairballs(dt) {
        this.hairballs.getChildren().slice().forEach(h => {
            h.rotation += dt * 12;
            h.life -= dt;
            if (h.life <= 0) this.landHairball(h);
        });
    }

    // ---------------------------------------------------------------- 敵

    damageEnemy(e, dmg) {
        e.hp -= dmg;
        e.setTintFill(0xffffff);
        this.time.delayedCall(60, () => {
            if (!e.active) return;
            if (e.windup > 0) e.setTint(0xff6666); else e.clearTint();
        });
        SFX.play('hit');
        if (e.hp <= 0) this.killEnemy(e);
    }

    killEnemy(e) {
        SFX.play('kill');
        this.puff(e.x, e.y, e.size, 0xffffff);
        if (e.def.boss) {
            this.onBossDefeated(e.x, e.y, false);
        } else if (e.kind === 'mouse') {
            this.addItem(e.x, e.y, e.def.eat, 0.2, 'mouse');
        } else if (e.def.drop > 0) {
            this.addItem(e.x, e.y, e.def.drop);
        }
        e.destroy();
    }

    onBossDefeated(x, y, eaten) {
        this.bossDefeated = true;
        if (!eaten) {
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2;
                const ix = x + Math.cos(a) * 90, iy = y + Math.sin(a) * 90;
                if (!this.solidAt(ix, iy)) this.addItem(ix, iy, 1.5);
            }
        }
        this.floatText(x, y - 60, `${this.level.bossName} ${eaten ? '丸のみ' : '撃破'}!!`, '#ffd166', 44);
        this.say(eaten ? 'ボスを食べる猫。前代未聞' : 'あとは痩せるだけ');
        this.cameras.main.shake(500, 0.02);
        this.goalLabel.setText('GOAL').setColor('#ffd166');
    }

    eatEnemy(e) {
        const gain = e.def.eat;
        const isBoss = e.def.boss;
        this.puff(e.x, e.y, e.size, 0xf4a340);
        e.destroy();
        SFX.play(gain >= 3 ? 'bigeat' : 'eat');
        if (gain >= 3) this.cameras.main.shake(150, 0.006);
        this.floatText(this.cat.x, this.cat.y - this.cat.d / 2, `${gain >= 3 ? 'ゴクン' : 'ゲフッ'} +${gain}kg`, '#ffd166', gain >= 3 ? 26 : 18);
        if (isBoss) this.onBossDefeated(this.cat.x, this.cat.y, true);
        this.setWeight(this.cat.w + gain, 'eat');
    }

    hurtCat(dmg, fx, fy) {
        const c = this.cat;
        c.invuln = 1;
        this.wake();
        const a = Math.atan2(c.y - fy, c.x - fx);
        c.kbx = Math.cos(a) * 420;
        c.kby = Math.sin(a) * 420;
        SFX.play('hurt');
        SFX.play('hiss');
        this.cameras.main.shake(200, 0.01);
        this.floatText(c.x, c.y - c.d / 2, `ガブッ -${dmg}kg`, '#ff4d6d', 22);
        this.setWeight(c.w - dmg, 'bitten');
    }

    updateEnemies(dt) {
        const c = this.cat;
        this.enemies.getChildren().slice().forEach(e => {
            if (!e.active) return;
            if (this.vac && e.x < this.vac.x) {
                e.destroy();
                return;
            }
            if (this.state !== 'play') {
                e.setVelocity(0, 0);
                return;
            }
            const dx = c.x - e.x, dy = c.y - e.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (e.stun > 0) {
                e.stun -= dt;
                e.body.velocity.scale(0.9);
                return;
            }
            const spd = e.def.speed;
            const blocked = !e.body.blocked.none;
            let vx = 0, vy = 0;

            if (e.kind === 'mouse') {
                // 寝ている猫には近寄ってくる
                const flee = c.sleeping ? -0.4 : 1;
                if (dist < 220) {
                    vx = (-dx / dist) * spd * flee;
                    vy = (-dy / dist) * spd * flee;
                    if (blocked) {
                        vx += (-dy / dist) * spd;
                        vy += (dx / dist) * spd;
                    }
                } else {
                    e.wanderT -= dt;
                    if (e.wanderT <= 0 || blocked) {
                        e.wanderT = 1 + Math.random() * 1.5;
                        e.wanderA = Math.random() * Math.PI * 2;
                    }
                    vx = Math.cos(e.wanderA) * spd * 0.4;
                    vy = Math.sin(e.wanderA) * spd * 0.4;
                }
            } else if (e.def.boss) {
                if (e.kind === 'roomba') {
                    e.rotation += dt * 2;
                    this.roombaSuck(e, dt);
                }
                if (e.windup > 0) {
                    e.windup -= dt;
                    e.x += (Math.random() - 0.5) * 4;
                    if (e.windup <= 0) {
                        e.charge = 0.7;
                        e.clearTint();
                    }
                } else if (e.charge > 0) {
                    e.charge -= dt;
                    vx = Math.cos(e.chargeA) * 340;
                    vy = Math.sin(e.chargeA) * 340;
                } else {
                    vx = (dx / dist) * spd;
                    vy = (dy / dist) * spd;
                    e.chargeCd -= dt;
                    if (e.chargeCd <= 0 && dist < 650) {
                        e.chargeCd = e.kind === 'roomba' ? 4 : 3;
                        e.windup = 0.55;
                        e.chargeA = Math.atan2(dy, dx);
                        e.setTint(0xff6666);
                    }
                }
            } else {
                if (dist < 520) {
                    vx = (dx / dist) * spd;
                    vy = (dy / dist) * spd;
                    if (e.body.blocked.left || e.body.blocked.right) vy = Math.sign(dy || 1) * spd;
                    if (e.body.blocked.up || e.body.blocked.down) vx = Math.sign(dx || 1) * spd;
                } else {
                    e.wanderT -= dt;
                    if (e.wanderT <= 0 || blocked) {
                        e.wanderT = 1.5 + Math.random() * 2;
                        e.wanderA = Math.random() * Math.PI * 2;
                    }
                    vx = Math.cos(e.wanderA) * spd * 0.3;
                    vy = Math.sin(e.wanderA) * spd * 0.3;
                }
            }
            e.setVelocity(vx, vy);
            if (e.kind !== 'roomba' && Math.abs(vx) > 1) e.setFlipX(vx < 0);

            // 接触: デカい方が勝つ（ジャンプ中は当たらない）
            if (!c.air && dist < c.d / 2 + e.size * 0.45) {
                if (c.d > e.size) this.eatEnemy(e);
                else if (e.def.dmg > 0 && c.invuln <= 0) this.hurtCat(e.def.dmg, e.x, e.y);
            }
        });
    }

    // ルンバは近くの魚を吸い込んで大きくなる
    roombaSuck(e, dt) {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            const dx = e.x - it.s.x, dy = e.y - it.s.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist > 340) continue;
            it.s.x += (dx / dist) * 170 * dt;
            it.s.y += (dy / dist) * 170 * dt;
            if (dist >= e.size / 2) continue;
            it.s.destroy();
            this.items.splice(i, 1);
            if (e.size < e.def.maxSize) {
                e.size = Math.min(e.def.maxSize, e.size + 4);
                e.setScale(e.size / (e.def.bodyR * 2));
            }
            e.hp += 40;
            e.maxHp = Math.max(e.maxHp, e.hp);
            if (this.msgCooldown <= 0) {
                this.floatText(e.x, e.y - e.size / 2, 'ルンバが食べた', '#ff4d6d', 20);
                this.msgCooldown = 1;
            }
        }
    }

    updateItems() {
        const c = this.cat;
        if (c.air) return;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            if (this.vac && it.s.x < this.vac.x) {
                it.s.destroy();
                this.items.splice(i, 1);
                continue;
            }
            if (this.stageTime < it.ready) continue;
            const r = 10 * it.s.scaleX;
            if (Math.hypot(it.s.x - c.x, it.s.y - c.y) >= c.d / 2 + r) continue;
            it.s.destroy();
            this.items.splice(i, 1);
            if (it.kind === 'catnip') {
                c.high = FC.HIGH_TIME;
                SFX.play('meowHigh');
                this.floatText(c.x, c.y - c.d / 2, 'ニャハハハハ', '#a7c957', 26);
                this.say(NARRATOR.pick(NARRATOR.high));
            } else {
                SFX.play(it.value >= 3 ? 'bigeat' : 'eat');
                this.floatText(c.x, c.y - c.d / 2, `${it.kind === 'mouse' ? 'ムシャ' : 'モグ'} +${it.value}kg`, '#ffd166', it.value >= 3 ? 24 : 18);
            }
            this.setWeight(c.w + it.value, 'eat');
            if (this.state !== 'play') return;
        }
    }

    updateHoles(dt) {
        if (this.state !== 'play') return;
        this.holes.forEach(h => {
            h.t -= dt;
            if (h.t > 0) return;
            h.t = 3.5;
            h.mice = h.mice.filter(m => m.active);
            if (h.mice.length >= 3) return;
            if (this.vac && h.x < this.vac.x + 80) return;
            if (Math.hypot(h.x - this.cat.x, h.y - this.cat.y) < 140) return;
            h.mice.push(this.spawnEnemy('mouse', h.x, h.y));
        });
    }

    // 空から魚が降ってくる
    updateFishRain(dt) {
        if (!this.level.fishRain || this.state !== 'play' || this.items.length > 50) return;
        this.rainTimer -= dt;
        if (this.rainTimer > 0) return;
        this.rainTimer = this.level.fishRain * (0.5 + Math.random());
        for (let tries = 0; tries < 10; tries++) {
            const tx = 2 + Math.floor(Math.random() * (this.W - 4));
            const ty = 2 + Math.floor(Math.random() * (this.H - 4));
            if (this.grid[ty][tx] !== G_FLOOR) continue;
            const x = (tx + 0.5) * FC.TILE, y = (ty + 0.5) * FC.TILE;
            if (this.gridAt(x + 40, y) !== G_FLOOR || this.gridAt(x - 40, y) !== G_FLOOR) continue;
            const it = this.addItem(x, y, Math.random() < 0.3 ? 3 : 1, 0.5);
            this.tweens.killTweensOf(it.s);
            it.s.y = y - 300;
            it.s.setAlpha(0);
            this.tweens.add({ targets: it.s, y, alpha: 1, duration: 450, ease: 'Quad.easeIn' });
            return;
        }
    }

    updateVacuum(dt) {
        const v = this.vac;
        if (!v) return;
        if (this.state === 'play') {
            if (v.delay > 0) {
                v.delay -= dt;
            } else {
                // 離れすぎると追い上げてくる
                const far = this.cat.x - v.x > 1000;
                v.x += v.speed * (far ? 2.5 : 1) * dt;
                if (this.cat.x - this.cat.d / 2 < v.x) this.die('vacuum');
            }
        }
        const g = this.vacGfx;
        const t = this.time.now / 1000;
        g.clear();
        if (v.x > 0) {
            g.fillStyle(0x15121c, 0.97);
            g.fillRect(0, 0, v.x - 30, this.worldH);
            g.fillStyle(0x6b6b80);
            g.fillRect(v.x - 34, 0, 34, this.worldH);
            g.fillStyle(0x3a3a48);
            for (let y = -40 + ((t * 120) % 40); y < this.worldH; y += 40) g.fillRect(v.x - 34, y, 34, 14);
            g.fillStyle(0xff4d6d, 0.6 + Math.sin(t * 10) * 0.3);
            g.fillRect(v.x - 4, 0, 4, this.worldH);
        }
        // 吸い込みの風
        g.lineStyle(2, 0xffffff, 0.25);
        for (let i = 0; i < 14; i++) {
            const y = ((i * 97 + t * 30) % this.worldH);
            const off = ((t * 400 + i * 53) % 260);
            g.lineBetween(v.x + 260 - off, y, v.x + 230 - off, y);
        }
        const cam = this.cameras.main;
        this.vacText.setPosition(Math.max(v.x - 40, cam.worldView.x + 70), cam.worldView.centerY);
    }

    checkGoal() {
        const c = this.cat;
        if (!this.goal || c.air) return;
        if (Math.hypot(this.goal.x - c.x, this.goal.y - c.y) > c.d / 2 + 26) return;
        if (this.boss && !this.bossDefeated) {
            if (this.msgCooldown <= 0) {
                this.floatText(c.x, c.y - c.d / 2, `${this.level.bossName}を倒さないと入れない`, '#ff4d6d', 18);
                this.msgCooldown = 1.2;
            }
            return;
        }
        this.clearStage();
    }

    // ---------------------------------------------------------------- 結果

    die(reason) {
        if (this.state !== 'play') return;
        this.state = 'dead';
        this.deathReason = reason;
        Save.data.deaths++;
        Save.save();
        this.deathLine = NARRATOR.death(reason, Save.data.deaths);
        this.say(this.deathLine);
        SFX.play(reason === 'fall' ? 'fall' : reason === 'burst' ? 'boom' : 'die');
        const cam = this.cameras.main;
        cam.shake(reason === 'burst' ? 800 : 400, reason === 'burst' ? 0.04 : 0.02);
        cam.zoomTo(Math.min(2.2, cam.zoom * 1.4), 600, 'Cubic.easeOut');
        this.physics.pause();
        const s = this.catGfx;
        const c = this.cat;
        c.air = null;
        this.catShadow.setVisible(false);
        if (reason === 'stuck' || reason === 'door') {
            this.tweens.add({ targets: s, scaleY: 0.4, scaleX: 1.5, duration: 300, ease: 'Back.easeIn' });
        } else if (reason === 'vacuum') {
            this.tweens.add({ targets: s, x: s.x - 200, angle: s.angle - 720, scale: 0, duration: 700, ease: 'Cubic.easeIn' });
        } else if (reason === 'fall') {
            this.tweens.add({ targets: s, scale: 0, angle: s.angle + 360, duration: 900, ease: 'Cubic.easeIn' });
        } else if (reason === 'burst') {
            s.setVisible(false);
            this.explosion(c.x, c.y, c.d * 1.5);
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                const f = this.add.image(c.x, c.y, 'fc_fish').setDepth(26).setScale(1.5);
                this.tweens.add({ targets: f, x: c.x + Math.cos(a) * 500, y: c.y + Math.sin(a) * 500, angle: 720, duration: 1200, ease: 'Cubic.easeOut' });
            }
            this.enemies.getChildren().slice().forEach(e => {
                if (Math.hypot(e.x - c.x, e.y - c.y) < c.d * 1.5) e.destroy();
            });
        } else {
            // ひっくり返る
            this.tweens.add({ targets: s, scaleY: -1, alpha: 0.5, duration: 400 });
        }
    }

    clearStage() {
        this.state = 'clear';
        this.clearTime = this.stageTime;
        Save.data.unlocked = Math.max(Save.data.unlocked, Math.min(this.stageIndex + 1, LEVELS.length - 1));
        const best = Save.data.best[this.stageIndex];
        this.newBest = !best || this.stageTime < best;
        if (this.newBest) Save.data.best[this.stageIndex] = this.stageTime;
        Save.save();
        SFX.play('clear');
        SFX.play('meowHigh');
        this.say(NARRATOR.pick(NARRATOR.clear));
        this.physics.pause();
        this.tweens.add({ targets: this.catGfx, scale: 1.15, yoyo: true, repeat: 3, duration: 180 });
    }

    retry() {
        this.scene.restart({ stage: this.stageIndex });
    }

    nextStage() {
        if (this.stageIndex + 1 >= LEVELS.length) {
            this.scene.stop('HudScene');
            this.scene.start('TitleScene', { ending: true });
        } else {
            this.scene.restart({ stage: this.stageIndex + 1 });
        }
    }

    // ---------------------------------------------------------------- 描画

    renderCat() {
        if (this.state !== 'play') return;
        const c = this.cat;
        const g = this.catGfx;
        const shape = CatArt.shape(c.w, c.d);
        const h = c.air ? Math.sin((Math.PI * c.air.t) / c.air.dur) * c.air.peak : 0;
        const breath = c.w >= FC.BURST_WARN ? Math.sin(this.time.now / 60) * 0.05 : 0;
        CatArt.draw(g, {
            ...shape,
            t: this.time.now / 1000,
            walk: c.walk,
            crouch: c.crouch,
            punch: c.punchT > 0 ? c.punchT / 0.14 : 0,
            sleep: c.sleeping,
            high: c.high > 0,
            scared: c.scaredT > 0
        });
        const jitter = c.stuck ? (Math.random() - 0.5) * 4 : 0;
        g.setPosition(c.x + jitter, c.y - h);
        g.setRotation(c.heading);
        g.setScale((1 + h / 120) * (1 + breath), (1 + h / 120) * (1 - breath));
        g.setAlpha(c.invuln > 0 && !c.air && Math.floor(c.invuln * 12) % 2 ? 0.45 : 1);
        this.catShadow.setPosition(c.x, c.y + c.d * 0.1);
        this.catShadow.setSize(shape.L * 0.9 * (1 - h / 150), shape.W * 0.9 * (1 - h / 150));
    }

    // 軽いうちはズームイン、太るほど引いていく。またたび中は画面がゆれる
    updateCameraZoom() {
        const cam = this.cameras.main;
        const target = Phaser.Math.Clamp(1.6 - (this.cat.w - 3) * 0.03, 0.45, 1.6);
        cam.setZoom(cam.zoom + (target - cam.zoom) * 0.05);
        cam.setRotation(this.cat.high > 0 ? Math.sin(this.stageTime * 1.7) * 0.06 : 0);
        // マップが画面より小さいときは中央に表示する
        const viewW = cam.width / cam.zoom, viewH = cam.height / cam.zoom;
        const bw = Math.max(this.worldW, viewW), bh = Math.max(this.worldH, viewH);
        cam.setBounds((this.worldW - bw) / 2, (this.worldH - bh) / 2, bw, bh);
    }

    // 猫パンチの爪あと
    clawMarks(x, y, angle, d) {
        const g = this.add.graphics().setDepth(12).setPosition(x, y).setRotation(angle);
        const len = Math.max(14, d * 0.5);
        g.lineStyle(3, 0xffffff, 0.9);
        for (let i = -1; i <= 1; i++) {
            g.beginPath();
            g.arc(-len * 0.3, i * len * 0.28, len * 0.6, -0.9, 0.9);
            g.strokePath();
        }
        this.tweens.add({ targets: g, alpha: 0, scale: 1.3, duration: 220, onComplete: () => g.destroy() });
    }

    explosion(x, y, R, color = 0xff9f1c) {
        SFX.play('boom');
        this.cameras.main.shake(120, 0.008);
        const ring = this.add.circle(x, y, R, color, 0.6).setDepth(25).setScale(0.2);
        this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 280, onComplete: () => ring.destroy() });
        this.puff(x, y, R * 0.8, 0xffd166);
    }

    floatText(x, y, text, color, size) {
        const t = this.add.text(x, y, text, {
            fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(30);
        this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
    }

    puff(x, y, size, color) {
        for (let i = 0; i < 8; i++) {
            const a = Math.random() * Math.PI * 2;
            const p = this.add.image(x, y, 'fc_dot').setTint(color).setDepth(12).setScale(size / 40);
            this.tweens.add({
                targets: p,
                x: x + Math.cos(a) * size * 0.8,
                y: y + Math.sin(a) * size * 0.8,
                alpha: 0, scale: 0.1, duration: 400,
                onComplete: () => p.destroy()
            });
        }
    }
}
