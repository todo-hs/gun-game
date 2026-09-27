// 実寸大のアパート（リビング・キッチン・寝室）を作る
// 座標: x が東、z が南、y が上（メートル）。部屋は x 0〜10、z 0〜7、天井 2.4。
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Tex } from './textures.js';

export const ROOM = { w: 10, d: 7, h: 2.4 };

// 猫の足で登れる/ぶつかる箱（当たり判定）
export class Box {
    constructor(x0, y0, z0, x1, y1, z1, name) {
        this.min = new THREE.Vector3(x0, y0, z0);
        this.max = new THREE.Vector3(x1, y1, z1);
        this.name = name || '';
    }
}

export function buildApartment(scene, world) {
    const group = new THREE.Group();
    scene.add(group);
    const colliders = [];

    const M = {
        plaster: new THREE.MeshStandardMaterial({ map: Tex.plaster, roughness: 0.95 }),
        ceiling: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 1 }),
        base: new THREE.MeshStandardMaterial({ color: 0x5b4030, roughness: 0.7 }),
        fabric: new THREE.MeshStandardMaterial({ map: Tex.fabric, roughness: 1 }),
        cushion: new THREE.MeshStandardMaterial({ map: Tex.fabric, color: 0xdde6ea, roughness: 1 }),
        wood: new THREE.MeshStandardMaterial({ map: Tex.wood, roughness: 0.55 }),
        lightWood: new THREE.MeshStandardMaterial({ map: Tex.lightWood, roughness: 0.5 }),
        cabinet: new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.4 }),
        counterTop: new THREE.MeshStandardMaterial({ color: 0x9a9fa5, roughness: 0.25, metalness: 0.4 }),
        fridge: new THREE.MeshStandardMaterial({ color: 0xe4e8ea, roughness: 0.3, metalness: 0.2 }),
        metal: new THREE.MeshStandardMaterial({ color: 0x777c82, roughness: 0.3, metalness: 0.8 }),
        sisal: new THREE.MeshStandardMaterial({ color: 0xc8b08a, roughness: 1 }),
        tower: new THREE.MeshStandardMaterial({ color: 0xece2d0, roughness: 1 }),
        linen: new THREE.MeshStandardMaterial({ map: Tex.linen, roughness: 1 }),
        duvet: new THREE.MeshStandardMaterial({ color: 0x8fb3c9, roughness: 1 }),
        black: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.4 }),
        tile: new THREE.MeshStandardMaterial({ map: Tex.tile, roughness: 0.35 }),
        glass: new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1 })
    };

    function box(x0, y0, z0, x1, y1, z1, mat, opt = {}) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
        mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
        mesh.castShadow = opt.cast !== false;
        mesh.receiveShadow = true;
        group.add(mesh);
        if (opt.collide !== false) {
            const c = new Box(x0, y0, z0, x1, y1, z1, opt.name);
            colliders.push(c);
            if (world) {
                const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2)) });
                body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
                world.addBody(body);
            }
        }
        return mesh;
    }

    function plane(w, d, mat, x, y, z, rotX, repeat) {
        const m = mat.clone();
        if (repeat && m.map) {
            m.map = m.map.clone();
            m.map.repeat.set(repeat[0], repeat[1]);
            m.map.needsUpdate = true;
        }
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
        mesh.rotation.x = rotX;
        mesh.position.set(x, y, z);
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
    }

    const { w: W, d: D, h: H } = ROOM;

    // 床と天井
    plane(W, D, new THREE.MeshStandardMaterial({ map: Tex.floor, roughness: 0.45 }), W / 2, 0, D / 2, -Math.PI / 2, [W, D]);
    plane(4, 3.55, M.tile, 8, 0.002, 1.775, -Math.PI / 2, [8, 7]);
    plane(W, D, M.ceiling, W / 2, H, D / 2, Math.PI / 2);
    if (world) {
        const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
        floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        world.addBody(floor);
    }

    // 外壁（西の壁には窓）
    const T = 0.15;
    box(-T, 0, -T, W + T, H, 0, M.plaster, { name: 'wall' });
    box(-T, 0, D, W + T, H, D + T, M.plaster, { name: 'wall' });
    box(W, 0, 0, W + T, H, D, M.plaster, { name: 'wall' });
    box(-T, 0, 0, 0, H, 2.4, M.plaster, { name: 'wall' });
    box(-T, 0, 4.6, 0, H, D, M.plaster, { name: 'wall' });
    box(-T, 2.1, 2.4, 0, H, 4.6, M.plaster, { name: 'wall' });
    // 窓: 外の景色とガラス
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshBasicMaterial({ map: Tex.sky }));
    sky.position.set(-0.6, 1.5, 3.5);
    sky.rotation.y = Math.PI / 2;
    group.add(sky);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.25), M.glass);
    pane.position.set(-0.05, 1.475, 3.5);
    pane.rotation.y = Math.PI / 2;
    group.add(pane);
    box(-0.08, 1.46, 2.4, -0.02, 1.49, 4.6, M.cabinet, { collide: false, cast: false });
    box(-0.08, 0.85, 3.48, -0.02, 2.1, 3.52, M.cabinet, { collide: false, cast: false });
    // 窓の下の出窓（日なたぼっこの場所）
    box(0, 0, 2.4, 0.35, 0.85, 4.6, M.cabinet, { name: 'windowsill' });
    box(0, 0.83, 2.35, 0.4, 0.87, 4.65, M.lightWood, { collide: false });

    // 寝室の壁（リビングとの間、キッチンとの間。ドアの開口あり）
    box(5.95, 0, 3.6, 6.05, H, D, M.plaster, { name: 'wall' });
    box(6, 0, 3.55, 6.25, H, 3.65, M.plaster, { name: 'wall' });
    box(7.15, 0, 3.55, W, H, 3.65, M.plaster, { name: 'wall' });
    box(6.25, 2.05, 3.55, 7.15, H, 3.65, M.plaster, { name: 'wall' });
    // 開いたドア
    box(6.25, 0.02, 3.65, 6.29, 2.02, 4.5, M.lightWood, { name: 'door' });

    // 幅木（壁の下の細い板）
    const bb = (x0, z0, x1, z1) => box(x0, 0, z0, x1, 0.07, z1, M.base, { collide: false, cast: false });
    bb(0, 0, W, 0.012);
    bb(0, D - 0.012, W, D);
    bb(W - 0.012, 0, W, D);
    bb(0, 0, 0.012, 2.4);
    bb(0, 4.6, 0.012, D);

    // --- リビング ---
    // ソファ: 座面 0.44、下のすき間 0.2
    box(1.2, 0.2, 0.15, 3.4, 0.36, 1.05, M.fabric, { name: 'sofa' });
    box(1.42, 0.36, 0.4, 3.18, 0.46, 1.03, M.cushion, { name: 'sofa' });
    box(1.2, 0.36, 0.15, 3.4, 0.86, 0.42, M.fabric, { name: 'sofa' });
    box(1.2, 0.36, 0.15, 1.42, 0.62, 1.05, M.fabric, { name: 'sofa' });
    box(3.18, 0.36, 0.15, 3.4, 0.62, 1.05, M.fabric, { name: 'sofa' });
    [[1.25, 0.2], [3.3, 0.2], [1.25, 0.95], [3.3, 0.95]].forEach(([x, z]) => box(x, 0, z, x + 0.05, 0.2, z + 0.05, M.wood, { name: 'sofa-leg' }));

    // ラグ
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8), new THREE.MeshStandardMaterial({ map: Tex.rug, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(2.3, 0.004, 2.3);
    rug.receiveShadow = true;
    group.add(rug);

    // ローテーブル: 高さ 0.4
    box(1.7, 0.36, 1.8, 2.9, 0.4, 2.5, M.lightWood, { name: 'lowtable' });
    [[1.74, 1.84], [2.82, 1.84], [1.74, 2.42], [2.82, 2.42]].forEach(([x, z]) => box(x, 0, z, x + 0.04, 0.36, z + 0.04, M.lightWood, { name: 'lowtable-leg' }));

    // テレビ台
    box(1.4, 0, 6.5, 3.2, 0.45, 6.95, M.wood, { name: 'tvstand' });

    // キャットタワー: 0.46 / 0.9 / 1.34
    box(5.1, 0, 0.3, 5.7, 0.06, 0.9, M.tower, { name: 'tower' });
    box(5.37, 0.06, 0.57, 5.43, 1.34, 0.63, M.sisal, { name: 'tower-post' });
    box(5.1, 0.42, 0.3, 5.55, 0.46, 0.75, M.tower, { name: 'tower' });
    box(5.25, 0.86, 0.45, 5.7, 0.9, 0.9, M.tower, { name: 'tower' });
    box(5.1, 1.3, 0.3, 5.55, 1.34, 0.75, M.tower, { name: 'tower' });

    // 本棚（棚板 0.45 / 0.9 / 1.35 / 天板 1.8）
    box(4.3, 0, 6.93, 5.5, 1.8, 6.95, M.wood, { name: 'shelf' });
    box(4.3, 0, 6.62, 4.33, 1.8, 6.95, M.wood, { name: 'shelf' });
    box(5.47, 0, 6.62, 5.5, 1.8, 6.95, M.wood, { name: 'shelf' });
    [0, 0.45, 0.9, 1.35, 1.77].forEach(y => box(4.3, y, 6.62, 5.5, y + 0.03, 6.95, M.wood, { name: 'shelf' }));

    // --- キッチン ---
    box(6.95, 0, 0, 9.95, 0.86, 0.65, M.cabinet, { name: 'counter' });
    box(6.93, 0.86, 0, 9.97, 0.9, 0.67, M.counterTop, { name: 'counter' });
    box(6.95, 0.9, 0, W, 1.5, 0.01, M.tile, { collide: false, cast: false });
    box(7.8, 0.905, 0.1, 8.4, 0.91, 0.5, M.metal, { collide: false, cast: false });
    // 冷蔵庫（カウンターとの間に 27cm のすき間）
    box(6.0, 0, 0.02, 6.68, 1.8, 0.72, M.fridge, { name: 'fridge' });
    box(6.62, 0.9, 0.73, 6.64, 1.6, 0.76, M.metal, { collide: false });
    // ダイニングテーブル: 0.74
    box(7.3, 0.7, 1.6, 8.5, 0.74, 2.4, M.wood, { name: 'table' });
    [[7.34, 1.64], [8.42, 1.64], [7.34, 2.32], [8.42, 2.32]].forEach(([x, z]) => box(x, 0, z, x + 0.05, 0.7, z + 0.05, M.wood, { name: 'table-leg' }));
    // いす: 座面 0.46
    const chair = (x0, z0, backZ) => {
        box(x0, 0.42, z0, x0 + 0.42, 0.46, z0 + 0.42, M.lightWood, { name: 'chair' });
        [[0.02, 0.02], [0.36, 0.02], [0.02, 0.36], [0.36, 0.36]].forEach(([dx, dz]) => box(x0 + dx, 0, z0 + dz, x0 + dx + 0.04, 0.42, z0 + dz + 0.04, M.lightWood, { name: 'chair-leg' }));
        box(x0, 0.46, backZ, x0 + 0.42, 0.95, backZ + 0.04, M.lightWood, { name: 'chair' });
    };
    chair(7.45, 2.55, 2.93);
    chair(7.95, 1.03, 1.03);

    // --- 寝室 ---
    box(7.9, 0, 4.8, 9.95, 0.36, 6.95, M.wood, { name: 'bed' });
    box(7.9, 0.36, 4.8, 9.95, 0.5, 6.85, M.linen, { name: 'bed' });
    box(7.9, 0.5, 6.85, 9.95, 0.95, 6.95, M.wood, { name: 'bed' });
    box(7.95, 0.5, 4.85, 9.9, 0.53, 6.2, M.duvet, { collide: false });
    box(8.2, 0.5, 6.35, 9.65, 0.6, 6.75, M.linen, { collide: false });
    box(7.35, 0, 6.4, 7.8, 0.5, 6.9, M.wood, { name: 'nightstand' });
    box(9.3, 0, 3.7, 9.95, 1.9, 4.5, M.lightWood, { name: 'closet' });

    // ネズミの巣穴（壁の下の黒い穴）
    const holes = [
        { x: 0.02, z: 5.8, dir: 1 },
        { x: 9.98, z: 2.1, dir: -1 },
        { x: 9.98, z: 6.1, dir: -1 }
    ];
    holes.forEach(h => {
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x050302 }));
        m.position.set(h.x + h.dir * 0.001, 0, h.z);
        m.rotation.y = h.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        group.add(m);
    });

    // 天井の照明
    [[3, 3.4], [8.2, 1.8], [8.3, 5.4]].forEach(([x, z]) => {
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 24), new THREE.MeshBasicMaterial({ color: 0xfff6e6 }));
        lamp.position.set(x, H - 0.02, z);
        group.add(lamp);
    });

    return { group, colliders, holes, materials: M };
}

// 光: 窓から差し込む日差し + 天井の照明
export function addLights(scene) {
    const hemi = new THREE.HemisphereLight(0xfff4e6, 0x6a4a30, 0.45);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd8a8, 3.4);
    sun.position.set(-4.5, 5.2, 4.8);
    sun.target.position.set(2, 0, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const cam = sun.shadow.camera;
    cam.left = -9; cam.right = 9; cam.top = 7; cam.bottom = -7; cam.near = 0.5; cam.far = 25;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    const lamps = [[3, 3.4, 6], [8.2, 1.8, 4], [8.3, 5.4, 4]].map(([x, z, i]) => {
        const p = new THREE.PointLight(0xffe6c8, i, 0, 2);
        p.position.set(x, 2.25, z);
        scene.add(p);
        return p;
    });
    return { hemi, sun, lamps };
}
