// 3D の茶トラ猫。体重に合わせて体の形を作り直し、毛は「シェル」を重ねてふわふわに見せる。
// 猫のローカル座標: +x が前、+y が上。root の位置は足元。
import * as THREE from 'three';
import { CFG } from './config.js';
import { Tex } from './textures.js';

const SHELLS = 10;

// シェル毛皮: 同じ形を法線方向に少しずつ膨らませ、毛の点だけ残して重ねる
function makeShellMaterials(map) {
    const mats = [];
    for (let i = 1; i <= SHELLS; i++) {
        const k = i / SHELLS;
        const m = new THREE.MeshStandardMaterial({
            map,
            alphaMap: Tex.furAlpha,
            alphaTest: 0.2 + 0.75 * k,
            roughness: 1,
            side: THREE.FrontSide
        });
        m.color.setScalar(0.7 + 0.25 * k);
        const offset = { value: 0 };
        m.userData.offset = offset;
        m.userData.k = k;
        m.onBeforeCompile = sh => {
            sh.uniforms.furOffset = offset;
            sh.vertexShader = sh.vertexShader
                .replace('#include <common>', '#include <common>\nuniform float furOffset;')
                .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * furOffset;');
        };
        m.customProgramCacheKey = () => 'catfur';
        mats.push(m);
    }
    return mats;
}

function addShells(parent, geometry, mats) {
    return mats.map(m => {
        const s = new THREE.Mesh(geometry, m);
        s.castShadow = false;
        s.receiveShadow = true;
        parent.add(s);
        return s;
    });
}

// 胴体の形: 前後方向に楕円の断面を並べる。u=0 がお腹、u=0.5 が背中
function torsoGeometry(b) {
    const nL = 30, nA = 32;
    const L = b.length, hw = b.width / 2;
    const torsoH = Math.max(0.1, b.height - b.leg);
    const hh = torsoH / 2;
    const fat = b.fat;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= nL; i++) {
        const t = i / nL;
        const x = (t - 0.5) * L;
        const prof = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * t - 1), 3.2)), 0.5);
        const chest = 1 + 0.12 * Math.exp(-Math.pow((t - 0.7) / 0.16, 2));
        const hips = 1 + 0.06 * Math.exp(-Math.pow((t - 0.25) / 0.14, 2));
        const belly = fat * Math.exp(-Math.pow((t - 0.48) / 0.3, 2));
        const rx = hw * prof * chest * hips * (1 + belly * 0.25);
        const ry = hh * prof * chest * (1 + belly * 0.15);
        for (let j = 0; j <= nA; j++) {
            const a = (j / nA) * Math.PI * 2;
            const down = Math.max(0, Math.cos(a));
            const y = -Math.cos(a) * ry * (1 + down * belly * 0.6) + Math.sin(Math.PI * t) * (fat * 0.02);
            const z = Math.sin(a) * rx;
            pos.push(x, y, z);
            uv.push(j / nA, t);
        }
    }
    for (let i = 0; i < nL; i++) {
        for (let j = 0; j < nA; j++) {
            const a = i * (nA + 1) + j, b2 = a + nA + 1;
            idx.push(a, b2, a + 1, a + 1, b2, b2 + 1);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.userData.torsoH = torsoH;
    return g;
}

// 太さの変わるチューブ（しっぽ）。毎フレーム頂点だけ更新する
class TaperedTube {
    constructor(segments, radial) {
        this.n = segments;
        this.r = radial;
        const count = (segments + 1) * (radial + 1);
        this.geometry = new THREE.BufferGeometry();
        this.pos = new Float32Array(count * 3);
        const uv = [];
        const idx = [];
        for (let i = 0; i <= segments; i++) {
            for (let j = 0; j <= radial; j++) uv.push(j / radial, i / segments);
        }
        for (let i = 0; i < segments; i++) {
            for (let j = 0; j < radial; j++) {
                const a = i * (radial + 1) + j, b = a + radial + 1;
                idx.push(a, a + 1, b, a + 1, b + 1, b);
            }
        }
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        this.geometry.setIndex(idx);
        this.tmp = { t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 0, 1) };
    }

    update(points, radii) {
        const { t, n, b, up } = this.tmp;
        for (let i = 0; i <= this.n; i++) {
            const p = points[i];
            const q = points[Math.min(this.n, i + 1)];
            const o = points[Math.max(0, i - 1)];
            t.subVectors(q, o).normalize();
            b.crossVectors(t, up);
            if (b.lengthSq() < 1e-6) b.set(0, 1, 0);
            b.normalize();
            n.crossVectors(b, t).normalize();
            for (let j = 0; j <= this.r; j++) {
                const a = (j / this.r) * Math.PI * 2;
                const k = (i * (this.r + 1) + j) * 3;
                const c = Math.cos(a) * radii[i], s = Math.sin(a) * radii[i];
                this.pos[k] = p.x + n.x * c + b.x * s;
                this.pos[k + 1] = p.y + n.y * c + b.y * s;
                this.pos[k + 2] = p.z + n.z * c + b.z * s;
            }
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeVertexNormals();
        this.geometry.computeBoundingSphere();
    }
}

export class CatModel {
    constructor() {
        this.root = new THREE.Group();
        this.body = new THREE.Group(); // 胴体・頭・しっぽ（体の上下動はここ）
        this.root.add(this.body);

        this.bodyMat = new THREE.MeshStandardMaterial({ map: Tex.catBody, roughness: 0.95 });
        this.headMat = new THREE.MeshStandardMaterial({ map: Tex.catHead, roughness: 0.95 });
        this.tailMat = new THREE.MeshStandardMaterial({ map: Tex.catTail, roughness: 0.95 });
        this.legMat = new THREE.MeshStandardMaterial({ color: 0xd98a3d, roughness: 0.95 });
        this.pawMat = new THREE.MeshStandardMaterial({ color: 0xf6e3c6, roughness: 0.9 });
        this.bodyShellMats = makeShellMaterials(Tex.catBody);
        this.headShellMats = makeShellMaterials(Tex.catHead);
        this.tailShellMats = makeShellMaterials(Tex.catTail);

        // 胴体
        this.torso = new THREE.Mesh(new THREE.BufferGeometry(), this.bodyMat);
        this.torso.castShadow = true;
        this.torso.receiveShadow = true;
        this.body.add(this.torso);
        this.torsoShells = addShells(this.torso, this.torso.geometry, this.bodyShellMats);

        // 頭
        this.neck = new THREE.Group();
        this.body.add(this.neck);
        this.head = new THREE.Group();
        this.neck.add(this.head);
        const headGeo = new THREE.SphereGeometry(1, 40, 28);
        const skull = new THREE.Mesh(headGeo, this.headMat);
        skull.scale.set(1, 0.9, 1.08);
        skull.castShadow = true;
        this.head.add(skull);
        addShells(skull, headGeo, this.headShellMats);
        this.skull = skull;

        const pink = new THREE.MeshStandardMaterial({ color: 0xe89aa2, roughness: 0.6 });
        const cream = new THREE.MeshStandardMaterial({ color: 0xfbf1e1, roughness: 0.9 });
        this.ears = [-1, 1].map(s => {
            const ear = new THREE.Group();
            const outer = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.75, 16, 1, true), this.legMat);
            outer.material = this.legMat;
            outer.scale.z = 0.55;
            const inner = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 16), pink);
            inner.scale.z = 0.3;
            inner.position.set(0.06, -0.05, 0);
            ear.add(outer, inner);
            ear.position.set(-0.05, 0.72, s * 0.48);
            ear.rotation.set(s * 0.32, 0, -0.12);
            this.head.add(ear);
            return ear;
        });

        const irisMat = new THREE.MeshPhysicalMaterial({ map: Tex.iris, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1 });
        const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.eyes = [-1, 1].map(s => {
            const eye = new THREE.Group();
            const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), irisMat);
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), pupilMat);
            pupil.position.x = 0.012;
            const shine = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), shineMat);
            shine.position.set(0.22, 0.08, -0.06);
            eye.add(ball, pupil, shine);
            eye.position.set(0.72, 0.18, s * 0.36);
            eye.rotation.y = -s * 0.42;
            this.head.add(eye);
            return { eye, pupil };
        });
        [-1, 1].forEach(s => {
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), cream);
            m.position.set(0.8, -0.26, s * 0.15);
            this.head.add(m);
        });
        const chin = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), cream);
        chin.scale.set(1, 0.7, 1.2);
        chin.position.set(0.6, -0.48, 0);
        this.head.add(chin);
        this.mouth = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshStandardMaterial({ color: 0x5a1a22 }));
        this.mouth.position.set(0.82, -0.42, 0);
        this.mouth.scale.set(0.5, 0.01, 1);
        this.head.add(this.mouth);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), pink);
        nose.scale.set(0.8, 0.6, 1.2);
        nose.position.set(1.0, -0.1, 0);
        this.head.add(nose);
        const wp = [];
        [-1, 1].forEach(s => {
            for (let k = 0; k < 3; k++) {
                wp.push(new THREE.Vector3(0.92, -0.26, s * 0.2), new THREE.Vector3(1.55, -0.2 - k * 0.12, s * (0.85 + k * 0.1)));
            }
        });
        this.head.add(new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(wp),
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
        ));

        // 足（付け根 → ひざ → 足先）
        const capsule = (r, len) => {
            const g = new THREE.CapsuleGeometry(r, len, 6, 12);
            g.translate(0, -len / 2, 0);
            return g;
        };
        this.legs = [0, 1, 2, 3].map(i => {
            const front = i < 2, side = i % 2 ? 1 : -1;
            const hip = new THREE.Group();
            const upper = new THREE.Mesh(capsule(1, 1), this.legMat);
            upper.castShadow = true;
            const knee = new THREE.Group();
            const lower = new THREE.Mesh(capsule(1, 1), this.legMat);
            lower.castShadow = true;
            const paw = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), this.pawMat);
            paw.castShadow = true;
            hip.add(upper, knee);
            knee.add(lower, paw);
            this.body.add(hip);
            return { hip, upper, knee, lower, paw, front, side };
        });

        // しっぽ
        this.tailTube = new TaperedTube(24, 12);
        this.tail = new THREE.Mesh(this.tailTube.geometry, this.tailMat);
        this.tail.castShadow = true;
        this.body.add(this.tail);
        addShells(this.tail, this.tailTube.geometry, this.tailShellMats);
        this.tailPts = Array.from({ length: 25 }, () => new THREE.Vector3());
        this.tailRadii = new Array(25).fill(0.02);

        // 足元の影（本物の影に加えて接地感を出す）
        this.contact = new THREE.Mesh(
            new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
        );
        this.contact.renderOrder = 1;
        this.root.add(this.contact);

        this.builtW = -1;
        this.phase = 0;
        this.blinkT = 2;
        this.earTwitch = 0;
    }

    rebuild(w) {
        const b = CFG.body(w);
        this.b = b;
        const g = torsoGeometry(b);
        this.torso.geometry.dispose();
        this.torso.geometry = g;
        this.torsoShells.forEach(s => { s.geometry = g; });
        this.builtW = w;
    }

    setFur(len, headScale) {
        this.bodyShellMats.forEach(m => { m.userData.offset.value = len * m.userData.k; });
        this.tailShellMats.forEach(m => { m.userData.offset.value = len * 0.9 * m.userData.k; });
        this.headShellMats.forEach(m => { m.userData.offset.value = (len * 0.7 / headScale) * m.userData.k; });
    }

    // s: 見た目の状態（体重・動き・ポーズ）
    update(s, dt) {
        if (Math.abs(s.w - this.builtW) > 0.08) this.rebuild(s.w);
        const b = this.b;
        const t = s.t;
        const L = b.length, hw = b.width / 2, Hr = b.head;
        const torsoH = this.torso.geometry.userData.torsoH;
        const squeeze = s.squeeze ? 1 : 0;
        const crouch = Math.max(s.crouch || 0, squeeze * 0.9, s.eating ? 0.35 : 0);
        const loaf = s.loaf || s.sleep;
        const scared = s.scared || 0;
        const speed = s.speed || 0;

        // 歩き: 速いほど足の回転が速い
        this.phase += dt * (speed > 0.05 ? 5 + speed * 7 / Math.max(0.5, L * 2) : 0);
        const cyc = this.phase;

        // 体の高さ
        let hipY = b.leg * (1 - crouch * 0.55) + torsoH * 0.46;
        if (loaf) hipY = torsoH * 0.5;
        if (scared) hipY += b.leg * 0.8 * scared;
        const bob = speed > 0.05 && s.onGround ? Math.abs(Math.sin(cyc)) * 0.012 : 0;
        const breath = 1 + Math.sin(t * (s.w > CFG.BURST_WARN ? 16 : s.sleep ? 1.6 : 3)) * (s.w > CFG.BURST_WARN ? 0.035 : 0.012);
        const wiggle = (s.charge || 0) > 0 ? Math.sin(t * 28) * 0.18 * s.charge : 0;
        this.body.position.y = hipY + bob;
        this.body.rotation.set(0, 0, 0);
        this.torso.scale.set(1, breath * (1 + scared * 0.12), breath);
        this.torso.rotation.set(wiggle * 0.3, wiggle * 0.25, scared * 0.12 + (s.air ? s.airPitch : 0));

        // 頭と首
        const lookYaw = Math.max(-0.9, Math.min(0.9, s.lookYaw || 0));
        let headDown = crouch * 0.1 + (s.eating ? 0.55 + Math.sin(t * 18) * 0.1 : 0) + (s.hack ? 0.35 : 0);
        if (s.sleep) headDown = 0.2;
        this.neck.position.set(L * 0.44, torsoH * 0.18 - crouch * torsoH * 0.12, 0);
        if (loaf) this.neck.position.y = torsoH * 0.1;
        this.head.scale.setScalar(Hr);
        this.head.position.set(Hr * 0.55, Hr * 0.35, 0);
        this.head.rotation.set(s.sleep ? 0.5 : Math.sin(t * 0.7) * 0.05, s.sleep ? 0.9 : lookYaw, -headDown + (s.meow ? 0.25 : 0));
        if (s.sleep) this.neck.position.set(L * 0.36, torsoH * 0.02, hw * 0.4);
        this.mouth.scale.y = s.meow || s.hack || s.eating ? 0.5 + Math.abs(Math.sin(t * 20)) * 0.3 : 0.01;

        // まばたき・瞳孔（狩りやびっくりで真ん丸）
        this.blinkT -= dt;
        if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 4;
        const closed = s.sleep || s.hack ? 1 : this.blinkT < 0 ? 1 : 0;
        const dilate = s.high ? 1 : Math.max(crouch > 0.3 ? 0.9 : 0, scared ? 1 : 0, 0.2);
        this.eyes.forEach(({ eye, pupil }, i) => {
            eye.scale.set(1, closed ? 0.08 : 1, 1);
            pupil.scale.set(0.95, 0.9, 0.12 + 0.75 * dilate);
            if (s.high) pupil.position.set(0.012, Math.sin(t * 10 + i) * 0.04, Math.cos(t * 10 + i) * 0.04);
            else pupil.position.set(0.012, 0, 0);
        });
        // 耳: ときどきピクッと動く。びっくりするとイカ耳
        this.earTwitch -= dt;
        if (this.earTwitch < -0.2) this.earTwitch = 2 + Math.random() * 5;
        this.ears.forEach((ear, i) => {
            const tw = this.earTwitch < 0 && i === 0 ? 0.35 : 0;
            ear.rotation.set((i ? 1 : -1) * (0.32 + scared * 0.9 + tw), 0, -0.12 - scared * 0.6);
        });

        // 足: 2本の骨で、体が低くなってもつま先が床に届くように曲げる
        const legR = 0.016 + 0.0005 * s.w;
        const reach0 = b.leg + torsoH * 0.34;
        const seg = Math.max(0.01, reach0 / 2);
        const reachY = hipY - torsoH * 0.12;
        const fold = Math.acos(Math.max(-1, Math.min(1, reachY / (2 * seg))));
        this.legs.forEach((l, i) => {
            const x = (l.front ? 1 : -1) * L * 0.29;
            l.hip.position.set(x, -torsoH * 0.12, l.side * hw * (0.42 - 0.2 * b.fat));
            l.hip.visible = !loaf;
            l.upper.scale.set(legR, seg, legR);
            l.lower.scale.set(legR * 0.85, seg, legR * 0.85);
            l.knee.position.set(0, -seg, 0);
            l.paw.scale.set(legR * 1.3, legR * 0.75, legR * 1.1);
            l.paw.position.set(legR * 0.5, -seg, 0);
            // 対角の足が同時に動く（トロット）
            const diag = (l.front === (l.side > 0)) ? 0 : Math.PI;
            let swing = 0, lift = 0;
            if (s.air) {
                swing = l.front ? 0.9 : -0.8;
            } else if (speed > 0.05) {
                swing = Math.sin(cyc + diag) * Math.min(0.42, 0.18 + speed * 0.14);
                lift = Math.max(0, Math.cos(cyc + diag)) * 0.45;
            }
            if (s.stuck) swing = Math.sin(t * 30 + i) * 0.8;
            const f = l.front ? 1 : -1;
            l.hip.rotation.z = swing + f * fold;
            l.knee.rotation.z = -f * (2 * fold + lift);
            // 猫パンチ: 右前足を前に振り上げる
            if (l.front && l.side > 0 && s.punch > 0) {
                l.hip.rotation.z = 1.9 * Math.sin(Math.PI * s.punch);
                l.knee.rotation.z = -0.3;
            }
        });

        // しっぽ: 普段は立てて先がゆれる。狩りのときは低く速く振る。寝るときは体に巻く
        const n = 24;
        const tailLen = L * 0.95;
        const base = new THREE.Vector3(-L * 0.47, torsoH * 0.12, 0);
        const r0 = Math.max(0.012, hw * 0.22) * (1 + scared * 1.2);
        for (let i = 0; i <= n; i++) {
            const k = i / n;
            let p;
            if (loaf) {
                const a = Math.PI + k * Math.PI * 0.95;
                const R = Math.max(hw, L * 0.4) * 1.05;
                p = new THREE.Vector3(Math.cos(a) * R * 0.95, -hipY + r0 + 0.005, -Math.sin(a) * R * (0.55 + k * 0.3));
                if (k < 0.1) p.lerp(base, 1 - k / 0.1);
            } else {
                const up = s.charge > 0 || crouch > 0.3 ? 0.05 : scared ? 1.4 : s.high ? 0.9 : 0.25 + k * 1.2;
                const amp = s.high ? 1.1 : s.charge > 0 ? 0.9 : 0.3 + (speed > 0.05 ? 0.1 : 0);
                const spd = s.high ? 8 : s.charge > 0 ? 16 : 2.2;
                const side = Math.sin(t * spd - i * 0.25) * amp * k;
                const bend = up + k * 0.4 * (s.w > 30 ? -0.5 : 1);
                p = new THREE.Vector3(
                    base.x - Math.cos(bend) * tailLen * k * 0.9,
                    base.y + Math.sin(bend) * tailLen * k * 0.8 - (k > 0.85 ? (k - 0.85) * tailLen * 0.4 : 0),
                    base.z + side * tailLen * 0.35
                );
            }
            this.tailPts[i].copy(p);
            this.tailRadii[i] = r0 * (1 - k * 0.55);
        }
        this.tailTube.update(this.tailPts, this.tailRadii);

        this.setFur((0.005 + 0.00009 * s.w) * (1 + scared * 2.2), Hr);

        // 接地の影
        this.contact.visible = true;
        this.contact.position.y = 0.004 - (s.height || 0);
        this.contact.scale.set(L * 0.5, 1, hw * 1.05);
        this.contact.material.opacity = 0.16 / (1 + (s.height || 0) * 3);

        // 詰まりや破裂寸前は赤っぽく
        const warn = s.stuck || s.w > CFG.BURST_WARN ? (Math.sin(t * 18) > 0 ? 0.25 : 0) : 0;
        this.bodyMat.emissive.setRGB(warn, 0, 0);
        this.headMat.emissive.setRGB(warn, 0, 0);
    }
}
