// 画面の文字（HTML）・地図・巣の方向の矢印
import * as THREE from 'three';
import { CFG, MISSIONS, Save } from './config.js';

const $ = id => document.getElementById(id);
// 地図に描く範囲
const MAP = { x0: -20, x1: 150, z0: -5, z1: 110, px: 1.35 };

export class Hud {
    constructor(camera, world) {
        this.camera = camera;
        this.world = world;
        this.floaters = [];
        this.shownNarration = null;
        this.v = new THREE.Vector3();
        this.mapBg = this.drawMapBackground();
        this.lastMissions = '';
        this.alertT = 0;
    }

    show(id, on) {
        $(id).classList.toggle('hidden', !on);
    }

    drawMapBackground() {
        const c = document.createElement('canvas');
        c.width = Math.round((MAP.x1 - MAP.x0) * MAP.px);
        c.height = Math.round((MAP.z1 - MAP.z0) * MAP.px);
        const g = c.getContext('2d');
        const X = x => (x - MAP.x0) * MAP.px, Z = z => (z - MAP.z0) * MAP.px;
        g.fillStyle = '#3ea7d8';
        g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = '#f3dfa8';
        g.fillRect(0, 0, c.width, Z(52));
        g.fillStyle = '#80858f';
        g.fillRect(0, 0, c.width, Z(20));
        this.world.map.forEach(r => {
            g.fillStyle = r.color;
            g.fillRect(X(r.x0), Z(r.z0), Math.max(1, (r.x1 - r.x0) * MAP.px), Math.max(1, (r.z1 - r.z0) * MAP.px));
        });
        // 灯台
        g.fillStyle = '#e0453a';
        g.beginPath();
        g.arc(X(125), Z(72), 4, 0, Math.PI * 2);
        g.fill();
        return c;
    }

    showTitle(onStart) {
        this.show('title', true);
        this.show('hud', false);
        this.show('result', false);
        this.show('pause', false);
        this.show('other-game', true);
        const d = Save.data;
        const done = MISSIONS.filter(m => d.missions[m.id]).length;
        $('title-stats').textContent = d.runs ? `ベスト被害総額 ¥${d.best.toLocaleString()}　ミッション ${done}/${MISSIONS.length}　プレイ ${d.runs} 回` : '';
        $('title-start').onclick = onStart;
    }

    startRun() {
        this.show('title', false);
        this.show('hud', true);
        this.show('result', false);
        this.show('other-game', false);
        this.clearFloating();
        this.banner('スタート!', '3分間で、浜辺からできるだけ盗め');
    }

    clearFloating() {
        this.floaters.forEach(f => f.el.remove());
        this.floaters = [];
    }

    banner(big, sub) {
        const b = $('banner');
        b.innerHTML = `<div class="big">${big}</div><div>${sub || ''}</div>`;
        b.classList.remove('fade');
        void b.offsetWidth;
        b.classList.add('fade');
    }

    alert(text) {
        $('alert').textContent = text;
        this.alertT = 2.5;
    }

    combo(n) {
        const el = $('combo');
        el.textContent = `${n} 連続!`;
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
    }

    update(game, dt) {
        const b = game.bird;
        const left = Math.max(0, game.left);
        $('timer').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
        $('timer').classList.toggle('danger', left <= 20);
        $('yen').textContent = `¥${game.yen.toLocaleString()}`;
        $('best').textContent = `ベスト ¥${Save.data.best.toLocaleString()}`;
        $('weight').textContent = `${b.w.toFixed(2)} kg`;
        $('weight').classList.toggle('danger', b.w >= CFG.BURST_WARN);
        $('weight-bar').style.width = `${Math.min(100, b.w / CFG.BURST_WEIGHT * 100)}%`;
        $('weight-bar').className = b.w >= CFG.BURST_WARN ? 'danger' : '';
        $('stamina').style.width = `${Math.round(b.stamina * 100)}%`;
        $('stamina').className = b.stamina < 0.15 ? 'tired' : '';
        $('speed').textContent = `${Math.round(b.vel.length() * 3.6)} km/h　高さ ${Math.max(0, b.pos.y).toFixed(0)}m`;
        const modeText = { air: '', ground: '地上（スペースで飛ぶ）', water: '水の上（スペース連打で飛ぶ）', stun: 'ピヨピヨ…' }[b.mode];
        $('mode').textContent = modeText;

        // くわえている物と巣の方向
        this.show('carry', !!b.carry);
        if (b.carry) {
            const n = game.sp.nest;
            const dx = n.x - b.pos.x, dz = n.z - b.pos.z;
            const camDir = new THREE.Vector3();
            this.camera.getWorldDirection(camDir);
            const rel = Math.atan2(dz, dx) - Math.atan2(camDir.z, camDir.x);
            $('carry-name').textContent = `${b.carry.def.name} をくわえている → 灯台の巣へ（${Math.round(Math.hypot(dx, dz))}m）`;
            $('nest-arrow').style.transform = `rotate(${rel}rad)`;
        }

        this.alertT -= dt;
        this.show('alert', this.alertT > 0);

        // ミッション一覧（変わったときだけ書き直す）
        const ms = MISSIONS.map(m => `<li class="${Save.data.missions[m.id] ? 'done' : ''}">${Save.data.missions[m.id] ? '✔' : '□'} ${m.label}</li>`).join('');
        if (ms !== this.lastMissions) {
            this.lastMissions = ms;
            $('missions').innerHTML = ms;
        }

        const nr = game.narration;
        if (nr && nr !== this.shownNarration) {
            this.shownNarration = nr;
            $('narration').textContent = `天の声「${nr.text}」`;
        }
        const age = nr ? game.time - nr.at : 99;
        $('narration').style.opacity = game.state === 'play' ? Math.max(0, Math.min(1, (4 - age) / 0.5)) : 0;
        // 速いときは集中線
        const s = b.mode === 'air' ? b.vel.length() : 0;
        $('speedlines').style.opacity = Math.max(0, Math.min(0.7, (s - 15) / 10));

        this.drawMap(game);

        const w = window.innerWidth, h = window.innerHeight;
        this.floaters = this.floaters.filter(f => {
            f.t += dt;
            this.v.copy(f.pos).setY(f.pos.y + f.t * 0.6).project(this.camera);
            const on = this.v.z < 1 && Math.abs(this.v.x) < 1.3 && Math.abs(this.v.y) < 1.3;
            f.el.style.display = on ? 'block' : 'none';
            if (on) f.el.style.transform = `translate(-50%, -50%) translate(${(this.v.x + 1) / 2 * w}px, ${(1 - this.v.y) / 2 * h}px)`;
            f.el.style.opacity = Math.max(0, 1 - f.t / f.life);
            if (f.t >= f.life) {
                f.el.remove();
                return false;
            }
            return true;
        });
    }

    floatText(pos, text, color = '#fff', size = 20, life = 1.1) {
        const el = document.createElement('div');
        el.className = 'floater';
        el.textContent = text;
        el.style.color = color;
        el.style.fontSize = `${size}px`;
        $('floaters').appendChild(el);
        this.floaters.push({ el, pos: pos.clone(), t: 0, life });
    }

    drawMap(game) {
        const cv = $('minimap');
        const g = cv.getContext('2d');
        const b = game.bird;
        const X = x => (x - MAP.x0) * MAP.px, Z = z => (z - MAP.z0) * MAP.px;
        g.drawImage(this.mapBg, 0, 0);
        // 巣
        const n = game.sp.nest;
        g.fillStyle = b.carry ? '#ffd166' : '#ffffff';
        g.strokeStyle = '#3b2f2a';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(X(n.x), Z(n.z), b.carry ? 7 : 5, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = '#3b2f2a';
        g.font = '800 9px sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('巣', X(n.x), Z(n.z) + 0.5);
        // トンビ
        game.kites.forEach(k => {
            g.fillStyle = k.state === 'chase' ? '#ff4d6d' : '#7a5232';
            g.beginPath();
            g.arc(X(k.pos.x), Z(k.pos.z), 4, 0, Math.PI * 2);
            g.fill();
        });
        // 自分
        g.save();
        g.translate(X(b.pos.x), Z(b.pos.z));
        g.rotate(b.yaw);
        g.beginPath();
        g.moveTo(8, 0);
        g.lineTo(-5, 5);
        g.lineTo(-5, -5);
        g.closePath();
        g.fillStyle = '#ffffff';
        g.fill();
        g.strokeStyle = '#2a2020';
        g.lineWidth = 2;
        g.stroke();
        g.restore();
    }

    showResult(r) {
        $('result-title').textContent = r.title;
        $('result-yen').textContent = `被害総額 ¥${r.yen.toLocaleString()}${r.best ? '　ベスト更新!' : ''}`;
        $('result-rank').textContent = `称号: ${r.rank}`;
        $('result-stats').textContent = r.stats;
        $('result-missions').innerHTML = r.missions.map(m => `<div>ミッション達成: ${m}</div>`).join('');
        this.show('result', true);
    }
}
