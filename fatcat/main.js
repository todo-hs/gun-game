// 起動・タイトル画面・入力・メインループ
import * as THREE from 'three';
import { CFG } from './config.js';
import { SFX } from './audio.js';
import { buildTown } from './town.js';
import { skyDome } from './toon.js';
import { CatModel } from './catmodel.js';
import { Hud } from './hud.js';
import { Game } from './game.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('view').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SKY = 0xcfe9fb;
scene.fog = new THREE.Fog(SKY, 35, 120);
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.03, 500);

// 空と雲
const sky = skyDome();
scene.add(sky);
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
for (let i = 0; i < 12; i++) {
    const cl = new THREE.Group();
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
    for (let k = 0; k < 4; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 5, 12, 8), cloudMat);
        s.position.set(k * 8 - 12, Math.random() * 3, Math.random() * 4);
        s.scale.y = 0.55;
        cl.add(s);
    }
    cl.position.set(32 + Math.cos(a) * 170, 45 + Math.random() * 30, 24 + Math.sin(a) * 170);
    cl.lookAt(32, cl.position.y, 24);
    scene.add(cl);
}

// 光: 空からの環境光 + 太陽（影は猫の周りだけ細かく）
scene.add(new THREE.HemisphereLight(0xffffff, 0x9bb58a, 1.15));
const sun = new THREE.DirectionalLight(0xfff3dc, 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -14;
sun.shadow.camera.right = sun.shadow.camera.top = 14;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 80;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(-0.45, 1, 0.55).normalize();
function followSun(p) {
    sun.target.position.copy(p);
    sun.position.copy(p).addScaledVector(SUN_DIR, 40);
}

const town = buildTown(scene);
const model = new CatModel('player');
scene.add(model.root);
const hud = new Hud(camera, town);
const game = new Game({ scene, camera, town, catModel: model, hud });
window.fatcat = game;

let mode = 'title';
let titleT = 0;

function begin(fresh) {
    SFX.init();
    mode = 'play';
    game.start(fresh);
    lock();
}

function showTitle() {
    mode = 'title';
    game.state = 'idle';
    hud.clearFloating();
    if (document.pointerLockElement) document.exitPointerLock();
    hud.showTitle(() => begin(false), () => begin(true));
}

// タイトル: 空き地の段ボールの前でくつろぐ猫
function titleUpdate(dt) {
    titleT += dt;
    const w = 5 + (Math.sin(titleT * 0.45) * 0.5 + 0.5) * 30;
    const h = game.sp.home;
    const cx = h.x, cz = h.z;
    model.root.visible = true;
    model.root.position.set(cx, 0, cz);
    model.root.rotation.set(0, 0.6, 0);
    model.root.scale.set(1, 1, 1);
    model.update({ w, t: titleT, speed: 0, onGround: true, loaf: true, happy: true, lookYaw: Math.sin(titleT * 0.6) * 0.5 }, dt);
    const b = CFG.body(w);
    const r = 1.1 + b.length * 2.2;
    const a = -0.6 + Math.sin(titleT * 0.15) * 0.5;
    camera.position.set(cx + Math.cos(a) * r, 0.35 + b.height * 1.3, cz + Math.sin(a) * r);
    camera.up.set(0, 1, 0);
    camera.lookAt(cx, b.height * 0.9 + 0.25, cz);
    followSun(model.root.position);
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

function resume() {
    hud.show('pause', false);
    lock();
}

document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === renderer.domElement;
    if (mode === 'play' && game.state === 'play' && !locked) hud.show('pause', true);
});
document.getElementById('pause').addEventListener('click', e => {
    if (e.target.id !== 'pause' && e.target.id !== 'pause-resume') return;
    resume();
});
document.getElementById('pause-retry').addEventListener('click', () => {
    hud.show('pause', false);
    if (game.state === 'play') game.respawn();
    lock();
});
document.getElementById('pause-title').addEventListener('click', () => showTitle());
document.getElementById('to-title').addEventListener('click', () => showTitle());

const paused = () => !document.getElementById('pause').classList.contains('hidden');

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
    if (e.code === 'KeyM') SFX.muted = !SFX.muted;
    if (game.state === 'fail') {
        if (e.code === 'Space' || e.code === 'Enter') game.respawn();
        return;
    }
    if (game.state === 'clear') {
        if (e.code === 'Space' || e.code === 'Enter') document.getElementById('result-next').click();
        return;
    }
    if (paused()) {
        if (e.code === 'Escape' || e.code === 'Enter') resume();
        return;
    }
    switch (e.code) {
        case 'Space': game.startCharge(); break;
        case 'KeyF': game.spit(); break;
        case 'KeyE': game.meow(); break;
        case 'KeyJ': game.punch(); break;
        case 'KeyK': game.spit(); break;
        case 'Escape':
            hud.show('pause', true);
            if (document.pointerLockElement) document.exitPointerLock();
            break;
    }
});
window.addEventListener('keyup', e => {
    game.keys[e.code] = false;
    if (e.code === 'Space' && mode === 'play') game.releaseJump();
});
window.addEventListener('blur', () => { game.keys = {}; });

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
    else if (!paused()) {
        game.update(dt);
        followSun(game.cat.pos);
    }
    sky.position.copy(camera.position);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
}

showTitle();
document.getElementById('loading').classList.add('hidden');
requestAnimationFrame(frame);
