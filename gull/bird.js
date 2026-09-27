// アニメ調のカモメ。太ると体だけ丸くなり、翼はそのまま（だから飛びにくい）
// ローカル座標: +x が前、+y が上、翼は ±z。root の位置は体の中心。
import * as THREE from 'three';
import { CFG } from './config.js';
import { toon, addOutline, refreshOutlines } from './toon.js';

function part(geo, mat, line = 0.012) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    if (line) addOutline(m, line);
    return m;
}

// 目（白目・黒目・ハイライト）と、ふてぶてしいまゆ毛
function eyeTexture(mood) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 128, 128);
    if (mood === 'shut') {
        g.strokeStyle = '#2a2020';
        g.lineWidth = 12;
        g.beginPath();
        g.arc(64, 50, 34, 0.2 * Math.PI, 0.8 * Math.PI);
        g.stroke();
    } else {
        g.fillStyle = '#f2c230';
        g.beginPath();
        g.arc(64, 68, 44, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#1e1a18';
        g.beginPath();
        g.arc(64, 70, mood === 'wide' ? 16 : 26, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(52, 54, 11, 0, Math.PI * 2);
        g.fill();
    }
    // まゆ毛（上半分を灰色で隠して半目に）
    if (mood !== 'wide') {
        g.fillStyle = '#9aa4ae';
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(128, 0);
        g.lineTo(128, 46);
        g.lineTo(0, 30);
        g.fill();
        g.strokeStyle = '#2a2020';
        g.lineWidth = 8;
        g.beginPath();
        g.moveTo(0, 30);
        g.lineTo(128, 46);
        g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export class Gull {
    constructor() {
        this.root = new THREE.Group();
        this.tilt = new THREE.Group(); // 機体の向き（ピッチ・ロール）
        this.root.add(this.tilt);
        this.body = new THREE.Group();
        this.tilt.add(this.body);
        const white = toon(0xfbfbf8);
        const grey = toon(0xb3bdc7);
        const black = toon(0x2e2a30);
        const yellow = toon(0xf5c542);
        const orange = toon(0xf08a3c);

        this.torso = part(new THREE.SphereGeometry(1, 24, 16), white);
        this.torso.scale.set(0.32, 0.19, 0.18);
        this.body.add(this.torso);
        // 背中の灰色
        this.back = part(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), grey, 0);
        this.back.scale.set(0.31, 0.2, 0.175);
        this.back.position.y = 0.005;
        this.body.add(this.back);

        this.head = new THREE.Group();
        this.head.position.set(0.3, 0.12, 0);
        this.body.add(this.head);
        this.head.add(part(new THREE.SphereGeometry(0.13, 20, 14), white));
        this.eyeTex = { normal: eyeTexture('normal'), wide: eyeTexture('wide'), shut: eyeTexture('shut') };
        this.eyeMat = new THREE.MeshBasicMaterial({ map: this.eyeTex.normal });
        [-1, 1].forEach(s => {
            // 頭の表面に貼った丸い目（外側やや前向き）
            const dir = new THREE.Vector3(0.55, 0.25, s).normalize();
            const eye = new THREE.Mesh(new THREE.CircleGeometry(0.048, 20), this.eyeMat);
            eye.position.copy(dir).multiplyScalar(0.131);
            eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
            const rim = new THREE.Mesh(new THREE.CircleGeometry(0.056, 20), new THREE.MeshBasicMaterial({ color: 0x2a2020 }));
            rim.position.copy(dir).multiplyScalar(0.129);
            rim.quaternion.copy(eye.quaternion);
            this.head.add(rim, eye);
        });
        const beak = part(new THREE.ConeGeometry(0.04, 0.2, 12).rotateZ(-Math.PI / 2), yellow, 0.008);
        beak.scale.set(1, 0.9, 0.8);
        beak.position.set(0.2, -0.01, 0);
        this.head.add(beak);
        const spot = part(new THREE.SphereGeometry(0.014, 8, 6), toon(0xe0453a), 0);
        spot.position.set(0.24, -0.03, 0);
        this.head.add(spot);
        // くちばしの先: くわえた食べ物をここに付ける
        this.mouth = new THREE.Group();
        this.mouth.position.set(0.28, -0.05, 0);
        this.head.add(this.mouth);

        const tail = part(new THREE.BoxGeometry(0.2, 0.03, 0.16), white, 0.008);
        tail.position.set(-0.36, 0.03, 0);
        const tailTip = part(new THREE.BoxGeometry(0.06, 0.032, 0.16), black, 0);
        tailTip.position.set(-0.47, 0.03, 0);
        this.tail = new THREE.Group();
        this.tail.add(tail, tailTip);
        this.body.add(this.tail);

        // 翼: 肩 → 腕（灰色）→ 手先（黒）
        this.wings = [-1, 1].map(s => {
            const shoulder = new THREE.Group();
            shoulder.position.set(0.02, 0.1, s * 0.12);
            const inner = part(new THREE.SphereGeometry(1, 14, 8), grey, 0.01);
            inner.scale.set(0.15, 0.025, 0.22);
            inner.position.set(-0.03, 0, s * 0.2);
            shoulder.add(inner);
            const elbow = new THREE.Group();
            elbow.position.set(0, 0, s * 0.4);
            shoulder.add(elbow);
            const outer = part(new THREE.SphereGeometry(1, 14, 8), grey, 0.01);
            outer.scale.set(0.11, 0.02, 0.22);
            outer.position.set(-0.05, 0, s * 0.18);
            const tip = part(new THREE.SphereGeometry(1, 12, 8), black, 0.008);
            tip.scale.set(0.07, 0.018, 0.1);
            tip.position.set(-0.08, 0, s * 0.36);
            elbow.add(outer, tip);
            this.body.add(shoulder);
            return { shoulder, elbow, s, flap: 0 };
        });
        this.legs = [-1, 1].map(s => {
            const leg = new THREE.Group();
            leg.position.set(0, -0.14, s * 0.07);
            const shin = part(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), orange, 0.004);
            shin.position.y = -0.08;
            const foot = part(new THREE.ConeGeometry(0.05, 0.02, 3).rotateZ(-Math.PI / 2), orange, 0.004);
            foot.position.set(0.03, -0.16, 0);
            leg.add(shin, foot);
            this.body.add(leg);
            return leg;
        });
        this.shadow = new THREE.Mesh(
            new THREE.CircleGeometry(0.35, 24).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })
        );
        this.shadow.renderOrder = 1;
        this.phase = 0;
        this.mood = 'normal';
    }

    // 片方の翼を羽ばたかせる（0: 左, 1: 右）
    flap(i) {
        this.wings[i].flap = 1;
    }

    setMood(m) {
        if (m === this.mood) return;
        this.mood = m;
        this.eyeMat.map = this.eyeTex[m];
        this.eyeMat.needsUpdate = true;
    }

    // s: { w, t, mode: 'air'|'ground'|'water'|'stun', speed, pitch, roll, walk, dive }
    update(s, dt) {
        const sc = CFG.scale(s.w);
        const fat = 1 + (s.w - 1) * 0.32;
        this.body.scale.setScalar(sc);
        this.torso.scale.set(0.32 * (1 + (s.w - 1) * 0.12), 0.19 * fat, 0.18 * fat);
        this.back.scale.set(0.31 * (1 + (s.w - 1) * 0.12), 0.2 * fat, 0.175 * fat);
        this.head.position.y = 0.12 + (fat - 1) * 0.08;
        // ピッチ（機首の上下）のあとに、前後の軸まわりのロール
        this.tilt.rotation.set(s.roll || 0, 0, s.pitch || 0, 'ZXY');
        this.phase += dt;
        const air = s.mode === 'air';
        this.wings.forEach(wg => {
            wg.flap = Math.max(0, wg.flap - dt * 4.5);
            const k = wg.flap;
            let sh, el;
            if (air || s.mode === 'stun') {
                // 羽ばたき: 振り上げてから打ち下ろす
                const beat = k > 0 ? Math.sin((1 - k) * Math.PI * 2) : 0;
                sh = -0.1 + beat * 0.9 + (s.dive ? 0.5 : 0);
                el = beat * 0.4 + (s.dive ? 0.9 : 0);
                if (s.mode === 'stun') { sh = Math.sin(this.phase * 30) * 0.8; el = 0.5; }
            } else {
                // 地上・水上では翼をたたむ
                sh = k > 0 ? Math.sin((1 - k) * Math.PI * 2) * 0.9 + 0.3 : 1.35;
                el = k > 0 ? 0.3 : 2.6;
            }
            wg.shoulder.rotation.x = -wg.s * sh;
            wg.elbow.rotation.x = -wg.s * el * 0.5;
            wg.elbow.rotation.y = wg.s * (k > 0 || air ? 0 : 0.9);
            // たたんだときは後ろに流す
            wg.shoulder.rotation.y = air || k > 0 ? 0 : -wg.s * 0.9;
        });
        const walk = s.mode === 'ground' ? s.walk || 0 : 0;
        this.legs.forEach((l, i) => {
            l.visible = s.mode !== 'air' || s.speed < 4;
            l.rotation.z = walk > 0 ? Math.sin(this.phase * 14 + i * Math.PI) * 0.6 : air ? 1.2 : 0;
        });
        this.body.position.y = s.mode === 'ground' ? Math.abs(Math.sin(this.phase * 14)) * 0.02 * (walk > 0 ? 1 : 0) : 0;
        this.body.rotation.z = s.mode === 'ground' && walk > 0 ? Math.sin(this.phase * 14) * 0.08 : 0;
        this.tail.rotation.z = air ? -(s.pitch || 0) * 0.3 : 0.2;
        this.setMood(s.mode === 'stun' ? 'shut' : s.dive || s.alarm ? 'wide' : 'normal');
        refreshOutlines(this.root);
    }

    // 足元までの高さ（地上に立つとき）
    legHeight(w) {
        return 0.3 * CFG.scale(w) * (1 + (w - 1) * 0.15);
    }
}
