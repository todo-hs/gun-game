// 画面固定の UI（GameScene の上に重ねて表示）
class HudScene extends Phaser.Scene {
    constructor() {
        super('HudScene');
    }

    create() {
        this.gs = this.scene.get('GameScene');
        this.shownState = 'play';
        const W = this.scale.width, H = this.scale.height;
        const st = (size, color = '#ffffff') => ({
            fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#000000', strokeThickness: 5
        });

        this.add.rectangle(10, 10, 330, 118, 0x000000, 0.55).setOrigin(0);
        this.stageText = this.add.text(22, 18, `STAGE ${this.gs.stageIndex + 1}  ${this.gs.level.name}`, st(18, '#ffd166'));
        this.weightText = this.add.text(22, 44, '', st(34));
        this.holeChips = [1, 2, 3].map((n, i) =>
            this.add.text(22 + i * 104, 94, '', { fontFamily: FONT, fontSize: '14px', color: '#000', fontStyle: 'bold', padding: { x: 6, y: 3 } })
        );

        this.deathText = this.add.text(W - 20, 16, '', st(22)).setOrigin(1, 0);
        this.timeText = this.add.text(W - 20, 46, '', st(20, '#cccccc')).setOrigin(1, 0);
        this.infoText = this.add.text(W - 20, 76, '', st(18, '#ffd166')).setOrigin(1, 0);

        this.add.text(W / 2, H - 14,
            'WASD: 移動  マウス: ねらう(自動射撃)  SPACE/右クリック: 吐く  R: リトライ  ESC: タイトル  M: 音',
            { fontFamily: FONT, fontSize: '14px', color: '#bbbbbb', backgroundColor: '#00000099', padding: { x: 8, y: 4 } }
        ).setOrigin(0.5, 1);

        this.stuckText = this.add.text(W / 2, H / 2 - 120, '', st(40, '#ff4d6d')).setOrigin(0.5).setVisible(false);

        if (this.gs.boss) {
            this.bossBarBg = this.add.rectangle(W / 2, 148, 504, 22, 0x000000, 0.7);
            this.bossBar = this.add.rectangle(W / 2 - 250, 148, 500, 16, 0xd62839).setOrigin(0, 0.5);
            this.add.text(W / 2, 128, 'ブル太', st(18, '#ff4d6d')).setOrigin(0.5);
        }

        // ステージ開始のタイトル
        const banner = this.add.container(W / 2, H / 2 - 40, [
            this.add.rectangle(0, 0, W, 130, 0x000000, 0.7),
            this.add.text(0, -24, `STAGE ${this.gs.stageIndex + 1}  ${this.gs.level.name}`, st(44, '#ffd166')).setOrigin(0.5),
            this.add.text(0, 32, this.gs.level.sub, st(22)).setOrigin(0.5)
        ]);
        this.tweens.add({ targets: banner, alpha: 0, delay: 1600, duration: 500, onComplete: () => banner.destroy() });

        this.overlay = null;
        this.input.on('pointerdown', () => {
            SFX.init();
            if (this.gs.state === 'dead') this.gs.retry();
            else if (this.gs.state === 'clear') this.gs.nextStage();
        });
    }

    update() {
        const gs = this.gs;
        if (!gs.cat) return;
        const c = gs.cat;

        this.weightText.setText(`体重 ${c.w.toFixed(1)} kg`);
        const names = ['小穴', '中穴', '大穴'];
        this.holeChips.forEach((chip, i) => {
            const max = FC.maxWeightForTiles(i + 1);
            const ok = c.w <= max;
            chip.setText(`${names[i]}${max}kg ${ok ? '○' : '×'}`);
            chip.setBackgroundColor(ok ? '#3fdc7f' : '#ff4d6d');
        });

        this.deathText.setText(`総死亡 ${Save.data.deaths} 回`);
        this.timeText.setText(`TIME ${gs.stageTime.toFixed(1)}s`);

        let info = '';
        if (gs.level.gateWeight) {
            const need = gs.level.gateWeight - c.w;
            info = need > 0 ? `ドアまで あと ${need.toFixed(1)}kg 太れ` : 'ドア OPEN!';
        }
        if (gs.vac) {
            if (gs.vac.delay > 0) info += `\n掃除機 起動まで ${Math.ceil(gs.vac.delay)}`;
            else info += `\n掃除機まで ${Math.max(0, (c.x - gs.vac.x) / 32).toFixed(0)}マス`;
        }
        this.infoText.setText(info.trim());

        if (c.stuck && gs.state === 'play') {
            this.stuckText.setVisible(true);
            this.stuckText.setText(`詰まった!! SPACEで吐け!  ${c.stuckTimer.toFixed(1)}`);
            this.stuckText.setScale(1 + Math.sin(this.time.now / 60) * 0.05);
        } else {
            this.stuckText.setVisible(false);
        }

        if (this.bossBar) {
            const b = gs.boss;
            const ratio = b && b.active ? Math.max(0, b.hp / b.def.hp) : 0;
            this.bossBar.width = 500 * ratio;
        }

        if (gs.state !== this.shownState) {
            this.shownState = gs.state;
            if (gs.state === 'dead') this.showDeath();
            if (gs.state === 'clear') this.showClear();
        }
    }

    showDeath() {
        const W = this.scale.width, H = this.scale.height;
        const [title, sub] = FC.DEATHS[this.gs.deathReason] || ['死亡', ''];
        const c = this.add.container(W / 2, H / 2).setAlpha(0);
        c.add([
            this.add.rectangle(0, 0, W, 300, 0x000000, 0.8),
            this.add.text(0, -90, title, { fontFamily: FONT, fontSize: '64px', color: '#ff4d6d', fontStyle: 'bold', stroke: '#000', strokeThickness: 8 }).setOrigin(0.5),
            this.add.text(0, -20, sub, { fontFamily: FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0.5),
            this.add.text(0, 36, `体重 ${this.gs.cat.w.toFixed(1)}kg   総死亡 ${Save.data.deaths} 回`, { fontFamily: FONT, fontSize: '22px', color: '#ffd166' }).setOrigin(0.5),
            this.add.text(0, 96, 'クリック / R / SPACE でリトライ', { fontFamily: FONT, fontSize: '22px', color: '#bbbbbb' }).setOrigin(0.5)
        ]);
        this.tweens.add({ targets: c, alpha: 1, duration: 300, delay: 250 });
    }

    showClear() {
        const W = this.scale.width, H = this.scale.height;
        const last = this.gs.stageIndex + 1 >= LEVELS.length;
        const c = this.add.container(W / 2, H / 2).setAlpha(0);
        c.add([
            this.add.rectangle(0, 0, W, 300, 0x000000, 0.8),
            this.add.text(0, -90, last ? '完食!! 全ステージクリア' : 'STAGE CLEAR!', { fontFamily: FONT, fontSize: '60px', color: '#ffd166', fontStyle: 'bold', stroke: '#000', strokeThickness: 8 }).setOrigin(0.5),
            this.add.text(0, -16, `TIME ${this.gs.clearTime.toFixed(2)}s${this.gs.newBest ? '  (自己ベスト!)' : ''}   体重 ${this.gs.cat.w.toFixed(1)}kg`, { fontFamily: FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0.5),
            this.add.text(0, 36, `ここまでの総死亡 ${Save.data.deaths} 回`, { fontFamily: FONT, fontSize: '22px', color: '#ff9aa8' }).setOrigin(0.5),
            this.add.text(0, 96, last ? 'クリックでタイトルへ' : 'クリック / SPACE で次のステージ', { fontFamily: FONT, fontSize: '22px', color: '#bbbbbb' }).setOrigin(0.5)
        ]);
        this.tweens.add({ targets: c, alpha: 1, duration: 300 });
    }
}
