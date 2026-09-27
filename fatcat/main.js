// 起動・タイトル画面・入力・メインループ
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CFG } from './config.js';
import { SFX } from './audio.js';
import { buildTextures } from './textures.js';
import { buildApartment, addLights } from './world.js';
import { CatModel } from './cat.js';
import { Hud } from './hud.js';
import { Game } from './game.js';
import { STAGES } from './stages.js';

buildTextures();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('view').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d1712);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.03, 60);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.allowSleep = true;
world.defaultContactMaterial.friction = 0.4;
world.defaultContactMaterial.restitution = 0.15;

const apt = buildApartment(scene, world);
// 部屋の反射光（環境マップ）は控えめに。後から出てくる物にも効くよう定期的にかけ直す
const ENV = 0.35;
function tuneEnv() {
    scene.traverse(o => {
        if (!o.material) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if ('envMapIntensity' in m) m.envMapIntensity = ENV; });
    });
}
tuneEnv();
let envT = 0;
addLights(scene);
const model = new CatModel();
scene.add(model.root);
const hud = new Hud(camera);
const game = new Game({ scene, camera, world, colliders: apt.colliders, holes: apt.holes, catModel: model, hud });
window.fatcat = game;

let mode = 'title';
let titleT = 0;

function startStage(i) {
    SFX.init();
    mode = 'play';
    game.load(i);
    lock();
}
game.onRetry = () => startStage(game.index);
game.onNext = () => {
    if (game.index + 1 >= STAGES.length) showTitle(true);
    else startStage(game.index + 1);
};

function showTitle(ending) {
    mode = 'title';
    game.unload();
    game.state = 'idle';
    if (document.pointerLockElement) document.exitPointerLock();
    // タイトル: ラグの上でくつろぐ猫
    ['vase', 'mug', 'remote'].forEach((t, k) => game.props.add(t, 2.1 + k * 0.3, 0.4, 2.1));
    game.props.add('tv', 2.3, 0.45, 6.78, Math.PI);
    game.props.add('cushion', 1.9, 0.46, 0.75);
    game.props.add('plant', 0.45, 0, 0.45);
    hud.showTitle(startStage, ending);
}

function titleUpdate(dt) {
    titleT += dt;
    const w = 4 + (Math.sin(titleT * 0.45) * 0.5 + 0.5) * 34;
    model.root.visible = true;
    model.update({ w, t: titleT, speed: 0, onGround: true, loaf: true, lookYaw: Math.sin(titleT * 0.6) * 0.5 }, dt);
    // ラグの上の猫を、南東側からゆっくり回り込んで映す
    const cx = 2.3, cz = 3.0;
    model.root.position.set(cx, 0, cz);
    model.root.rotation.set(0, -0.9, 0);
    model.root.scale.set(1, 1, 1);
    const b = CFG.body(w);
    const r = 0.7 + b.length * 1.9;
    const a = 0.9 + Math.sin(titleT * 0.15) * 0.45;
    camera.position.set(cx + Math.cos(a) * r, 0.25 + b.height * 1.4, cz + Math.sin(a) * r);
    camera.up.set(0, 1, 0);
    camera.lookAt(cx, b.height * 0.75, cz);
    world.step(1 / 60, dt, 3);
    game.props.update(dt);
}

// ---------------------------------------------------------------- 入力

function lock() {
    const el = renderer.domElement;
    if (document.pointerLockElement !== el && el.requestPointerLock) {
        try {
            const p = el.requestPointerLock();
            if (p && p.catch) p.catch(() => {});
        } catch (e) { /* ブラウザによってはロックできない */ }
    }
}

document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === renderer.domElement;
    hud.show('pause', mode === 'play' && game.state === 'play' && !locked);
});
document.getElementById('pause').addEventListener('click', e => {
    if (e.target.id !== 'pause' && e.target.id !== 'pause-resume') return;
    hud.show('pause', false);
    lock();
});
document.getElementById('pause-retry').addEventListener('click', () => startStage(game.index));
document.getElementById('pause-title').addEventListener('click', () => showTitle(false));

document.addEventListener('mousemove', e => {
    if (mode !== 'play' || document.pointerLockElement !== renderer.domElement) return;
    game.yaw += e.movementX * 0.0028;
    game.pitch = Math.max(-0.15, Math.min(1.25, game.pitch + e.movementY * 0.0022));
});

renderer.domElement.addEventListener('mousedown', e => {
    SFX.init();
    if (mode !== 'play') return;
    if (document.pointerLockElement !== renderer.domElement) lock();
    if (e.button === 0) game.punch();
    if (e.button === 2) game.spit();
});
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    game.keys[e.code] = true;
    SFX.init();
    if (mode === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') document.getElementById('title-start').click();
        return;
    }
    if (game.state !== 'play') {
        if (game.state === 'fail' && (e.code === 'Space' || e.code === 'Enter')) startStage(game.index);
        else if (game.state === 'clear' && (e.code === 'Space' || e.code === 'Enter')) game.onNext();
        return;
    }
    switch (e.code) {
        case 'Space': game.startCharge(); break;
        case 'KeyF': game.spit(); break;
        case 'KeyE': game.meow(); break;
        case 'KeyJ': game.punch(); break;
        case 'KeyK': game.spit(); break;
        case 'KeyM': SFX.muted = !SFX.muted; break;
        case 'Escape': hud.show('pause', true); break;
    }
});
window.addEventListener('keyup', e => {
    game.keys[e.code] = false;
    if (e.code === 'Space' && mode === 'play') game.releaseJump();
});
document.getElementById('to-title').addEventListener('click', () => showTitle(false));

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// ---------------------------------------------------------------- ループ

// 重いPCでは自動で描画解像度を下げる（1.5秒ごとに平均フレーム時間を見る）
let last = performance.now();
let perfT = 0, perfN = 0;
let pixelRatio = renderer.getPixelRatio();
function adaptQuality(rawDt) {
    perfT += rawDt;
    perfN++;
    if (perfT < 1.5) return;
    const avg = perfT / perfN;
    perfT = perfN = 0;
    if (avg > 1 / 40 && pixelRatio > 0.6) {
        pixelRatio = Math.max(0.6, pixelRatio * 0.8);
        renderer.setPixelRatio(pixelRatio);
    }
}

function frame(now) {
    const rawDt = (now - last) / 1000;
    const dt = Math.min(0.05, rawDt);
    last = now;
    adaptQuality(Math.min(0.5, rawDt));
    if (mode === 'title') titleUpdate(dt);
    else game.update(dt);
    envT -= dt;
    if (envT <= 0) {
        envT = 0.5;
        tuneEnv();
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
}

showTitle(false);
document.getElementById('loading').classList.add('hidden');
requestAnimationFrame(frame);
