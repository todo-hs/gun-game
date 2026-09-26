// タイトル画面・ステージ選択
class TitleScene extends Phaser.Scene {
    constructor() {
        super('TitleScene');
    }

    create(data) {
        const W = this.scale.width, H = this.scale.height;
        this.cameras.main.setBackgroundColor('#1a1426');

        // 背景の魚
        for (let i = 0; i < 18; i++) {
            const f = this.add.image(Math.random() * W, Math.random() * H, 'fc_fish').setAlpha(0.15).setScale(1 + Math.random());
            this.tweens.add({ targets: f, x: f.x - 80, yoyo: true, repeat: -1, duration: 2000 + Math.random() * 2000 });
        }

        // 太ったり痩せたりする猫
        const cat = this.add.image(W / 2, 320, 'fc_cat').setScale(0.8);
        this.tweens.add({ targets: cat, scale: 1.7, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });

        const big = (size, color) => ({ fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#000', strokeThickness: 8 });
        this.add.text(W / 2, 80, 'デブ猫ガンナー', big(76, '#ffd166')).setOrigin(0.5);
        this.add.text(W / 2, 150, '〜 太るほど強い。でも穴に詰まる。〜', big(26, '#ffffff')).setOrigin(0.5);

        if (data && data.ending) {
            this.add.text(W / 2, 472, `全ステージ完食おめでとう！  総死亡 ${Save.data.deaths} 回`, big(28, '#ff9aa8')).setOrigin(0.5);
        }

        const unlocked = Save.data.unlocked;
        const startLabel = unlocked > 0 ? `つづきから (STAGE ${unlocked + 1})` : 'はじめる';
        this.makeButton(W / 2, 530, startLabel, 34, () => this.startStage(unlocked));

        const n = LEVELS.length;
        LEVELS.forEach((lv, i) => {
            const x = W / 2 + (i - (n - 1) / 2) * 200;
            const open = i <= unlocked;
            const best = Save.data.best[i];
            const label = open ? `${i + 1}. ${lv.name}${best ? `\n${best.toFixed(1)}s` : ''}` : `${i + 1}. ？？？`;
            this.makeButton(x, 610, label, 16, open ? () => this.startStage(i) : null);
        });

        this.add.text(W / 2, 690, `総死亡 ${Save.data.deaths} 回   /   実況・動画投稿 大歓迎！`, {
            fontFamily: FONT, fontSize: '18px', color: '#bbbbbb'
        }).setOrigin(0.5);

        this.input.keyboard.once('keydown-ENTER', () => this.startStage(unlocked));
        this.input.keyboard.once('keydown-SPACE', () => this.startStage(unlocked));
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
