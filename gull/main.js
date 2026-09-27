// 起動・タイトル画面・入力・メインループ
import * as THREE from 'three';
import { SFX } from './audio.js';
import { buildWorld } from './world.js';
import { skyDome } from './toon.js';
import { Gull } from './bird.js';
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
scene.fog = new THREE.Fog(0xcfe9fb, 80, 260);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 700);

const sky = skyDome();
scene.add(sky);
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
for (let i = 0; i < 14; i++) {
    const cl = new THREE.Group();
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    for (let k = 0; k < 4; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(9 + Math.random() * 7, 12, 8), cloudMat);
        s.position.set(k * 12 - 18, Math.random() * 4, Math.random() * 6);
        s.scale.y = 0.5;
        cl.add(s);
    }
    cl.position.set(70 + Math.cos(a) * 300, 60 + Math.random() * 40, 60 + Math.sin(a) * 300);
    cl.lookAt(70, cl.position.y, 60);
    scene.add(cl);
}

scene.add(new THREE.HemisphereLight(0xffffff, 0xc9b98a, 1.2));
const sun = new THREE.DirectionalLight(0xfff3dc, 2.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -30;
sun.shadow.camera.right = sun.shadow.camera.top = 30;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 150;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(-0.4, 1, 0.6).normalize();
function followSun(p) {
    sun.target.position.copy(p);
    sun.position.copy(p).addScaledVector(SUN_DIR, 80);
}

const world = buildWorld(scene);
const gull = new Gull();
scene.add(gull.root);
const hud = new Hud(camera, world);
const game = new Game({ scene, camera, world, gull, hud });
window.gullgame = game;

let mode = 'title';
let titleT = 0;

function begin() {
    SFX.init();
    SFX.startWind();
    mode = 'play';
    gull.root.visible = true;
    hud.show('pause', false);
    game.start();
}

function showTitle() {
    mode = 'title';
    game.state = 'idle';
    hud.clearFloating();
    SFX.setWind(0);
    if (document.pointerLockElement) document.exitPointerLock();
    hud.showTitle(begin);
}

// タイトル: 浜辺の上をゆっくり旋回するカモメ
function titleUpdate(dt) {
    titleT += dt;
    const a = titleT * 0.25;
    const p = new THREE.Vector3(60 + Math.cos(a) * 18, 9 + Math.sin(titleT * 0.7) * 1.5, 36 + Math.sin(a) * 10);
    gull.root.visible = true;
    gull.root.position.copy(p);
    const yaw = Math.atan2(Math.cos(a) * 10, -Math.sin(a) * 18);
    gull.root.rotation.set(0, -yaw, 0);
    if (Math.sin(titleT * 3) > 0.97) { gull.flap(0); gull.flap(1); }
    gull.update({ w: 1 + (Math.sin(titleT * 0.3) * 0.5 + 0.5) * 2, t: titleT, mode: 'air', speed: 10, pitch: 0, roll: 0.35 }, dt);
    const back = new THREE.Vector3(Math.cos(yaw + 2.4), 0, Math.sin(yaw + 2.4));
    camera.position.copy(p).addScaledVector(back, 4.2).setY(p.y + 1.0);
    camera.up.set(0, 1, 0);
    camera.lookAt(p.x, p.y + 0.3, p.z);
    followSun(p);
    world.sea.tex.offset.set(titleT * 0.01, titleT * 0.02);
    game.animateDrafts(dt);
}

// ---------------------------------------------------------------- 入力

function lock() {
    const el = renderer.domElement;
    if (document.pointerLockElement !== el && el.requestPointerLock) {
        try {
            const p = el.requestPointerLock();
            if (p && p.catch) p.catch(() => {});
        } catch (e) { /* ロックできなくても遊べる */ }
    }
}
const paused = () => !document.getElementById('pause').classList.contains('hidden');
function resume() {
    hud.show('pause', false);
}

document.getElementById('pause').addEventListener('click', e => {
    if (e.target.id === 'pause' || e.target.id === 'pause-resume') resume();
});
document.getElementById('pause-retry').addEventListener('click', () => begin());
document.getElementById('pause-title').addEventListener('click', () => showTitle());
document.getElementById('result-retry').addEventListener('click', () => begin());
document.getElementById('to-title').addEventListener('click', () => showTitle());

document.addEventListener('mousemove', e => {
    if (mode !== 'play' || document.pointerLockElement !== renderer.domElement) return;
    game.camYaw += e.movementX * 0.003;
    game.camPitch = Math.max(-0.6, Math.min(0.9, game.camPitch + e.movementY * 0.002));
    game.mouseLook = true;
    clearTimeout(game.mouseLookT);
    game.mouseLookT = setTimeout(() => { game.mouseLook = false; }, 1500);
});
// 左クリック = 左の翼、右クリック = 右の翼
renderer.domElement.addEventListener('mousedown', e => {
    SFX.init();
    if (mode !== 'play' || game.state !== 'play') return;
    lock();
    if (e.button === 0) game.flap(0);
    if (e.button === 2) game.flap(1);
});
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    game.keys[e.code] = true;
    SFX.init();
    if (e.code === 'KeyM') SFX.muted = !SFX.muted;
    if (mode === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') begin();
        return;
    }
    if (game.state === 'end') {
        if (e.code === 'Enter' || e.code === 'Space') begin();
        return;
    }
    if (paused()) {
        if (e.code === 'Escape' || e.code === 'Enter') resume();
        return;
    }
    switch (e.code) {
        case 'KeyA': game.flap(0); break;
        case 'KeyD': game.flap(1); break;
        case 'Space': game.flap(2); break;
        case 'KeyF': game.poop(); break;
        case 'KeyE': game.cry(); break;
        case 'Escape':
            hud.show('pause', true);
            if (document.pointerLockElement) document.exitPointerLock();
            break;
    }
});
window.addEventListener('keyup', e => { game.keys[e.code] = false; });
window.addEventListener('blur', () => { game.keys = {}; });
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// ---------------------------------------------------------------- ループ

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
        followSun(game.bird.pos);
    }
    sky.position.copy(camera.position);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
}

showTitle();
document.getElementById('loading').classList.add('hidden');
requestAnimationFrame(frame);
