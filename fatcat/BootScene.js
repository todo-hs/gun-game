// 全てのスプライトをコードで描いてテクスチャ化する（画像ファイル不要）
class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    create() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });

        this.drawCat(g);
        this.drawGun(g);
        this.drawMouse(g);
        this.drawDog(g, 'fc_dog', 52, 0xb07840, 0x6b4423, false);
        this.drawDog(g, 'fc_bigdog', 92, 0x7a4e2a, 0x3f2512, false);
        this.drawDog(g, 'fc_boss', 180, 0x8d7b9a, 0x4a3d55, true);
        this.drawFish(g, 'fc_fish', 0x2a6fa8, 0x4fa3e0, 0xbfe3ff);
        this.drawFish(g, 'fc_fish_gold', 0xc98a00, 0xffc93c, 0xfff1b8);
        this.drawRoomba(g);
        this.drawHairball(g);
        this.drawBullet(g);
        this.drawHouse(g);
        this.drawHole(g);
        this.drawTiles(g);
        this.drawDot(g);

        g.destroy();
        this.scene.start('TitleScene');
    }

    drawCat(g) {
        g.clear();
        const outline = 0x3a2412;
        // 耳
        g.fillStyle(outline);
        g.fillTriangle(20, 54, 34, 0, 64, 34);
        g.fillTriangle(108, 54, 94, 0, 64, 34);
        g.fillStyle(0xf4a340);
        g.fillTriangle(26, 50, 37, 9, 60, 36);
        g.fillTriangle(102, 50, 91, 9, 68, 36);
        g.fillStyle(0xffb3c1);
        g.fillTriangle(34, 44, 39, 20, 52, 38);
        g.fillTriangle(94, 44, 89, 20, 76, 38);
        // 体
        g.fillStyle(outline);
        g.fillCircle(64, 72, 55);
        g.fillStyle(0xf4a340);
        g.fillCircle(64, 72, 51);
        g.fillStyle(0xffe0b0);
        g.fillEllipse(64, 100, 64, 34);
        // 縞
        g.fillStyle(0xd9822b);
        g.fillRect(60, 23, 8, 16);
        g.fillRect(46, 28, 6, 12);
        g.fillRect(76, 28, 6, 12);
        g.fillRect(14, 64, 14, 5);
        g.fillRect(14, 76, 12, 5);
        g.fillRect(100, 64, 14, 5);
        g.fillRect(102, 76, 12, 5);
        // 目
        g.fillStyle(0xffffff);
        g.fillCircle(46, 62, 11);
        g.fillCircle(82, 62, 11);
        g.fillStyle(0x111111);
        g.fillCircle(49, 63, 6);
        g.fillCircle(85, 63, 6);
        g.fillStyle(0xffffff);
        g.fillCircle(51, 60, 2);
        g.fillCircle(87, 60, 2);
        // ほっぺ・鼻・口
        g.fillStyle(0xff9aa8, 0.6);
        g.fillEllipse(32, 82, 14, 8);
        g.fillEllipse(96, 82, 14, 8);
        g.fillStyle(0xff7a90);
        g.fillTriangle(58, 76, 70, 76, 64, 83);
        g.lineStyle(3, outline);
        g.beginPath();
        g.arc(58, 84, 6, 0, Math.PI, false);
        g.strokePath();
        g.beginPath();
        g.arc(70, 84, 6, 0, Math.PI, false);
        g.strokePath();
        g.generateTexture('fc_cat', 128, 128);
    }

    drawGun(g) {
        g.clear();
        g.fillStyle(0x222222);
        g.fillRect(0, 4, 38, 9);
        g.fillRect(3, 10, 10, 10);
        g.fillRect(36, 2, 10, 8);
        g.fillStyle(0x777777);
        g.fillRect(2, 6, 34, 3);
        g.generateTexture('fc_gun', 48, 20);
    }

    drawMouse(g) {
        g.clear();
        g.lineStyle(2, 0xd08a9a);
        g.beginPath();
        g.moveTo(6, 13);
        g.lineTo(2, 10);
        g.lineTo(1, 4);
        g.strokePath();
        g.fillStyle(0x5f6570);
        g.fillEllipse(15, 13, 22, 14);
        g.fillStyle(0x9aa0a8);
        g.fillEllipse(15, 13, 19, 11);
        g.fillStyle(0xffb3c1);
        g.fillCircle(18, 6, 4);
        g.fillStyle(0x111111);
        g.fillCircle(21, 11, 1.6);
        g.fillStyle(0xff7a90);
        g.fillCircle(26, 13, 2);
        g.generateTexture('fc_mouse', 28, 22);
    }

    drawDog(g, key, S, body, dark, collar) {
        g.clear();
        const c = S / 2;
        const r = S * 0.42;
        g.fillStyle(0x1a1010);
        g.fillCircle(c, c, r + 2);
        g.fillStyle(body);
        g.fillCircle(c, c, r);
        // たれ耳
        g.fillStyle(dark);
        g.fillEllipse(c - r * 0.55, c - r * 0.35, r * 0.55, r * 0.95);
        // マズル
        g.fillStyle(0xe8c9a0);
        g.fillEllipse(c + r * 0.45, c + r * 0.25, r * 0.9, r * 0.65);
        g.fillStyle(0x111111);
        g.fillCircle(c + r * 0.82, c + r * 0.1, r * 0.13);
        // 目と怒り眉
        g.fillStyle(0xffffff);
        g.fillCircle(c + r * 0.2, c - r * 0.2, r * 0.17);
        g.fillStyle(0x111111);
        g.fillCircle(c + r * 0.25, c - r * 0.18, r * 0.09);
        g.lineStyle(Math.max(2, r * 0.08), 0x111111);
        g.lineBetween(c + r * 0.02, c - r * 0.5, c + r * 0.42, c - r * 0.32);
        // 牙
        g.fillStyle(0xffffff);
        g.fillTriangle(c + r * 0.3, c + r * 0.5, c + r * 0.4, c + r * 0.5, c + r * 0.35, c + r * 0.7);
        g.fillTriangle(c + r * 0.6, c + r * 0.5, c + r * 0.7, c + r * 0.5, c + r * 0.65, c + r * 0.7);
        if (collar) {
            g.fillStyle(0xd62839);
            g.fillRect(c - r * 0.75, c + r * 0.72, r * 1.5, r * 0.18);
            g.fillStyle(0xeeeeee);
            for (let i = 0; i < 6; i++) {
                const x = c - r * 0.65 + i * r * 0.26;
                g.fillTriangle(x, c + r * 0.9, x + r * 0.12, c + r * 0.9, x + r * 0.06, c + r * 1.05);
            }
        }
        g.generateTexture(key, S, S);
    }

    drawRoomba(g) {
        g.clear();
        const c = 150;
        g.fillStyle(0x111111);
        g.fillCircle(c, c, 134);
        g.fillStyle(0x3a3a44);
        g.fillCircle(c, c, 128);
        g.fillStyle(0x55555f);
        g.fillCircle(c, c, 100);
        // 前のバンパー
        g.lineStyle(14, 0x222228);
        g.beginPath();
        g.arc(c, c, 120, -1.1, 1.1);
        g.strokePath();
        // ボタンと怒った目
        g.fillStyle(0x222228);
        g.fillCircle(c, c, 30);
        g.fillStyle(0x3fdc7f);
        g.fillCircle(c, c, 10);
        g.fillStyle(0xff2244);
        g.fillEllipse(c + 55, c - 38, 34, 22);
        g.fillEllipse(c + 55, c + 38, 34, 22);
        g.fillStyle(0xffffff);
        g.fillCircle(c + 60, c - 38, 5);
        g.fillCircle(c + 60, c + 38, 5);
        g.lineStyle(8, 0x111111);
        g.lineBetween(c + 30, c - 62, c + 76, c - 44);
        g.lineBetween(c + 30, c + 62, c + 76, c + 44);
        // ブラシ
        g.lineStyle(4, 0xbbbbbb);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            g.lineBetween(c + 95, c - 95, c + 95 + Math.cos(a) * 26, c - 95 + Math.sin(a) * 26);
            g.lineBetween(c + 95, c + 95, c + 95 + Math.cos(a) * 26, c + 95 + Math.sin(a) * 26);
        }
        g.generateTexture('fc_roomba', 300, 300);
    }

    drawFish(g, key, dark, body, belly) {
        g.clear();
        g.fillStyle(dark);
        g.fillTriangle(26, 12, 40, 1, 40, 23);
        g.fillEllipse(16, 12, 30, 18);
        g.fillStyle(body);
        g.fillEllipse(16, 11, 26, 14);
        g.fillStyle(belly);
        g.fillEllipse(16, 15, 18, 5);
        g.fillStyle(0xffffff);
        g.fillCircle(8, 10, 3);
        g.fillStyle(0x111111);
        g.fillCircle(8, 10, 1.5);
        g.generateTexture(key, 40, 24);
    }

    drawHairball(g) {
        g.clear();
        g.fillStyle(0x5a3f2a);
        g.fillCircle(14, 14, 13);
        g.fillStyle(0x8a6a4a);
        g.fillCircle(14, 14, 11);
        g.lineStyle(2, 0x5a3f2a);
        g.beginPath();
        g.arc(14, 14, 7, 0.3, 4.5);
        g.strokePath();
        g.beginPath();
        g.arc(12, 13, 3, 2, 6);
        g.strokePath();
        g.generateTexture('fc_hairball', 28, 28);
    }

    drawBullet(g) {
        g.clear();
        g.fillStyle(0xffb703);
        g.fillCircle(6, 6, 6);
        g.fillStyle(0xfff3b0);
        g.fillCircle(6, 6, 3);
        g.generateTexture('fc_bullet', 12, 12);
    }

    drawHouse(g) {
        g.clear();
        g.fillStyle(0xf1e3c8);
        g.fillRect(10, 34, 60, 44);
        g.fillStyle(0xd62839);
        g.fillTriangle(0, 38, 40, 2, 80, 38);
        g.fillStyle(0x7a4e2a);
        g.fillRoundedRect(30, 50, 20, 28, 8);
        g.fillStyle(0x8ecae6);
        g.fillRect(16, 44, 10, 10);
        g.fillRect(54, 44, 10, 10);
        g.fillStyle(0xffd166);
        g.fillCircle(40, 24, 7);
        g.generateTexture('fc_house', 80, 80);
    }

    drawHole(g) {
        g.clear();
        g.fillStyle(0x3b3150);
        g.fillEllipse(18, 10, 36, 20);
        g.fillStyle(0x07050b);
        g.fillEllipse(18, 11, 30, 15);
        g.generateTexture('fc_hole', 36, 20);
    }

    drawTiles(g) {
        g.clear();
        const T = FC.TILE;
        // 0: 床
        g.fillStyle(0x2a2236);
        g.fillRect(0, 0, T, T);
        g.fillStyle(0x322a42);
        g.fillRect(4, 4, 2, 2);
        g.fillRect(20, 18, 2, 2);
        // 1: 壁
        g.fillStyle(0x4b3d63);
        g.fillRect(T, 0, T, T);
        g.fillStyle(0x6a5890);
        g.fillRect(T, 0, T, 5);
        g.fillStyle(0x3a2f4d);
        g.fillRect(T, 15, T, 2);
        g.fillRect(T + 15, 5, 2, 10);
        g.fillRect(T + 6, 17, 2, 15);
        g.fillRect(T + 24, 17, 2, 15);
        // 2: 体重計ドア（閉）
        g.fillStyle(0x5a1624);
        g.fillRect(T * 2, 0, T, T);
        g.fillStyle(0xff4d6d);
        for (let i = 0; i < 4; i++) g.fillRect(T * 2 + 3 + i * 8, 0, 3, T);
        g.fillRect(T * 2, 14, T, 3);
        // 3: 体重計ドア（開）
        g.fillStyle(0x2a2236);
        g.fillRect(T * 3, 0, T, T);
        g.fillStyle(0x3fdc7f);
        for (let i = 0; i < 4; i++) g.fillRect(T * 3 + 3 + i * 8, 0, 3, 4);
        g.fillRect(T * 3, 0, 2, T);
        g.fillRect(T * 4 - 2, 0, 2, T);
        // 4: 床（市松）
        g.fillStyle(0x2e2640);
        g.fillRect(T * 4, 0, T, T);
        // 5: 薄い床
        g.fillStyle(0x4a3a2a);
        g.fillRect(T * 5, 0, T, T);
        g.fillStyle(0x6b5540);
        g.fillRect(T * 5 + 1, 1, T - 2, T - 2);
        g.lineStyle(1, 0x2a1f15);
        g.lineBetween(T * 5 + 4, 6, T * 5 + 14, 14);
        g.lineBetween(T * 5 + 14, 14, T * 5 + 26, 10);
        g.lineBetween(T * 5 + 14, 14, T * 5 + 18, 28);
        // 6: 穴
        g.fillStyle(0x000000);
        g.fillRect(T * 6, 0, T, T);
        g.fillStyle(0x140f1c);
        g.fillRect(T * 6, 0, T, 5);
        // 7: 段ボール
        g.fillStyle(0x8a6436);
        g.fillRect(T * 7, 0, T, T);
        g.fillStyle(0xc49a5c);
        g.fillRect(T * 7 + 2, 2, T - 4, T - 4);
        g.fillStyle(0xe8d9a8);
        g.fillRect(T * 7 + 13, 2, 6, T - 4);
        g.lineStyle(2, 0x8a6436);
        g.lineBetween(T * 7 + 4, 24, T * 7 + 10, 28);
        // 8: ひび割れ中の床
        g.fillStyle(0x6b2a2a);
        g.fillRect(T * 8, 0, T, T);
        g.lineStyle(2, 0x000000);
        g.lineBetween(T * 8 + 2, 4, T * 8 + 16, 16);
        g.lineBetween(T * 8 + 16, 16, T * 8 + 30, 6);
        g.lineBetween(T * 8 + 16, 16, T * 8 + 12, 30);
        g.lineBetween(T * 8 + 16, 16, T * 8 + 28, 26);
        g.generateTexture('fc_tiles', T * 9, T);
    }

    drawDot(g) {
        g.clear();
        g.fillStyle(0xffffff);
        g.fillCircle(8, 8, 8);
        g.generateTexture('fc_dot', 16, 16);
    }
}
