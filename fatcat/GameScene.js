// メインのゲームシーン
// 猫の移動・壁判定は自前（詰まり判定を正確にするため）、敵と弾は Arcade Physics。
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
        this.stageTime = 0;
        this.fireTimer = 0;
        this.spitTimer = 0;
        this.msgCooldown = 0;
        this.items = [];
        this.holes = [];
        this.gateOpen = false;
        this.boss = null;
        this.bossDefeated = false;
        this.vac = null;

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
    }

    // ---------------------------------------------------------------- マップ

    parseLevel() {
        const rows = this.level.map;
        this.H = rows.length;
        this.W = Math.max(...rows.map(r => r.length));
        this.grid = [];
        this.gateTiles = [];
        this.spawns = [];
        for (let y = 0; y < this.H; y++) {
            const row = [];
            for (let x = 0; x < this.W; x++) {
                const ch = rows[y][x] || '#';
                let t = 0;
                if (ch === '#') t = 1;
                else if (ch === 'W') {
                    t = 2;
                    this.gateTiles.push({ x, y });
                } else if (ch !== '.') {
                    this.spawns.push({ ch, x, y });
                }
                row.push(t);
            }
            this.grid.push(row);
        }
    }

    buildMap() {
        const T = FC.TILE;
        const data = this.grid.map((row, y) => row.map((t, x) => (t === 0 ? ((x + y) % 2 ? 4 : 0) : t)));
        this.map = this.make.tilemap({ data, tileWidth: T, tileHeight: T });
        const tileset = this.map.addTilesetImage('fc_tiles', 'fc_tiles', T, T, 0, 0);
        this.layer = this.map.createLayer(0, tileset, 0, 0);
        this.layer.setCollision([1, 2]);
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

    solid(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return true;
        const v = this.grid[ty][tx];
        return v === 1 || (v === 2 && !this.gateOpen);
    }

    solidAt(x, y) {
        return this.solid(Math.floor(x / FC.TILE), Math.floor(y / FC.TILE));
    }

    // 直径 d の猫が (x, y) に収まるか
    fits(x, y, d) {
        const T = FC.TILE;
        const h = d / 2 - 0.01;
        const x0 = Math.floor((x - h) / T), x1 = Math.floor((x + h) / T);
        const y0 = Math.floor((y - h) / T), y1 = Math.floor((y + h) / T);
        for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
                if (this.solid(tx, ty)) return false;
            }
        }
        return true;
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
        this.gateTiles.forEach(g => this.layer.putTileAt(open ? 3 : 2, g.x, g.y));
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

    // ---------------------------------------------------------------- 生成

    createGroups() {
        this.enemies = this.physics.add.group();
        this.bullets = this.physics.add.group();
        this.hairballs = this.physics.add.group();

        this.physics.add.collider(this.enemies, this.layer);
        this.physics.add.collider(this.bullets, this.layer, b => b.destroy());
        this.physics.add.collider(this.hairballs, this.layer, h => this.landHairball(h));
        this.physics.add.overlap(this.bullets, this.enemies, (b, e) => {
            if (!b.active || !e.active) return;
            b.destroy();
            this.damageEnemy(e, b.dmg);
        });
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
            aim: 0, invuln: 0,
            stuck: false, stuckTimer: 0,
            kbx: 0, kby: 0, walk: 0
        };
        this.catSprite = this.add.image(this.cat.x, this.cat.y, 'fc_cat').setOrigin(0.5, 72 / 128).setDepth(10);
        this.gunSprite = this.add.image(this.cat.x, this.cat.y, 'fc_gun').setOrigin(0.15, 0.4).setDepth(11);
    }

    spawnEntities() {
        const T = FC.TILE;
        this.spawns.forEach(s => {
            const x = (s.x + 0.5) * T;
            const y = (s.y + 0.5) * T;
            switch (s.ch) {
                case 'm': this.spawnEnemy('mouse', x, y); break;
                case 'd': this.spawnEnemy('dog', x, y); break;
                case 'D': this.spawnEnemy('bigdog', x, y); break;
                case 'B': this.boss = this.spawnEnemy('boss', x, y); break;
                case 'f': this.addItem(x, y, 1); break;
                case 'F': this.addItem(x, y, 3); break;
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
        if (this.boss) this.goalLabel.setText('ブル太を倒せ').setColor('#ff4d6d');
    }

    spawnEnemy(kind, x, y) {
        const def = FC.ENEMIES[kind];
        const e = this.enemies.create(x, y, def.tex);
        const r = def.size / 2;
        e.body.setCircle(r, e.width / 2 - r, e.height / 2 - r);
        e.setDepth(kind === 'boss' ? 9 : 6);
        e.kind = kind;
        e.def = def;
        e.hp = def.hp;
        e.wanderT = 0;
        e.wanderA = Math.random() * Math.PI * 2;
        e.chargeCd = 2.5;
        e.windup = 0;
        e.charge = 0;
        return e;
    }

    addItem(x, y, value, delay = 0) {
        const s = this.add.image(x, y, value >= 3 ? 'fc_fish_gold' : 'fc_fish').setDepth(4);
        s.setScale(Math.min(2.4, 0.6 + value * 0.25));
        this.tweens.add({ targets: s, y: y - 4, yoyo: true, repeat: -1, duration: 500 + Math.random() * 300 });
        this.items.push({ s, value, ready: this.stageTime + delay });
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
        this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,R,ESC,M,ENTER');
        this.input.mouse.disableContextMenu();
        this.input.on('pointerdown', () => SFX.init());
        this.keys.R.on('down', () => this.retry());
        this.keys.ESC.on('down', () => {
            this.scene.stop('HudScene');
            this.scene.start('TitleScene');
        });
        this.keys.M.on('down', () => { SFX.muted = !SFX.muted; });
        this.keys.SPACE.on('down', () => {
            SFX.init();
            if (this.state === 'dead') this.retry();
            else if (this.state === 'clear') this.nextStage();
        });
        this.keys.ENTER.on('down', () => {
            if (this.state === 'dead') this.retry();
            else if (this.state === 'clear') this.nextStage();
        });
    }

    setupCamera() {
        const cam = this.cameras.main;
        cam.setZoom(1.6);
        cam.startFollow(this.catSprite, true, 0.12, 0.12);
        cam.setBackgroundColor('#0d0a14');
    }

    // ---------------------------------------------------------------- ループ

    update(time, deltaMs) {
        const dt = Math.min(deltaMs / 1000, 0.1);
        if (this.state === 'play') {
            this.stageTime += dt;
            this.msgCooldown -= dt;
            this.updateCat(dt);
            if (this.state === 'play') this.updateWeapons(dt);
            this.updateEnemies(dt);
            this.updateHairballs(dt);
            this.updateBullets(dt);
            if (this.state === 'play') this.updateItems();
            this.updateHoles(dt);
            this.updateVacuum(dt);
            if (this.state === 'play') this.checkGoal();
        } else if (this.state === 'dead') {
            this.enemies.setVelocity(0, 0);
        }
        this.renderCat(dt);
        this.updateCameraZoom();
    }

    updateCat(dt) {
        const c = this.cat;
        const k = this.keys;
        const p = this.input.activePointer;
        const wp = this.cameras.main.getWorldPoint(p.x, p.y);
        c.aim = Math.atan2(wp.y - c.y, wp.x - c.x);
        c.invuln = Math.max(0, c.invuln - dt);

        this.spitTimer -= dt;
        if ((k.SPACE.isDown || p.rightButtonDown()) && this.spitTimer <= 0) {
            this.spitTimer = FC.SPIT_INTERVAL;
            this.spit();
            if (this.state !== 'play') return;
        }

        if (c.stuck) {
            c.stuckTimer -= dt;
            if (c.stuckTimer <= 0) this.die('stuck');
            return;
        }

        let ix = 0, iy = 0;
        if (k.A.isDown || k.LEFT.isDown) ix -= 1;
        if (k.D.isDown || k.RIGHT.isDown) ix += 1;
        if (k.W.isDown || k.UP.isDown) iy -= 1;
        if (k.S.isDown || k.DOWN.isDown) iy += 1;
        const len = Math.hypot(ix, iy) || 1;
        const spd = FC.speed(c.w);
        let dx = (ix / len) * spd * dt;
        let dy = (iy / len) * spd * dt;
        c.walk = ix || iy ? c.walk + dt : 0;

        // ノックバック
        dx += c.kbx * dt;
        dy += c.kby * dt;
        c.kbx *= Math.pow(0.02, dt);
        c.kby *= Math.pow(0.02, dt);

        // 掃除機の吸引
        if (this.vac && this.vac.delay <= 0) {
            const gap = c.x - c.d / 2 - this.vac.x;
            if (gap < 280) dx -= 75 * (1 - Math.max(0, gap) / 280) * dt;
        }

        this.moveCat(dx, dy, ix, iy, spd * dt);
    }

    moveCat(dx, dy, ix, iy, assistAmount) {
        const c = this.cat;
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
        const sx = dx / steps, sy = dy / steps;
        let blockedX = false, blockedY = false;
        for (let i = 0; i < steps; i++) {
            if (sx) {
                if (this.fits(c.x + sx, c.y, c.d)) c.x += sx; else blockedX = true;
            }
            if (sy) {
                if (this.fits(c.x, c.y + sy, c.d)) c.y += sy; else blockedY = true;
            }
        }
        // 角でひっかからないよう、穴の位置へ少しずらす
        if (blockedX && ix && !iy) this.slideAssist('x', ix, assistAmount);
        if (blockedY && iy && !ix) this.slideAssist('y', iy, assistAmount);
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
        this.updateGate();
        if (this.state !== 'play') return;
        if (grew) this.resolveGrow();
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
            SFX.play('stuck');
            this.cameras.main.shake(300, 0.012);
            this.floatText(c.x, c.y - c.d / 2, '詰まった!!', '#ff4d6d', 30);
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
        SFX.play('spit');
        this.floatText(c.x, c.y - c.d / 2, `オエッ -${amt}kg`, '#c9a27e', 16);
        this.setWeight(c.w - amt, 'spit');
    }

    landHairball(h) {
        if (!h.active) return;
        this.addItem(h.x, h.y, Math.round(h.amt * 5) / 10, 0.6);
        h.destroy();
    }

    // ---------------------------------------------------------------- 戦闘

    updateWeapons(dt) {
        const c = this.cat;
        this.fireTimer -= dt;
        if (this.fireTimer > 0) return;
        this.fireTimer = FC.FIRE_INTERVAL;
        const ca = Math.cos(c.aim), sa = Math.sin(c.aim);
        let bx = c.x + ca * (c.d * 0.5 + 12), by = c.y + sa * (c.d * 0.5 + 12);
        if (this.solidAt(bx, by)) {
            bx = c.x;
            by = c.y;
        }
        const b = this.bullets.create(bx, by, 'fc_bullet');
        b.setScale(FC.bulletScale(c.w)).setDepth(7);
        b.dmg = FC.bulletDamage(c.w);
        b.life = 0.8;
        b.setVelocity(ca * 620, sa * 620);
        SFX.play('shoot');
    }

    updateBullets(dt) {
        this.bullets.getChildren().slice().forEach(b => {
            b.life -= dt;
            if (b.life <= 0) b.destroy();
        });
    }

    updateHairballs(dt) {
        this.hairballs.getChildren().slice().forEach(h => {
            h.rotation += dt * 12;
            h.life -= dt;
            if (h.life <= 0) this.landHairball(h);
        });
    }

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
        this.puff(e.x, e.y, e.def.size, 0xffffff);
        if (e.kind === 'boss') {
            this.onBossDefeated(e.x, e.y);
        } else if (e.def.drop > 0) {
            this.addItem(e.x, e.y, e.def.drop);
        }
        e.destroy();
    }

    onBossDefeated(x, y) {
        this.bossDefeated = true;
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const ix = x + Math.cos(a) * 90, iy = y + Math.sin(a) * 90;
            if (!this.solidAt(ix, iy)) this.addItem(ix, iy, 1.5);
        }
        this.floatText(x, y - 60, 'ブル太 撃破!!', '#ffd166', 40);
        this.cameras.main.shake(500, 0.02);
        this.goalLabel.setText('GOAL').setColor('#ffd166');
    }

    eatEnemy(e) {
        const gain = e.def.eat;
        const isBoss = e.kind === 'boss';
        this.puff(e.x, e.y, e.def.size, 0xf4a340);
        e.destroy();
        SFX.play(gain >= 3 ? 'bigeat' : 'eat');
        if (gain >= 3) this.cameras.main.shake(150, 0.006);
        this.floatText(this.cat.x, this.cat.y - this.cat.d / 2, `${gain >= 3 ? 'ゴクン' : 'ゲフッ'} +${gain}kg`, '#ffd166', gain >= 3 ? 26 : 18);
        if (isBoss) this.onBossDefeated(this.cat.x, this.cat.y);
        this.setWeight(this.cat.w + gain, 'eat');
    }

    hurtCat(dmg, fx, fy) {
        const c = this.cat;
        c.invuln = 1;
        const a = Math.atan2(c.y - fy, c.x - fx);
        c.kbx = Math.cos(a) * 420;
        c.kby = Math.sin(a) * 420;
        SFX.play('hurt');
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
            if (this.state !== 'play') return;
            const dx = c.x - e.x, dy = c.y - e.y;
            const dist = Math.hypot(dx, dy) || 1;
            const spd = e.def.speed;
            const blocked = !e.body.blocked.none;
            let vx = 0, vy = 0;

            if (e.kind === 'mouse') {
                if (dist < 220) {
                    vx = (-dx / dist) * spd;
                    vy = (-dy / dist) * spd;
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
                    vx = Math.cos(e.wanderA) * spd * 0.5;
                    vy = Math.sin(e.wanderA) * spd * 0.5;
                }
            } else if (e.kind === 'boss') {
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
                        e.chargeCd = 3;
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
            if (Math.abs(vx) > 1) e.setFlipX(vx < 0);

            // 接触: デカい方が勝つ
            if (dist < c.d / 2 + e.def.size * 0.45) {
                if (c.d > e.def.size) this.eatEnemy(e);
                else if (e.def.dmg > 0 && c.invuln <= 0) this.hurtCat(e.def.dmg, e.x, e.y);
            }
        });
    }

    updateItems() {
        const c = this.cat;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            if (this.vac && it.s.x < this.vac.x) {
                it.s.destroy();
                this.items.splice(i, 1);
                continue;
            }
            if (this.stageTime < it.ready) continue;
            const r = 10 * it.s.scaleX;
            if (Math.hypot(it.s.x - c.x, it.s.y - c.y) < c.d / 2 + r) {
                it.s.destroy();
                this.items.splice(i, 1);
                SFX.play(it.value >= 3 ? 'bigeat' : 'eat');
                this.floatText(c.x, c.y - c.d / 2, `モグ +${it.value}kg`, '#ffd166', it.value >= 3 ? 24 : 18);
                this.setWeight(c.w + it.value, 'eat');
                if (this.state !== 'play') return;
            }
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
        if (!this.goal) return;
        if (Math.hypot(this.goal.x - c.x, this.goal.y - c.y) > c.d / 2 + 26) return;
        if (this.boss && !this.bossDefeated) {
            if (this.msgCooldown <= 0) {
                this.floatText(c.x, c.y - c.d / 2, 'ブル太を倒さないと入れない', '#ff4d6d', 18);
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
        SFX.play('die');
        this.cameras.main.shake(400, 0.02);
        this.physics.pause();
        const s = this.catSprite;
        if (reason === 'stuck' || reason === 'door') {
            this.tweens.add({ targets: s, scaleY: s.scaleY * 0.3, scaleX: s.scaleX * 1.6, duration: 300, ease: 'Back.easeIn' });
        } else if (reason === 'vacuum') {
            this.tweens.add({ targets: s, x: s.x - 200, angle: -720, scale: 0, duration: 700, ease: 'Cubic.easeIn' });
        } else {
            this.tweens.add({ targets: s, angle: 180, alpha: 0.3, duration: 500 });
        }
        this.gunSprite.setVisible(false);
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
        this.physics.pause();
        this.tweens.add({ targets: this.catSprite, y: this.catSprite.y - 20, yoyo: true, repeat: 3, duration: 180 });
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

    renderCat(dt) {
        const c = this.cat;
        const s = this.catSprite;
        const g = this.gunSprite;
        if (this.state === 'play') {
            const base = (c.d * 1.12) / 110;
            const wob = c.stuck ? Math.sin(this.time.now / 30) * 0.06 : Math.sin(c.walk * 18) * 0.05;
            s.setScale(base * (1 + wob), base * (1 - wob));
            s.setPosition(c.x + (c.stuck ? (Math.random() - 0.5) * 4 : 0), c.y);
            s.setFlipX(Math.cos(c.aim) < 0);
            s.setAlpha(c.invuln > 0 && Math.floor(c.invuln * 12) % 2 ? 0.4 : 1);
            if (c.stuck) s.setTint(0xff8888); else s.clearTint();
        }
        const gs = Math.min(3, 0.6 + c.w * 0.05);
        g.setScale(gs);
        g.setRotation(c.aim);
        g.setFlipY(Math.cos(c.aim) < 0);
        g.setPosition(c.x + Math.cos(c.aim) * c.d * 0.35, c.y + Math.sin(c.aim) * c.d * 0.35 + c.d * 0.1);
    }

    // 軽いうちはズームイン、太るほど引いていく
    updateCameraZoom() {
        const cam = this.cameras.main;
        const target = Phaser.Math.Clamp(1.6 - (this.cat.w - 3) * 0.03, 0.75, 1.6);
        cam.setZoom(cam.zoom + (target - cam.zoom) * 0.05);
        // マップが画面より小さいときは中央に表示する
        const viewW = cam.width / cam.zoom, viewH = cam.height / cam.zoom;
        const bw = Math.max(this.worldW, viewW), bh = Math.max(this.worldH, viewH);
        cam.setBounds((this.worldW - bw) / 2, (this.worldH - bh) / 2, bw, bh);
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
