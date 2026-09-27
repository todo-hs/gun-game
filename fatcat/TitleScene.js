// タイトル画面・ステージ選択
class TitleScene extends Phaser.Scene {
    constructor() {
        super('TitleScene');
    }

    create(data) {
        const W = this.scale.width, H = this.scale.height;
        // 太ったり痩せたりする 3D の猫（View3D が後ろに描く）
        View3D.buildTitle();
        this.catWeight = { w: 5 };
        this.tweens.add({ targets: this.catWeight, w: 60, yoyo: true, repeat: -1, duration: 2600, ease: 'Sine.easeInOut' });

        const big = (size, color) => ({ fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#000', strokeThickness: 8 });
        this.add.text(W / 2, 80, 'デブ猫、詰まる。', big(76, '#ffd166')).setOrigin(0.5);
        this.add.text(W / 2, 150, '〜 太るほど強い。でも穴に詰まる。100kgで破裂する。〜', big(26, '#ffffff')).setOrigin(0.5);

        if (data && data.ending) {
            this.add.text(W / 2, 478, `全ステージ完食おめでとう！  総死亡 ${Save.data.deaths} 回`, big(28, '#ff9aa8')).setOrigin(0.5);
        }

        const unlocked = Save.data.unlocked;
        const startLabel = unlocked > 0 ? `つづきから (STAGE ${unlocked + 1})` : 'はじめる';
        this.makeButton(W / 2, 536, startLabel, 30, () => this.startStage(unlocked));

        LEVELS.forEach((lv, i) => {
            const row = i < 4 ? 0 : 1;
            const inRow = row ? LEVELS.length - 4 : 4;
            const col = row ? i - 4 : i;
            const x = W / 2 + (col - (inRow - 1) / 2) * 290;
            const open = i <= unlocked;
            const best = Save.data.best[i];
            const label = open ? `${i + 1}. ${lv.name}${best ? `  ${best.toFixed(1)}s` : ''}` : `${i + 1}. ？？？`;
            this.makeButton(x, 598 + row * 46, label, 16, open ? () => this.startStage(i) : null);
        });

        this.add.text(W / 2, 700, `総死亡 ${Save.data.deaths} 回   最高体重 ${Save.data.maxWeight.toFixed(1)} kg   累計被害総額 ¥${(Save.data.damageTotal || 0).toLocaleString()}   /   実況・動画投稿 大歓迎！`, {
            fontFamily: FONT, fontSize: '18px', color: '#bbbbbb'
        }).setOrigin(0.5);

        this.input.keyboard.once('keydown-ENTER', () => this.startStage(unlocked));
        this.input.keyboard.once('keydown-SPACE', () => this.startStage(unlocked));
    }

    update(time) {
        View3D.renderTitle(time, this.catWeight.w);
    }

    makeButton(x, y, label, size, onClick) {
        const t = this.add.text(x, y, label, {
            fontFamily: FONT, fontSize: `${size}px`, color: onClick ? '#ffffff' : '#666666', fontStyle: 'bold', align: 'center',
            backgroundColor: onClick ? '#d62839' : '#2a2236', padding: { x: 14, y: 8 }
        }).setOrigin(0.5);
        if (onClick) {
            t.setInteractive({ useHandCursor: true });
            t.on('pointerover', () => t.setScale(1.08));
            t.on('pointerout', () => t.setScale(1));
            t.on('pointerdown', onClick);
        }
        return t;
    }

    startStage(i) {
        SFX.init();
        this.scene.start('GameScene', { stage: i });
    }
}
