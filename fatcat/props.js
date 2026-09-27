// 物理で動く小物（マグカップ・花瓶・テレビなど）。強くぶつかると割れる
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PROPS } from './config.js';
import { Tex } from './textures.js';

function std(color, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });
}

function shade(m) {
    m.traverse(o => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });
    return m;
}

// 見た目のモデル。中心が物理ボディの中心になるように作る
const MODELS = {
    mug(d) {
        const g = new THREE.Group();
        const [r, h] = d.size;
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, h, 24, 1, true), std(d.color, { side: THREE.DoubleSide, roughness: 0.2 }));
        const bottom = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 24).rotateX(-Math.PI / 2), std(d.color));
        bottom.position.y = -h / 2;
        const coffee = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 24).rotateX(-Math.PI / 2), std(0x3b2314, { roughness: 0.1 }));
        coffee.position.y = h * 0.3;
        const handle = new THREE.Mesh(new THREE.TorusGeometry(h * 0.28, r * 0.15, 8, 16), std(d.color, { roughness: 0.2 }));
        handle.position.x = r;
        g.add(cup, bottom, coffee, handle);
        return g;
    },
    glass(d) {
        const [r, h] = d.size;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, h, 24, 1, true),
            new THREE.MeshStandardMaterial({ color: d.color, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide }));
        return m;
    },
    vase(d) {
        const g = new THREE.Group();
        const h = d.size[1];
        const pts = [[0, 0], [0.05, 0], [0.07, 0.05], [0.065, 0.14], [0.035, 0.22], [0.04, 0.26]].map(([x, y]) => new THREE.Vector2(x, y - h / 2));
        g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 28), std(d.color, { roughness: 0.15, metalness: 0.05 })));
        [0xe63946, 0xffd166, 0xf4a261, 0xffffff].forEach((c, i) => {
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.14), std(0x2d6a4f));
            const a = i * 1.6;
            stem.position.set(Math.cos(a) * 0.015, h / 2 + 0.05, Math.sin(a) * 0.015);
            stem.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
            const f = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), std(c, { roughness: 0.8 }));
            f.position.set(Math.cos(a) * 0.04, h / 2 + 0.12, Math.sin(a) * 0.04);
            g.add(stem, f);
        });
        return g;
    },
    plant(d) {
        const g = new THREE.Group();
        const [r, h] = d.size;
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, h * 0.55, 24), std(d.color, { roughness: 0.8 }));
        pot.position.y = -h * 0.2;
        g.add(pot);
        for (let i = 0; i < 12; i++) {
            const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), std(i % 2 ? 0x2d6a4f : 0x40916c, { roughness: 0.7 }));
            const a = (i / 12) * Math.PI * 2;
            leaf.scale.set(0.09, 0.012, 0.04);
            leaf.position.set(Math.cos(a) * 0.08, h * 0.15 + (i % 3) * 0.05, Math.sin(a) * 0.08);
            leaf.rotation.set(0, -a, 0.5 + (i % 3) * 0.2);
            g.add(leaf);
        }
        return g;
    },
    phone(d) {
        const g = new THREE.Group();
        const [x, y, z] = d.size;
        g.add(new THREE.Mesh(new THREE.BoxGeometry(x, y, z), std(0x111111, { roughness: 0.2 })));
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(x * 0.9, z * 0.92).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6fb7e8, emissive: 0x2a6f9a, roughness: 0.1 }));
        scr.position.y = y / 2 + 0.0005;
        g.add(scr);
        return g;
    },
    laptop(d) {
        const g = new THREE.Group();
        const [x, y, z] = d.size;
        g.add(new THREE.Mesh(new THREE.BoxGeometry(x, y, z), std(d.color, { metalness: 0.7, roughness: 0.3 })));
        const lid = new THREE.Group();
        const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(x, 0.008, z), std(d.color, { metalness: 0.7, roughness: 0.3 }));
        lidMesh.position.z = -z / 2;
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(x * 0.9, z * 0.85).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x3a6fa0, emissiveIntensity: 0.6 }));
        scr.position.set(0, -0.005, -z / 2);
        lid.add(lidMesh, scr);
        lid.position.set(0, y / 2, -z / 2);
        lid.rotation.x = -1.9;
        g.add(lid);
        return g;
    },
    frame(d) {
        const g = new THREE.Group();
        const [x, y, z] = d.size;
        g.add(new THREE.Mesh(new THREE.BoxGeometry(x, y, z), std(d.color)));
        const photo = new THREE.Mesh(new THREE.PlaneGeometry(x * 0.75, y * 0.75), std(0x9fc9e8));
        photo.position.z = z / 2 + 0.001;
        g.add(photo);
        return g;
    },
    clock(d) {
        const g = new THREE.Group();
        const [x, y, z] = d.size;
        g.add(new THREE.Mesh(new THREE.BoxGeometry(x, y, z), std(d.color, { roughness: 0.3 })));
        const face = new THREE.Mesh(new THREE.CircleGeometry(x * 0.38, 24), std(0xffffff));
        face.position.z = z / 2 + 0.001;
        g.add(face);
        return g;
    },
    bottle(d) {
        const h = d.size[1];
        const pts = [[0, 0], [0.04, 0], [0.04, 0.19], [0.015, 0.25], [0.014, 0.3]].map(([x, y]) => new THREE.Vector2(x, y - h / 2));
        return new THREE.Mesh(new THREE.LatheGeometry(pts, 20), std(d.color, { roughness: 0.1, metalness: 0.2 }));
    },
    plate(d) {
        const [r, h] = d.size;
        return new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.7, h, 32), std(d.color, { roughness: 0.2 }));
    },
    tv(d) {
        const g = new THREE.Group();
        const [x, y, z] = d.size;
        g.add(new THREE.Mesh(new THREE.BoxGeometry(x, y, z), std(0x111111, { roughness: 0.3 })));
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(x * 0.95, y * 0.9), new THREE.MeshStandardMaterial({ color: 0x0a1520, emissive: 0x1d3a5a, emissiveIntensity: 0.5, roughness: 0.05 }));
        scr.position.z = z / 2 + 0.001;
        g.add(scr);
        return g;
    },
    book(d) {
        const [x, y, z] = d.size;
        const colors = [0x3a6ea5, 0xa53a3a, 0x3aa56e, 0xa58a3a, 0x6e3aa5];
        return new THREE.Mesh(new THREE.BoxGeometry(x, y, z), std(colors[Math.floor(Math.random() * colors.length)], { roughness: 0.8 }));
    },
    remote(d) {
        const [x, y, z] = d.size;
        return new THREE.Mesh(new THREE.BoxGeometry(x, y, z), std(d.color, { roughness: 0.4 }));
    },
    cushion(d) {
        const [x, y, z] = d.size;
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshStandardMaterial({ map: Tex.fabric, color: d.color, roughness: 1 }));
        m.scale.set(x / 2, y / 2, z / 2);
        return m;
    },
    heavybox(d) {
        const [x, y, z] = d.size;
        return new THREE.Mesh(new THREE.BoxGeometry(x, y, z), new THREE.MeshStandardMaterial({ map: Tex.cardboard, roughness: 1 }));
    },
    hairball() {
        return new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 1), std(0x6b4a2a, { roughness: 1 }));
    }
};

export class PropSystem {
    constructor(scene, world, onBreak) {
        this.scene = scene;
        this.world = world;
        this.onBreak = onBreak;
        this.items = [];
        this.shards = [];
        this.pending = new Set();
    }

    add(type, x, y, z, rotY = 0) {
        const def = type === 'hairball' ? { name: '毛玉', price: 0, shape: 'sphere', size: [0.03], mass: 0.05 } : PROPS[type];
        let shape, half;
        if (def.shape === 'cyl') {
            shape = new CANNON.Cylinder(def.size[0], def.size[0], def.size[1], 12);
            half = def.size[1] / 2;
        } else if (def.shape === 'sphere') {
            shape = new CANNON.Sphere(def.size[0]);
            half = def.size[0];
        } else {
            shape = new CANNON.Box(new CANNON.Vec3(def.size[0] / 2, def.size[1] / 2, def.size[2] / 2));
            half = def.size[1] / 2;
        }
        const body = new CANNON.Body({ mass: def.mass, shape, linearDamping: 0.05, angularDamping: 0.1 });
        body.position.set(x, y + half + 0.001, z);
        body.quaternion.setFromEuler(0, rotY, 0);
        if (def.pushWeight) body.type = CANNON.Body.STATIC;
        this.world.addBody(body);
        const mesh = shade(MODELS[type](def));
        this.scene.add(mesh);
        const p = { type, def, body, mesh, broken: false, startY: y, half, knocked: false };
        body.addEventListener('collide', e => {
            if (p.broken || !def.price) return;
            const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
            if (v > (def.breakSpeed || 2.4)) this.pending.add(p);
        });
        this.items.push(p);
        this.sync(p);
        return p;
    }

    sync(p) {
        p.mesh.position.copy(p.body.position);
        p.mesh.quaternion.copy(p.body.quaternion);
    }

    // 重い段ボール: 体重が足りないうちは動かない
    updatePushable(weight) {
        this.items.forEach(p => {
            if (!p.def.pushWeight || p.broken) return;
            const want = weight >= p.def.pushWeight ? CANNON.Body.DYNAMIC : CANNON.Body.STATIC;
            if (p.body.type !== want) {
                p.body.type = want;
                p.body.mass = want === CANNON.Body.DYNAMIC ? p.def.mass : 0;
                p.body.updateMassProperties();
                p.body.wakeUp();
            }
        });
    }

    // 体重が足りずに止まっている物は、猫にとって壁になる
    blockers() {
        return this.items.filter(p => p.def.pushWeight && p.body.type === CANNON.Body.STATIC && !p.broken);
    }

    impulse(p, dir, power) {
        const b = p.body;
        if (b.type !== CANNON.Body.DYNAMIC) return;
        b.wakeUp();
        const imp = new CANNON.Vec3(dir.x * power, power * 0.35, dir.z * power);
        // 少し上を叩くと倒れやすい
        const point = new CANNON.Vec3(b.position.x, b.position.y + p.half * 0.6, b.position.z);
        b.applyImpulse(imp, point);
    }

    update(dt) {
        this.pending.forEach(p => this.shatter(p));
        this.pending.clear();
        this.items.forEach(p => {
            if (p.broken) return;
            this.sync(p);
            if (!p.knocked && p.body.position.y < p.startY - 0.15) p.knocked = true;
        });
        this.shards = this.shards.filter(s => {
            s.t += dt;
            s.v.y -= 9.8 * dt;
            s.m.position.addScaledVector(s.v, dt);
            if (s.m.position.y < 0.005) {
                s.m.position.y = 0.005;
                s.v.multiplyScalar(0.3);
                s.v.y = Math.abs(s.v.y) * 0.3;
            }
            s.m.rotation.x += dt * 8;
            s.m.rotation.z += dt * 6;
            if (s.t > 2.5) {
                this.scene.remove(s.m);
                return false;
            }
            return true;
        });
    }

    shatter(p) {
        if (p.broken) return;
        p.broken = true;
        this.world.removeBody(p.body);
        this.scene.remove(p.mesh);
        const pos = p.mesh.position.clone();
        const mat = new THREE.MeshStandardMaterial({ color: p.def.color, roughness: 0.3, transparent: !!p.def.glass, opacity: p.def.glass ? 0.5 : 1 });
        const n = Math.min(24, 8 + Math.round(p.def.mass * 4));
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.01 + Math.random() * 0.02), mat);
            m.position.copy(pos);
            m.castShadow = true;
            this.scene.add(m);
            const a = Math.random() * Math.PI * 2;
            const sp = 0.5 + Math.random() * 1.5;
            this.shards.push({ m, t: 0, v: new THREE.Vector3(Math.cos(a) * sp, 1 + Math.random() * 1.5, Math.sin(a) * sp) });
        }
        this.onBreak(p, pos);
    }

    clear() {
        this.items.forEach(p => {
            if (!p.broken) this.world.removeBody(p.body);
            this.scene.remove(p.mesh);
        });
        this.shards.forEach(s => this.scene.remove(s.m));
        this.items = [];
        this.shards = [];
    }
}
