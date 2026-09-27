// 町に置かれた物: 食べ物・ゴミ箱・猫缶バッジ
import * as THREE from 'three';
import { FOODS } from './config.js';
import { toon, addOutline, refreshOutlines } from './toon.js';

export function part(geo, mat, line = 0.004) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    if (line) addOutline(m, line);
    return m;
}

const S = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const mats = {};
const mat = c => mats[c] || (mats[c] = toon(c));

// 食べ物ごとの見た目（足元が y=0）
function foodMesh(type) {
    const g = new THREE.Group();
    const add = (m, x = 0, y = 0, z = 0) => {
        m.position.set(x, y, z);
        g.add(m);
        return m;
    };
    switch (type) {
        case 'fish': {
            // 大きめの鯛
            const body = add(part(S(0.14).scale(1.4, 0.55, 0.45), mat(0xf07a6a)), 0, 0.06, 0);
            body.rotation.z = 0.05;
            add(part(new THREE.ConeGeometry(0.08, 0.12, 4).rotateZ(Math.PI / 2).scale(1, 1, 0.3), mat(0xd95a4a)), -0.23, 0.06, 0);
            add(part(S(0.018), mat(0x222222), 0), 0.13, 0.08, 0.05);
            break;
        }
        case 'yakitori': {
            add(part(new THREE.CylinderGeometry(0.006, 0.006, 0.32, 6).rotateZ(Math.PI / 2), mat(0xe8d2a0), 0), 0, 0.03, 0);
            [-0.06, 0, 0.06].forEach(x => add(part(S(0.032), mat(0xa8622d)), x, 0.03, 0));
            break;
        }
        case 'melonpan': {
            add(part(S(0.085, 16, 10).scale(1, 0.6, 1), mat(0xf3c86b)), 0, 0.03, 0);
            break;
        }
        case 'kibble': {
            add(part(new THREE.CylinderGeometry(0.13, 0.1, 0.07, 20), mat(0xe25563)), 0, 0.035, 0);
            g.userData.heap = add(part(S(0.11).scale(1, 0.4, 1), mat(0xa0632f)), 0, 0.075, 0);
            break;
        }
        case 'dogfood': {
            add(part(new THREE.CylinderGeometry(0.14, 0.11, 0.07, 20), mat(0x3a86c8)), 0, 0.035, 0);
            g.userData.heap = add(part(S(0.12).scale(1, 0.4, 1), mat(0x8a5a2c)), 0, 0.075, 0);
            break;
        }
        case 'treat': {
            add(part(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 10).rotateZ(Math.PI / 2), mat(0xff8fb1)), 0, 0.02, 0);
            break;
        }
        case 'ramen': {
            add(part(new THREE.CylinderGeometry(0.13, 0.08, 0.1, 20), mat(0xd9363f)), 0, 0.05, 0);
            add(part(new THREE.CylinderGeometry(0.115, 0.115, 0.01, 20), mat(0xf3d36b), 0), 0, 0.095, 0);
            add(part(S(0.03).scale(1, 0.4, 1), mat(0xffffff), 0), 0.04, 0.1, 0.02);
            break;
        }
        case 'zanpan': {
            add(part(new THREE.CylinderGeometry(0.15, 0.15, 0.015, 20), mat(0xffffff)), 0, 0.008, 0);
            add(part(S(0.1).scale(1, 0.5, 1), mat(0xc58b52)), 0, 0.03, 0);
            add(part(S(0.04), mat(0x7fbf4f)), 0.05, 0.06, 0.02);
            break;
        }
        case 'bento': {
            add(part(new THREE.BoxGeometry(0.22, 0.05, 0.15), mat(0x2e2a30)), 0, 0.025, 0);
            add(part(new THREE.BoxGeometry(0.1, 0.02, 0.13), mat(0xffffff), 0), -0.05, 0.055, 0);
            add(part(S(0.03), mat(0xe25563), 0), 0.05, 0.06, 0);
            break;
        }
        case 'bone': {
            add(part(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6).rotateZ(Math.PI / 2), mat(0xf4f1e8)), 0, 0.015, 0);
            for (let i = 0; i < 5; i++) add(part(new THREE.BoxGeometry(0.006, 0.006, 0.08), mat(0xf4f1e8), 0), -0.06 + i * 0.03, 0.015, 0);
            add(part(S(0.035).scale(1, 0.7, 0.6), mat(0xb9c2cc)), 0.12, 0.02, 0);
            break;
        }
        case 'himono': {
            add(part(S(0.1).scale(1.4, 0.18, 0.7), mat(0xd9a45a)), 0, 0.02, 0);
            break;
        }
        case 'catnip': {
            [[0, 0], [0.06, 0.04], [-0.05, 0.05], [0.02, -0.06]].forEach(([x, z]) => add(part(S(0.07, 8, 6), mat(0x6fbf4a)), x, 0.06, z));
            add(part(S(0.03, 8, 6), mat(0xb277d9), 0), 0, 0.13, 0);
            break;
        }
        case 'mouse': {
            add(part(S(0.05).scale(1.4, 0.7, 0.8), mat(0x9a9aa3)), 0, 0.035, 0);
            break;
        }
    }
    return g;
}

export class Food {
    constructor(scene, type, x, y, z, spawn) {
        this.scene = scene;
        this.type = type;
        this.def = FOODS[type];
        this.bites = this.def.bites;
        this.pos = new THREE.Vector3(x, y, z);
        this.alive = true;
        this.spawn = spawn || null;
        this.mesh = foodMesh(type);
        this.mesh.position.copy(this.pos);
        this.mesh.rotation.y = Math.random() * Math.PI * 2;
        this.falling = 0;
        this.vel = new THREE.Vector3();
        this.pecked = 0; // カラスにつつかれている時間
        scene.add(this.mesh);
        refreshOutlines(this.mesh);
    }

    // 1口食べる。増える体重を返す
    bite() {
        this.bites--;
        const kg = this.def.kg / this.def.bites;
        const heap = this.mesh.userData.heap;
        if (heap) heap.scale.setScalar(Math.max(0.05, this.bites / this.def.bites));
        else this.mesh.scale.setScalar(0.5 + 0.5 * this.bites / this.def.bites);
        if (this.bites <= 0) this.remove();
        return kg;
    }

    // ゴミ箱から飛び出したときなど
    toss(vx, vy, vz, floorY = 0) {
        this.vel.set(vx, vy, vz);
        this.falling = 1;
        this.floorY = floorY;
    }

    update(dt) {
        if (this.falling > 0) {
            this.vel.y -= 9.8 * dt;
            this.pos.addScaledVector(this.vel, dt);
            if (this.pos.y <= this.floorY) {
                this.pos.y = this.floorY;
                this.falling = 0;
            }
            this.mesh.position.copy(this.pos);
        }
    }

    remove() {
        this.alive = false;
        this.scene.remove(this.mesh);
    }
}

// 叩くと倒れて中身が飛び出すゴミ箱
export class TrashCan {
    constructor(scene, x, z, box) {
        this.scene = scene;
        this.pos = new THREE.Vector3(x, 0, z);
        this.box = box;
        this.down = false;
        this.t = 0;
        this.reset = 0;
        this.root = new THREE.Group();
        this.root.position.copy(this.pos);
        this.pivot = new THREE.Group();
        this.root.add(this.pivot);
        const can = part(new THREE.CylinderGeometry(0.26, 0.22, 0.66, 20), mat(0x3b7fc4), 0.008);
        can.position.y = 0.33;
        const lid = part(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 20), mat(0x2d6aa8), 0.008);
        lid.position.y = 0.69;
        this.lid = lid;
        this.pivot.add(can, lid);
        scene.add(this.root);
        refreshOutlines(this.root);
    }

    knock(dirX, dirZ) {
        if (this.down) return false;
        this.down = true;
        this.t = 0;
        this.reset = 45;
        this.box.off = true;
        this.dir = Math.atan2(dirZ, dirX);
        return true;
    }

    update(dt) {
        if (!this.down) return;
        this.t += dt;
        const k = Math.min(1, this.t / 0.35);
        // 倒れる向きに回す
        this.root.rotation.y = -this.dir;
        this.pivot.rotation.z = -k * Math.PI / 2 * 0.95;
        this.pivot.position.set(k * 0.25, 0, 0);
        this.lid.position.set(k * 0.5, 0.69 - k * 0.4, 0);
        this.reset -= dt;
        if (this.reset <= 0) {
            this.down = false;
            this.box.off = false;
            this.root.rotation.y = 0;
            this.pivot.rotation.z = 0;
            this.pivot.position.set(0, 0, 0);
            this.lid.position.set(0, 0.69, 0);
        }
    }
}

// 猫缶バッジ（くるくる回る）
let badgeTex = null;
function badgeTexture() {
    if (badgeTex) return badgeTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ffd166';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#e25563';
    g.beginPath();
    g.arc(64, 64, 50, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(64, 70, 26, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(40, 58);
    g.lineTo(44, 30);
    g.lineTo(60, 48);
    g.moveTo(88, 58);
    g.lineTo(84, 30);
    g.lineTo(68, 48);
    g.fill();
    g.fillStyle = '#3b2f2a';
    g.fillRect(52, 64, 5, 8);
    g.fillRect(71, 64, 5, 8);
    badgeTex = new THREE.CanvasTexture(c);
    badgeTex.colorSpace = THREE.SRGBColorSpace;
    return badgeTex;
}

export class Badge {
    constructor(scene, id, x, y, z) {
        this.scene = scene;
        this.id = id;
        this.pos = new THREE.Vector3(x, y, z);
        const face = toon(0xffffff, { map: badgeTexture() });
        const rim = toon(0xf0b429);
        this.mesh = part(new THREE.CylinderGeometry(0.1, 0.1, 0.035, 24).rotateX(Math.PI / 2), [rim, rim, rim], 0.005);
        this.mesh.material = [rim, face, face];
        this.mesh.position.set(x, y + 0.2, z);
        this.alive = true;
        scene.add(this.mesh);
        refreshOutlines(this.mesh);
    }

    update(dt, t) {
        this.mesh.rotation.y = t * 2.5 + this.id;
        this.mesh.position.y = this.pos.y + 0.2 + Math.sin(t * 3 + this.id) * 0.04;
    }

    remove() {
        this.alive = false;
        this.scene.remove(this.mesh);
    }
}
