// コードで描くテクスチャ（画像ファイル不要）
import * as THREE from 'three';

function tex(w, h, draw, { repeat = null, color = true } = {}) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat[0], repeat[1]);
    }
    return t;
}

function speckle(ctx, w, h, n, colors, size = 2) {
    for (let i = 0; i < n; i++) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
    }
}

// 毛の流れ（短い線を大量に描く）
function strands(ctx, w, h, n, colors, len, angle = Math.PI / 2, jitter = 0.4) {
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
        ctx.strokeStyle = colors[i % colors.length];
        const x = Math.random() * w, y = Math.random() * h;
        const a = angle + (Math.random() - 0.5) * jitter;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
    }
}

export const Tex = {};

export function buildTextures() {
    // フローリング
    Tex.floor = tex(1024, 1024, (ctx, w, h) => {
        const rows = 8;
        const rh = h / rows;
        for (let r = 0; r < rows; r++) {
            let x = -((r * 173) % 400);
            while (x < w) {
                const len = 380 + Math.random() * 260;
                const base = 150 + Math.random() * 25;
                ctx.fillStyle = `rgb(${base}, ${base * 0.68 | 0}, ${base * 0.42 | 0})`;
                ctx.fillRect(x, r * rh, len, rh);
                ctx.strokeStyle = 'rgba(70,40,15,0.18)';
                for (let k = 0; k < 14; k++) {
                    const y = r * rh + 6 + Math.random() * (rh - 12);
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.bezierCurveTo(x + len * 0.3, y + (Math.random() - 0.5) * 8, x + len * 0.7, y + (Math.random() - 0.5) * 8, x + len, y);
                    ctx.stroke();
                }
                ctx.fillStyle = 'rgba(40,20,5,0.55)';
                ctx.fillRect(x, r * rh, 2, rh);
                x += len;
            }
            ctx.fillStyle = 'rgba(40,20,5,0.6)';
            ctx.fillRect(0, r * rh, w, 2);
        }
    }, { repeat: [3, 3] });

    // 家具の木目
    Tex.wood = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#6b4526';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(30,15,5,0.25)';
        for (let k = 0; k < 60; k++) {
            const y = Math.random() * h;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 20, w * 0.7, y + (Math.random() - 0.5) * 20, w, y);
            ctx.stroke();
        }
    }, { repeat: [1, 1] });

    Tex.lightWood = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#c9a57a';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(90,55,20,0.18)';
        for (let k = 0; k < 50; k++) {
            const y = Math.random() * h;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 16, w * 0.7, y + (Math.random() - 0.5) * 16, w, y);
            ctx.stroke();
        }
    }, { repeat: [1, 1] });

    // しっくいの壁
    Tex.plaster = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#ddd4c3';
        ctx.fillRect(0, 0, w, h);
        speckle(ctx, w, h, 9000, ['rgba(0,0,0,0.035)', 'rgba(255,255,255,0.25)'], 2);
    }, { repeat: [4, 2] });

    // ソファの布
    Tex.fabric = tex(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#5f7a8c';
        ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 2) {
            ctx.fillStyle = y % 4 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
            ctx.fillRect(0, y, w, 1);
        }
        for (let x = 0; x < w; x += 2) {
            ctx.fillStyle = 'rgba(0,0,0,0.04)';
            ctx.fillRect(x, 0, 1, h);
        }
        speckle(ctx, w, h, 3000, ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.06)'], 1);
    }, { repeat: [3, 3] });

    // ラグ
    Tex.rug = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#8e3b46';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#e9c46a';
        ctx.lineWidth = 10;
        ctx.strokeRect(24, 24, w - 48, h - 48);
        ctx.lineWidth = 4;
        ctx.strokeRect(48, 48, w - 96, h - 96);
        ctx.fillStyle = '#e9c46a';
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) {
                ctx.save();
                ctx.translate(90 + i * 66, 90 + j * 66);
                ctx.rotate(Math.PI / 4);
                ctx.fillRect(-10, -10, 20, 20);
                ctx.restore();
            }
        }
        strands(ctx, w, h, 20000, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.05)'], 3, 0, 6);
    });

    // ベッドのシーツ
    Tex.linen = tex(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#eef0f2';
        ctx.fillRect(0, 0, w, h);
        speckle(ctx, w, h, 4000, ['rgba(0,0,0,0.04)', 'rgba(255,255,255,0.4)'], 1);
    }, { repeat: [2, 2] });

    Tex.cardboard = tex(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#b98c55';
        ctx.fillRect(0, 0, w, h);
        speckle(ctx, w, h, 3000, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.05)'], 1);
        ctx.fillStyle = 'rgba(225,210,170,0.85)';
        ctx.fillRect(w * 0.42, 0, w * 0.16, h);
        ctx.fillStyle = '#5a3d1f';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText('FRAGILE', 18, h - 30);
    });

    Tex.tile = tex(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#f2f2ee';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#c9c9c0';
        for (let i = 0; i <= 4; i++) {
            ctx.fillRect(i * 64 - 1, 0, 2, h);
            ctx.fillRect(0, i * 64 - 1, w, 2);
        }
    }, { repeat: [6, 2] });

    // 窓の外の景色（明るい空と木）
    Tex.sky = tex(256, 256, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#9fd3ff');
        g.addColorStop(1, '#f5f9ff');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(110,160,90,0.8)';
        for (let i = 0; i < 12; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * w, h * 0.85 + Math.random() * 30, 20 + Math.random() * 25, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // --- 猫 ---
    // 胴体: u が体の周り（0.5 が背中の真上）、v が体の前後。縞は背中側だけ濃く、お腹は白っぽい
    Tex.catBody = tex(1024, 512, (ctx, w, h) => {
        ctx.fillStyle = '#d98a3d';
        ctx.fillRect(0, 0, w, h);
        // お腹（u=0 と 1 の付近）を明るく
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, '#f6e3c6');
        g.addColorStop(0.22, 'rgba(246,227,198,0)');
        g.addColorStop(0.78, 'rgba(246,227,198,0)');
        g.addColorStop(1, '#f6e3c6');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // 縞（v 方向に並ぶ帯。背中の中央ほど濃い）
        for (let i = 0; i < 13; i++) {
            const y0 = (i + 0.5) / 13 * h;
            const width = 7 + Math.random() * 8;
            for (let x = 0; x < w; x += 2) {
                const u = x / w;
                const back = Math.max(0, 1 - Math.abs(u - 0.5) / 0.32);
                if (back <= 0) continue;
                const y = y0 + Math.sin(u * 18 + i) * 5 + (u - 0.5) * 30 * Math.sign(i - 6);
                ctx.fillStyle = `rgba(140,65,20,${0.75 * back})`;
                ctx.fillRect(x, y - width / 2, 2, width * (0.5 + back * 0.5));
            }
        }
        // 背骨にそった濃い線
        ctx.fillStyle = 'rgba(140,65,20,0.55)';
        ctx.fillRect(w * 0.47, 0, w * 0.06, h);
        strands(ctx, w, h, 30000, ['rgba(255,230,190,0.18)', 'rgba(110,50,15,0.16)'], 5, Math.PI / 2, 0.5);
    });

    // 頭: u=0.5 が顔の正面。おでこの M 字、白い口元
    Tex.catHead = tex(1024, 512, (ctx, w, h) => {
        ctx.fillStyle = '#d98a3d';
        ctx.fillRect(0, 0, w, h);
        const cx = w / 2;
        const g = ctx.createRadialGradient(cx, h * 0.68, 6, cx, h * 0.68, h * 0.3);
        g.addColorStop(0, '#fbf1e1');
        g.addColorStop(0.7, 'rgba(251,241,225,0.8)');
        g.addColorStop(1, 'rgba(251,241,225,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#f6e3c6';
        ctx.fillRect(0, h * 0.82, w, h * 0.18);
        ctx.strokeStyle = 'rgba(140,65,20,0.85)';
        ctx.lineCap = 'round';
        ctx.lineWidth = 12;
        [-54, -20, 20, 54].forEach((dx, i) => {
            ctx.beginPath();
            ctx.moveTo(cx + dx * 1.5, h * 0.08);
            ctx.quadraticCurveTo(cx + dx * 1.15, h * 0.22, cx + dx * 0.75, h * (i === 1 || i === 2 ? 0.36 : 0.31));
            ctx.stroke();
        });
        ctx.lineWidth = 9;
        [-1, 1].forEach(sd => {
            for (let k = 0; k < 2; k++) {
                ctx.beginPath();
                ctx.moveTo(cx + sd * 140, h * (0.5 + k * 0.08));
                ctx.lineTo(cx + sd * 210, h * (0.44 + k * 0.1));
                ctx.stroke();
            }
        });
        strands(ctx, w, h, 25000, ['rgba(255,230,190,0.16)', 'rgba(110,50,15,0.13)'], 4, Math.PI / 2, 0.6);
    });

    // しっぽ: 輪の縞
    Tex.catTail = tex(256, 512, (ctx, w, h) => {
        ctx.fillStyle = '#d98a3d';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = 'rgba(140,65,20,0.8)';
            ctx.fillRect(0, (i + 0.3) / 8 * h, w, h / 20);
        }
        ctx.fillStyle = 'rgba(120,55,15,0.9)';
        ctx.fillRect(0, h * 0.93, w, h * 0.07);
        strands(ctx, w, h, 8000, ['rgba(255,230,190,0.16)', 'rgba(110,50,15,0.14)'], 4);
    });

    // 毛の1本1本（シェル毛皮の透明度に使う）。値が大きい点ほど長い毛
    Tex.furAlpha = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 26000; i++) {
            const v = Math.pow(Math.random(), 0.6) * 255 | 0;
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
    }, { color: false, repeat: [22, 22] });

    // 目: 緑から金色の虹彩（瞳孔は別の黒いメッシュ）
    Tex.iris = tex(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#f4efe2';
        ctx.fillRect(0, 0, w, h);
        const cx = w / 2, cy = h / 2;
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 70);
        g.addColorStop(0, '#caa53c');
        g.addColorStop(0.55, '#9cc24a');
        g.addColorStop(0.95, '#4f7a2a');
        g.addColorStop(1, '#2a3a18');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 72, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(60,80,20,0.35)';
        for (let i = 0; i < 90; i++) {
            const a = (i / 90) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
            ctx.lineTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70);
            ctx.stroke();
        }
    });
}
