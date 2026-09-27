// 画面の文字（HTML）と地図。3D の上に重ねる
import * as THREE from 'three';
import { CFG, Save } from './config.js';
import { TOWN } from './town.js';

const $ = id => document.getElementById(id);
const PX = 3.5; // 地図の 1m あたりのピクセル

export class Hud {
    constructor(camera, town) {
        this.camera = camera;
        this.town = town;
        this.floaters = [];
        this.bubbles = new Map();
        this.shownNarration = null;
        this.v = new THREE.Vector3();
        this.mapBg = this.drawMapBackground();
        this.lastObj = '';
    }

    show(id, on) {
        $(id).classList.toggle('hidden', !on);
    }

    // 地図の下地（道・建物）は最初に一度だけ描く
    drawMapBackground() {
        const c = document.createElement('canvas');
        c.width = TOWN.w * PX;
        c.height = TOWN.d * PX;
        const g = c.getContext('2d');
        g.fillStyle = '#80858f';
        g.fillRect(0, 0, c.width, c.height);
        const list = [...this.town.map].sort((a, b) => (b.ground ? 1 : 0) - (a.ground ? 1 : 0));
        list.forEach(r => {
            g.fillStyle = r.color;
            if (r.round) {
                g.beginPath();
                g.arc((r.x0 + r.x1) / 2 * PX, (r.z0 + r.z1) / 2 * PX, (r.x1 - r.x0) / 2 * PX, 0, Math.PI * 2);
                g.fill();
            } else {
                g.fillRect(r.x0 * PX, r.z0 * PX, Math.max(1, (r.x1 - r.x0) * PX), Math.max(1, (r.z1 - r.z0) * PX));
            }
        });
        return c;
    }

    // タイトル画面
    showTitle(onContinue, onNew) {
        this.show('title', true);
        this.show('hud', false);
        this.show('result', false);
        this.show('pause', false);
        const d = Save.data;
        const bosses = Object.values(d.bosses || {}).filter(Boolean).length;
        $('title-stats').textContent = d.started
            ? `倒したボス ${bosses}/3　猫缶バッジ ${d.badges.length}/10　最高体重 ${d.maxWeight.toFixed(1)} kg　総失敗 ${d.deaths} 回`
            : `総失敗 ${d.deaths} 回`;
        $('title-ending').classList.toggle('hidden', !d.cleared);
        const start = $('title-start');
        start.textContent = d.started ? 'つづきから' : 'はじめる';
        start.onclick = () => (d.started ? onContinue() : onNew());
        const fresh = $('title-new');
        fresh.classList.toggle('hidden', !d.started);
        fresh.onclick = () => {
            if (window.confirm('ボスとバッジの記録を消して、はじめから遊びますか？')) onNew();
        };
    }

    startGame() {
        this.show('title', false);
        this.show('hud', true);
        this.show('result', false);
        this.banner('デブ猫、町内会長になる。', '食べて太って、町のボス猫を倒せ');
        $('tips').innerHTML = '<div>WASD 移動 / Shift ダッシュ / スペース長押し ジャンプ / J 猫パンチ / F 吐く / E 鳴く（話しかける）/ 矢印キー 見回す / Esc メニュー</div>';
        this.clearFloating();
    }

    clearFloating() {
        this.floaters.forEach(f => f.el.remove());
        this.floaters = [];
        this.bubbles.forEach(b => b.el.remove());
        this.bubbles.clear();
    }

    banner(big, sub) {
        const banner = $('banner');
        banner.innerHTML = `<div class="big">${big}</div><div>${sub || ''}</div>`;
        banner.classList.remove('fade');
        void banner.offsetWidth;
        banner.classList.add('fade');
    }

    bossBanner(bs) {
        this.banner(`VS ${bs.def.name}`, `${bs.w}kg　${bs.def.where}`);
    }

    update(game, dt) {
        const c = game.cat;
        const b = CFG.body(c.w);
        $('weight').textContent = `${c.w.toFixed(1)} kg`;
        $('weight').classList.toggle('danger', c.w >= CFG.BURST_WARN);
        const jump = CFG.jumpHeight(c.w, 1);
        $('jump').textContent = `ジャンプ 最大 ${Math.round(jump * 100)}cm`;
        $('width').textContent = `体の幅 ${Math.round(b.width * 100)}cm`;
        const st = $('stamina');
        st.style.width = `${Math.round(c.stamina * 100)}%`;
        st.className = c.tired ? 'tired' : c.dashing ? 'dash' : '';
        $('area').textContent = game.areaName();

        // ヒントは近いボスのぶんだけ出す（画面をふさがないように）
        const list = game.objectives();
        const focus = game.focusObjective(list);
        const obj = list.map((o, i) =>
            `<li class="${o.done ? 'done' : ''} ${o.locked ? 'locked' : ''}">${o.done ? '✔' : '□'} ${o.label}${i === focus ? `<span class="hint">${o.hint}</span>` : ''}</li>`
        ).join('') + `<li class="badges">猫缶バッジ ${Save.data.badges.length}/10</li>`;
        if (obj !== this.lastObj) {
            this.lastObj = obj;
            $('objectives').innerHTML = obj;
        }

        // ボスの体力
        const bs = game.activeBoss;
        this.show('bossbar', !!bs);
        if (bs) {
            $('boss-name').textContent = `${bs.def.name}  ${bs.w}kg`;
            $('boss-hp').style.width = `${bs.hp}%`;
            const ratio = c.w / bs.w;
            $('boss-note').textContent = ratio < 0.75 ? `体重が足りない（あと ${(bs.w * 0.75 - c.w).toFixed(1)}kg でパンチが効く）` : ratio >= 1.4 ? '体重で圧倒している' : '互角';
        }

        let center = '';
        if (c.stuck && game.state === 'play') center = `詰まった!!　F で吐いて痩せろ　${c.stuckT.toFixed(1)}`;
        else if (c.w >= CFG.BURST_WARN && game.state === 'play') center = `破裂まで あと ${(CFG.BURST_WEIGHT - c.w).toFixed(1)} kg`;
        $('warning').textContent = center;
        this.show('warning', !!center);

        const n = game.narration;
        if (n && n !== this.shownNarration) {
            this.shownNarration = n;
            $('narration').textContent = `天の声「${n.text}」`;
        }
        const age = n ? game.time - n.at : 99;
        $('narration').style.opacity = game.state === 'play' ? Math.max(0, Math.min(1, (4 - age) / 0.5)) : 0;

        this.drawMap(game);

        // 3D 空間に置いた文字（「モグ +0.5kg」など）
        const w = window.innerWidth, h = window.innerHeight;
        this.floaters = this.floaters.filter(f => {
            f.t += dt;
            this.place(f.el, this.v.copy(f.pos).setY(f.pos.y + f.t * 0.5), w, h);
            f.el.style.opacity = Math.max(0, 1 - f.t / f.life);
            if (f.t >= f.life) {
                f.el.remove();
                return false;
            }
            return true;
        });
        // 吹き出し
        for (const [who, bb] of this.bubbles) {
            bb.t += dt;
            this.place(bb.el, this.bubblePos(who), w, h);
            bb.el.style.opacity = Math.max(0, Math.min(1, (bb.life - bb.t) / 0.4));
            if (bb.t >= bb.life) {
                bb.el.remove();
                this.bubbles.delete(who);
            }
        }
    }

    place(el, pos, w, h) {
        this.v.copy(pos).project(this.camera);
        const on = this.v.z < 1 && Math.abs(this.v.x) < 1.2 && Math.abs(this.v.y) < 1.2;
        el.style.display = on ? 'block' : 'none';
        if (on) el.style.transform = `translate(-50%, -100%) translate(${(this.v.x + 1) / 2 * w}px, ${(1 - this.v.y) / 2 * h}px)`;
    }

    bubblePos(who) {
        if (who.headPos) return who.headPos().setY(who.headPos().y + 0.15);
        if (who.w) return who.pos.clone().setY(who.pos.y + CFG.body(who.w).height + 0.25);
        return who.pos.clone().setY(who.kind === 'grandma' ? 1.6 : 2.0);
    }

    bubble(who, text, life = 4) {
        let bb = this.bubbles.get(who);
        if (!bb) {
            const el = document.createElement('div');
            el.className = 'bubble';
            $('floaters').appendChild(el);
            bb = { el };
            this.bubbles.set(who, bb);
        }
        bb.el.textContent = text;
        bb.t = 0;
        bb.life = life;
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
        const c = game.cat;
        g.drawImage(this.mapBg, 0, 0);
        const dot = (x, z, r, fill, stroke = '#2a2020') => {
            g.beginPath();
            g.arc(x * PX, z * PX, r, 0, Math.PI * 2);
            g.fillStyle = fill;
            g.fill();
            g.lineWidth = 1.5;
            g.strokeStyle = stroke;
            g.stroke();
        };
        g.font = '800 10px sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        // 家
        const hm = game.sp.home;
        g.fillStyle = '#c99a5f';
        g.fillRect(hm.x * PX - 5, hm.z * PX - 4, 10, 8);
        g.fillStyle = '#fff';
        g.fillText('家', hm.x * PX, hm.z * PX - 11);
        game.npcs.forEach(n => dot(n.pos.x, n.pos.z, 3, '#ffffff'));
        Object.values(game.bosses).forEach(bs => {
            const done = bs.state === 'defeated';
            dot(bs.pos.x, bs.pos.z, 6, done ? '#9aa0a8' : '#ff4d6d');
            g.fillStyle = '#fff';
            g.fillText(done ? '✔' : bs.def.name[0], bs.pos.x * PX, bs.pos.z * PX + 0.5);
        });
        if (Object.values(game.bosses).every(bs => bs.state === 'defeated')) {
            const s = game.sp.seat;
            dot((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, 6, '#ffd166');
            g.fillStyle = '#3b2f2a';
            g.fillText('座', (s.x0 + s.x1) / 2 * PX, (s.z0 + s.z1) / 2 * PX + 0.5);
        }
        if (game.truck.active) {
            g.fillStyle = '#7cc6f0';
            g.fillRect(game.truck.pos.x * PX - 9, game.truck.pos.z * PX - 3.5, 18, 7);
        }
        // 自分（向きつきの三角）
        g.save();
        g.translate(c.pos.x * PX, c.pos.z * PX);
        g.rotate(c.heading);
        g.beginPath();
        g.moveTo(8, 0);
        g.lineTo(-5, 5);
        g.lineTo(-5, -5);
        g.closePath();
        g.fillStyle = '#ffb347';
        g.fill();
        g.strokeStyle = '#2a2020';
        g.lineWidth = 2;
        g.stroke();
        g.restore();
    }

    showResult(kind, info, onRetry, onNext) {
        const r = $('result');
        r.className = `overlay ${kind === 'clear' ? 'clear' : 'fail'}`;
        $('result-title').textContent = info.title;
        $('result-line').textContent = info.line;
        $('result-stats').textContent = info.stats;
        $('result-retry').onclick = onRetry;
        $('result-retry').classList.toggle('hidden', !onRetry);
        $('result-retry').textContent = info.retryLabel || 'もう一回';
        $('result-next').onclick = onNext;
        $('result-next').classList.toggle('hidden', !onNext);
        $('result-next').textContent = info.nextLabel || '次へ';
        this.show('result', true);
        this.show('bossbar', false);
    }

    hideResult() {
        this.show('result', false);
    }
}
