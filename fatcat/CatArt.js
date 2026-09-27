// 上から見た茶トラ猫を毎フレーム描く（しっぽ・足・呼吸が動く）
// 猫は +x 方向を向いた座標で描き、Graphics ごと回転させて使う。
const CatArt = {
    C: {
        base: 0xe39b4a,
        dark: 0xb5652a,
        outline: 0x5e3515,
        light: 0xf6d9ae,
        pink: 0xf2a0a8,
        eye: 0x9bd35a
    },

    // 体重と当たり判定の直径から、体の長さ・幅・頭の大きさを決める。
    // 太るほど胴体は丸く、頭は相対的に小さくなる。
    shape(w, d) {
        const f = Phaser.Math.Clamp((w - 3) / 40, 0, 1);
        return { L: d * (1.7 - 0.6 * f), W: d * (0.8 + 0.25 * f), Hr: d * (0.36 - 0.17 * f) };
    },

    // o: { L, W, Hr, t, walk, crouch(0..1), punch(0..1), sleep, high, scared }
    draw(g, o) {
        g.clear();
        if (o.sleep) {
            this.drawSleeping(g, o);
            return;
        }
        const C = this.C;
        const { L, W, Hr, t } = o;
        const crouch = o.crouch || 0;
        const bodyL = L * (1 - 0.12 * crouch);
        // 飛びかかる前のお尻フリフリ
        const wiggle = crouch ? Math.sin(t * 30) * W * 0.08 * crouch : 0;

        // しっぽ（輪郭を先に全部描いてから塗ると、なめらかな1本になる）
        const segs = 22, segLen = L * 0.04, tw = Math.max(1.5, W * 0.1) * (o.scared ? 1.8 : 1);
        const amp = o.scared ? 0.1 : o.high ? 1.2 : crouch ? 0.9 : 0.35;
        const speed = o.high ? 9 : crouch ? 14 : 3;
        const pts = [];
        let px = -bodyL / 2 + W * 0.05, py = wiggle;
        for (let i = 0; i < segs; i++) {
            const a = Math.PI + Math.sin(t * speed - i * 0.2) * amp * (0.3 + i / segs);
            px += Math.cos(a) * segLen;
            py += Math.sin(a) * segLen;
            pts.push([px, py, tw * (1 - (i / segs) * 0.4)]);
        }
        g.fillStyle(C.outline);
        pts.forEach(([x, y, r]) => g.fillCircle(x, y, r + 1.2));
        pts.forEach(([x, y, r], i) => {
            g.fillStyle(i > segs - 4 || Math.floor(i / 3) % 2 ? C.dark : C.base);
            g.fillCircle(x, y, r);
        });

        // 足（歩くと交互に動く）
        const step = Math.sin(o.walk * 14) * L * 0.07;
        const paws = [
            [bodyL * 0.3, -1, step], [bodyL * 0.3, 1, -step],
            [-bodyL * 0.28, -1, -step], [-bodyL * 0.28, 1, step]
        ];
        paws.forEach(([x, s, off]) => {
            const y = s * W * 0.45 + (x < 0 ? wiggle : 0);
            g.fillStyle(C.outline);
            g.fillEllipse(x + off, y, L * 0.17, W * 0.22);
            g.fillStyle(C.light);
            g.fillEllipse(x + off, y, L * 0.14, W * 0.17);
        });
        // 猫パンチ中の前足
        if (o.punch > 0) {
            const reach = bodyL / 2 + Hr * (1.2 + o.punch);
            g.fillStyle(C.outline);
            g.fillEllipse(reach, -W * 0.25, Hr * 0.9, Hr * 0.6);
            g.fillStyle(C.light);
            g.fillEllipse(reach, -W * 0.25, Hr * 0.75, Hr * 0.48);
        }

        // 胴体
        const by = wiggle * 0.5;
        g.fillStyle(C.outline);
        g.fillEllipse(0, by, bodyL + 3, W + 3);
        g.fillStyle(C.base);
        g.fillEllipse(0, by, bodyL, W);
        // 背中の縞
        g.fillStyle(C.dark);
        g.fillEllipse(-bodyL * 0.05, by, bodyL * 0.7, W * 0.16);
        [-0.32, -0.17, -0.02, 0.13, 0.28].forEach(k => {
            const x = k * bodyL;
            const half = (W / 2) * Math.sqrt(Math.max(0, 1 - Math.pow((2 * x) / bodyL, 2))) * 0.85;
            g.fillEllipse(x, by, bodyL * 0.045, half * 2);
        });

        // 頭
        const hx = bodyL / 2 + Hr * 0.25 - crouch * Hr * 0.25;
        [-1, 1].forEach(s => {
            const flat = o.scared ? 0.6 : 1;
            g.fillStyle(C.outline);
            g.fillTriangle(hx - Hr * 0.35, s * Hr * 0.5, hx + Hr * 0.15 * flat, s * Hr * (0.7 + 0.5 * flat), hx + Hr * 0.5, s * Hr * 0.4);
            g.fillStyle(C.pink);
            g.fillTriangle(hx - Hr * 0.18, s * Hr * 0.58, hx + Hr * 0.12 * flat, s * Hr * (0.7 + 0.35 * flat), hx + Hr * 0.3, s * Hr * 0.5);
        });
        g.fillStyle(C.outline);
        g.fillCircle(hx, 0, Hr + 1.5);
        g.fillStyle(C.base);
        g.fillCircle(hx, 0, Hr);
        g.fillStyle(C.dark);
        g.fillEllipse(hx - Hr * 0.3, 0, Hr * 0.6, Hr * 0.14);
        g.fillEllipse(hx - Hr * 0.3, -Hr * 0.3, Hr * 0.5, Hr * 0.12);
        g.fillEllipse(hx - Hr * 0.3, Hr * 0.3, Hr * 0.5, Hr * 0.12);
        g.fillStyle(C.light);
        g.fillEllipse(hx + Hr * 0.62, 0, Hr * 0.6, Hr * 0.85);
        g.fillStyle(C.pink);
        g.fillTriangle(hx + Hr * 0.88, -Hr * 0.13, hx + Hr * 0.88, Hr * 0.13, hx + Hr * 1.02, 0);

        // 目（狩りモードは瞳孔が開く、またたびでグルグル）
        [-1, 1].forEach(s => {
            const ex = hx + Hr * 0.32, ey = s * Hr * 0.42;
            g.fillStyle(C.outline);
            g.fillCircle(ex, ey, Hr * 0.23);
            g.fillStyle(o.high ? 0xff6fb5 : C.eye);
            g.fillCircle(ex, ey, Hr * 0.2);
            g.fillStyle(0x111111);
            if (o.high) {
                g.fillCircle(ex + Math.cos(t * 12 * s) * Hr * 0.07, ey + Math.sin(t * 12 * s) * Hr * 0.07, Hr * 0.09);
            } else if (crouch > 0.2 || o.scared) {
                g.fillCircle(ex, ey, Hr * 0.17);
            } else {
                g.fillEllipse(ex, ey, Hr * 0.12, Hr * 0.34);
            }
            g.fillStyle(0xffffff);
            g.fillCircle(ex + Hr * 0.06, ey - Hr * 0.06, Math.max(0.8, Hr * 0.05));
        });

        // ひげ
        g.lineStyle(1, 0xffffff, 0.85);
        [-1, 1].forEach(s => {
            g.lineBetween(hx + Hr * 0.8, s * Hr * 0.25, hx + Hr * 1.6, s * Hr * 0.75);
            g.lineBetween(hx + Hr * 0.8, s * Hr * 0.2, hx + Hr * 1.7, s * Hr * 0.4);
        });
    },

    // 丸まって寝ている姿
    drawSleeping(g, o) {
        const C = this.C;
        const { L, W, Hr, t } = o;
        const R = ((L + W) / 4) * (1 + Math.sin(t * 2) * 0.03);
        // 体に巻きつけたしっぽ
        const tw = Math.max(1.5, W * 0.11);
        for (let i = 0; i <= 12; i++) {
            const a = Math.PI * 0.35 + (i / 12) * Math.PI * 1.1;
            g.fillStyle(C.outline);
            g.fillCircle(Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02, tw + 1);
            g.fillStyle(i > 9 ? C.dark : C.base);
            g.fillCircle(Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02, tw);
        }
        g.fillStyle(C.outline);
        g.fillCircle(0, 0, R + 1.5);
        g.fillStyle(C.base);
        g.fillCircle(0, 0, R);
        g.fillStyle(C.dark);
        for (let k = 0; k < 5; k++) {
            const a = -0.6 + k * 0.45;
            g.fillEllipse(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, R * 0.12, R * 0.5);
        }
        // 頭（しっぽの上に乗せる）
        const hx = R * 0.35, hy = R * 0.45;
        [-1, 1].forEach(s => {
            g.fillStyle(C.outline);
            g.fillTriangle(hx - Hr * 0.4, hy + s * Hr * 0.45, hx - Hr * 0.1, hy + s * Hr * 1.1, hx + Hr * 0.35, hy + s * Hr * 0.45);
        });
        g.fillStyle(C.outline);
        g.fillCircle(hx, hy, Hr + 1.5);
        g.fillStyle(C.base);
        g.fillCircle(hx, hy, Hr);
        g.fillStyle(C.light);
        g.fillEllipse(hx + Hr * 0.55, hy, Hr * 0.55, Hr * 0.8);
        // 閉じた目
        g.lineStyle(Math.max(1, Hr * 0.08), C.outline);
        [-1, 1].forEach(s => {
            g.beginPath();
            g.arc(hx + Hr * 0.28, hy + s * Hr * 0.4, Hr * 0.16, -0.4 * Math.PI, 0.4 * Math.PI);
            g.strokePath();
        });
    }
};
