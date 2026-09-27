// 食べ物: 屋台のカウンター・人の手・レジャーシート・カモメのくちばし、どこにでもある
import * as THREE from 'three';
import { FOODS } from './config.js';
import { toon, addOutline, refreshOutlines } from './toon.js';

const mats = {};
const mat = c => mats[c] || (mats[c] = toon(c));
const S = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);

export function part(geo, m, line = 0.006) {
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true;
    if (line) addOutline(mesh, line);
    return mesh;
}

// 食べ物ごとの見た目（原点が底の中心）
export function foodMesh(type) {
    const g = new THREE.Group();
    const add = (m, x = 0, y = 0, z = 0) => {
        m.position.set(x, y, z);
        g.add(m);
        return m;
    };
    switch (type) {
        case 'fries':
            add(part(new THREE.BoxGeometry(0.1, 0.12, 0.07), mat(0xe0453a)), 0, 0.06, 0);
            for (let i = 0; i < 7; i++) add(part(new THREE.BoxGeometry(0.014, 0.1, 0.014), mat(0xf6c945), 0), -0.035 + (i % 4) * 0.022, 0.15, -0.015 + Math.floor(i / 4) * 0.03);
            break;
        case 'icecream':
            add(part(new THREE.ConeGeometry(0.04, 0.13, 10).rotateX(Math.PI), mat(0xd9a45a)), 0, 0.065, 0);
            add(part(new THREE.ConeGeometry(0.05, 0.12, 12), mat(0xfff6e8)), 0, 0.19, 0);
            add(part(S(0.048), mat(0xfff6e8), 0), 0, 0.14, 0);
            break;
        case 'takoyaki':
            add(part(new THREE.BoxGeometry(0.16, 0.02, 0.09), mat(0xe8d2a0)), 0, 0.01, 0);
            [-0.045, 0, 0.045].forEach(x => add(part(S(0.028), mat(0xc8813a)), x, 0.045, 0));
            break;
        case 'sausage':
            add(part(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 5), mat(0xe8d2a0), 0), 0, 0.06, 0);
            add(part(new THREE.CapsuleGeometry(0.025, 0.1, 4, 8), mat(0xc0472e)), 0, 0.16, 0);
            break;
        case 'onigiri':
            add(part(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 3).rotateX(Math.PI / 2), mat(0xffffff)), 0, 0.055, 0);
            add(part(new THREE.BoxGeometry(0.05, 0.04, 0.042), mat(0x1f2a22), 0), 0, 0.025, 0);
            break;
        case 'yakisoba':
            add(part(new THREE.BoxGeometry(0.2, 0.03, 0.13), mat(0xf4f1e8)), 0, 0.015, 0);
            add(part(S(0.08).scale(1.1, 0.35, 0.7), mat(0x9c5a2c)), 0, 0.04, 0);
            add(part(S(0.02), mat(0xe25563), 0), 0.03, 0.065, 0.02);
            break;
        case 'crepe':
            add(part(new THREE.ConeGeometry(0.05, 0.18, 12).rotateX(Math.PI), mat(0xf3d9a4)), 0, 0.09, 0);
            add(part(S(0.045), mat(0xffffff), 0), 0, 0.19, 0);
            add(part(S(0.02), mat(0xe0453a), 0), 0.02, 0.22, 0.01);
            break;
        case 'squid':
            add(part(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 5), mat(0xe8d2a0), 0), 0, 0.15, 0);
            add(part(S(0.06).scale(0.8, 1.6, 0.5), mat(0xd98a4a)), 0, 0.3, 0);
            for (let i = 0; i < 4; i++) add(part(new THREE.CylinderGeometry(0.01, 0.006, 0.12, 5), mat(0xd98a4a), 0), -0.03 + i * 0.02, 0.17, 0);
            break;
        case 'bento':
            add(part(new THREE.BoxGeometry(0.26, 0.06, 0.18), mat(0x2e2a30)), 0, 0.03, 0);
            add(part(new THREE.BoxGeometry(0.11, 0.02, 0.16), mat(0xffffff), 0), -0.06, 0.07, 0);
            add(part(S(0.03), mat(0xe25563), 0), 0.04, 0.075, -0.03);
            add(part(S(0.03), mat(0xf6c945), 0), 0.08, 0.075, 0.03);
            break;
        case 'fish':
            add(part(S(0.14).scale(1.5, 0.5, 0.35), mat(0x9fb8d0)), 0, 0.07, 0);
            add(part(new THREE.ConeGeometry(0.07, 0.12, 4).rotateZ(Math.PI / 2).scale(1, 1, 0.3), mat(0x7f98b3)), -0.25, 0.07, 0);
            break;
        case 'burger':
            add(part(S(0.12, 14, 8, 0).scale(1, 0.25, 1), mat(0xd9953a)), 0, 0.03, 0);
            add(part(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), mat(0x6b3a1e)), 0, 0.07, 0);
            add(part(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 16), mat(0x6fbf4a), 0), 0, 0.095, 0);
            add(part(S(0.12, 14, 8).scale(1, 0.55, 1), mat(0xd9953a)), 0, 0.11, 0);
            break;
        case 'tuna':
            add(part(S(0.35).scale(2.2, 0.55, 0.45), mat(0x3b4a6b), 0.012), 0, 0.2, 0);
            add(part(S(0.33).scale(2.1, 0.3, 0.44), mat(0xd9dde3), 0), 0, 0.12, 0);
            add(part(new THREE.ConeGeometry(0.2, 0.3, 4).rotateZ(Math.PI / 2).scale(1, 1.4, 0.2), mat(0x3b4a6b), 0.01), -0.9, 0.2, 0);
            break;
    }
    return g;
}

export class Food {
    constructor(scene, type, spot) {
        this.scene = scene;
        this.type = type;
        this.def = FOODS[type];
        this.spot = spot || null; // 屋台などの置き場所（食べられたらあとで復活）
        this.mesh = foodMesh(type);
        this.pos = new THREE.Vector3();
        this.vel = new THREE.Vector3();
        this.state = 'placed';
        this.owner = null;
        this.alive = true;
        if (spot) {
            this.pos.set(spot.x, spot.y, spot.z);
            this.mesh.position.copy(this.pos);
            this.mesh.rotation.y = Math.random() * Math.PI * 2;
            scene.add(this.mesh);
        }
        refreshOutlines(this.mesh);
    }

    // 世界での位置（人が持っている・カモメがくわえているときも）
    worldPos(out) {
        return this.mesh.getWorldPosition(out);
    }

    attach(parent, state, owner) {
        parent.add(this.mesh);
        this.mesh.position.set(0, 0, 0);
        this.mesh.rotation.set(0, 0, 0);
        this.state = state;
        this.owner = owner || null;
    }

    // 手やくちばしから落とす
    drop(vx = 0, vy = 0, vz = 0) {
        const p = this.worldPos(new THREE.Vector3());
        this.scene.add(this.mesh);
        this.mesh.position.copy(p);
        this.pos.copy(p);
        this.vel.set(vx, vy, vz);
        this.state = 'falling';
        this.owner = null;
    }

    update(dt, groundAt) {
        if (this.state !== 'falling') return;
        this.vel.y -= 9.8 * dt;
        this.pos.addScaledVector(this.vel, dt);
        this.mesh.rotation.x += dt * 6;
        const floor = groundAt(this.pos.x, this.pos.z, this.pos.y);
        if (this.pos.y <= floor) {
            this.pos.y = floor;
            this.mesh.rotation.x = 0;
            if (floor < 0) {
                // 海に落ちたら沈む
                this.remove();
                return;
            }
            this.state = 'placed';
            this.life = 25;
        }
        this.mesh.position.copy(this.pos);
    }

    remove() {
        this.alive = false;
        this.state = 'gone';
        if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    }
}
