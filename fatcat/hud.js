// 画面の文字（HTML）。3D の上に重ねる
import * as THREE from 'three';
import { CFG, Save } from './config.js';
import { STAGES } from './stages.js';

const $ = id => document.getElementById(id);

export class Hud {
    constructor(camera) {
        this.camera = camera;
        this.floaters = [];
        this.shownNarration = null;
        this.v = new THREE.Vector3();
    }

    show(id, on) {
        $(id).classList.toggle('hidden', !on);
    }

    // タイトル画面
    showTitle(onStart, ending) {
        this.show('title', true);
        this.show('hud', false);
        this.show('result', false);
        this.show('pause', false);
        const u = Save.data.unlocked;
        $('title-stats').textContent = `総失敗 ${Save.data.deaths} 回　最高体重 ${Save.data.maxWeight.toFixed(1)} kg　累計被害総額 ¥${(Save.data.damageTotal || 0).toLocaleString()}`;
        $('title-ending').classList.toggle('hidden', !ending);
        const start = $('title-start');
        start.textContent = u > 0 ? `つづきから（STAGE ${u + 1}）` : 'はじめる';
        start.onclick = () => onStart(u);
        const list = $('title-stages');
        list.innerHTML = '';
        STAGES.forEach((st, i) => {
            const b = document.createElement('button');
            const open = i <= u;
            const best = Save.data.best[i];
            b.textContent = open ? `${i + 1}. ${st.name}${best ? `  ${best.toFixed(1)}s` : ''}` : `${i + 1}. ？？？`;
            b.disabled = !open;
            b.onclick = () => onStart(i);
            list.appendChild(b);
        });
    }

    startStage(stage, index) {
        this.show('title', false);
        this.show('hud', true);
        this.show('result', false);
        $('stage-name').textContent = `STAGE ${index + 1}　${stage.name}`;
        const banner = $('banner');
        banner.innerHTML = `<div class="big">STAGE ${index + 1}　${stage.name}</div><div>${stage.sub}</div>`;
        banner.classList.remove('fade');
        void banner.offsetWidth;
        banner.classList.add('fade');
        $('tips').innerHTML = (stage.tips || []).map(t => `<div>${t}</div>`).join('');
        this.floaters.forEach(f => f.el.remove());
        this.floaters = [];
    }

    update(game, dt) {
        const c = game.cat;
        const b = CFG.body(c.w);
        $('weight').textContent = `${c.w.toFixed(1)} kg`;
        $('weight').classList.toggle('danger', c.w >= CFG.BURST_WARN);
        const jump = CFG.jumpHeight(c.w, 1);
        $('jump').textContent = `ジャンプ 最大 ${Math.round(jump * 100)}cm`;
        const underSofa = b.height * CFG.CROUCH_RATIO < 0.2;
        $('sofa').textContent = `ソファの下 ${underSofa ? '○ 入れる' : '× 入れない'}`;
        $('sofa').className = underSofa ? 'ok' : 'ng';
        $('damage').textContent = `被害総額 ¥${game.damage.toLocaleString()}`;
        $('timer').textContent = game.stage.timeLimit ? `残り ${Math.max(0, game.stage.timeLimit - game.time).toFixed(0)} 秒` : `${game.time.toFixed(1)} 秒`;
        $('timer').classList.toggle('danger', !!game.stage.timeLimit && game.stage.timeLimit - game.time < 15);

        $('objectives').innerHTML = game.objectives.map(o => {
            let extra = '';
            if (o.type === 'treats') extra = `（${Math.min(o.count, game.eaten.treat || 0)}/${o.count}）`;
            if (o.type === 'stay' && o.timer > 0 && !o.done) extra = `（${o.timer.toFixed(1)}秒）`;
            return `<li class="${o.done ? 'done' : ''}">${o.done ? '✔' : '□'} ${o.label}${extra}${!o.done && o.hint ? `<span class="hint">${o.hint}</span>` : ''}</li>`;
        }).join('');

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

        // 3D 空間に置いた文字（「モグ +0.5kg」など）
        const w = window.innerWidth, h = window.innerHeight;
        this.floaters = this.floaters.filter(f => {
            f.t += dt;
            this.v.copy(f.pos).setY(f.pos.y + f.t * 0.5).project(this.camera);
            const on = this.v.z < 1;
            f.el.style.display = on ? 'block' : 'none';
            f.el.style.transform = `translate(-50%, -50%) translate(${(this.v.x + 1) / 2 * w}px, ${(1 - this.v.y) / 2 * h}px)`;
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

    showResult(kind, info, onRetry, onNext) {
        const r = $('result');
        r.className = kind === 'clear' ? 'clear' : 'fail';
        $('result-title').textContent = info.title;
        $('result-line').textContent = info.line;
        $('result-stats').textContent = info.stats;
        $('result-retry').onclick = onRetry;
        $('result-next').onclick = onNext;
        $('result-next').classList.toggle('hidden', !onNext);
        $('result-next').textContent = info.nextLabel || '次のステージ';
        this.show('result', true);
    }

    hideResult() {
        this.show('result', false);
    }
}
