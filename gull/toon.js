// アニメ調の見た目: 3段階のトゥーン陰影と、キャラクター用の輪郭線
import * as THREE from 'three';

let gradient = null;

// 影の段階（暗・中・明）
export function toonGradient() {
    if (gradient) return gradient;
    const data = new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
    gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
    return gradient;
}

export function toon(color, extra = {}) {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });
    return m;
}

export function toonMap(map, extra = {}) {
    return new THREE.MeshToonMaterial({ map, gradientMap: toonGradient(), ...extra });
}

// 輪郭線: 裏面だけを法線方向に少し膨らませて描く（背面法）
export function outlineMaterial(color = 0x3b2417) {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    const thick = { value: 0.01 };
    m.userData.thick = thick;
    m.onBeforeCompile = sh => {
        sh.uniforms.outlineThick = thick;
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float outlineThick;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * outlineThick;');
    };
    m.customProgramCacheKey = () => 'toon-outline';
    return m;
}

// メッシュに輪郭線を付ける。world は画面上でだいたい同じ太さに見せたい線幅（メートル）
export function addOutline(mesh, world = 0.006, color) {
    const om = outlineMaterial(color);
    const o = new THREE.Mesh(mesh.geometry, om);
    o.castShadow = false;
    o.receiveShadow = false;
    o.userData.world = world;
    o.userData.isOutline = true;
    mesh.add(o);
    mesh.userData.outline = o;
    return o;
}

const tmpScale = new THREE.Vector3();
// 親の拡大率が変わっても線の太さが変わらないように、ローカルの太さを直す
export function refreshOutlines(root) {
    root.traverse(o => {
        if (!o.userData.isOutline || !o.parent) return;
        o.parent.getWorldScale(tmpScale);
        const s = (Math.abs(tmpScale.x) + Math.abs(tmpScale.y) + Math.abs(tmpScale.z)) / 3 || 1;
        o.material.userData.thick.value = o.userData.world / s;
    });
}

// 空: 上が青、地平線が明るいグラデーション
export function skyDome() {
    const g = new THREE.SphereGeometry(400, 32, 16);
    const m = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color(0x4aa3f0) }, bottom: { value: new THREE.Color(0xdff1ff) } },
        vertexShader: 'varying float vy; void main() { vy = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float vy; void main() { float t = smoothstep(-0.05, 0.6, vy); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }'
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = -10;
    return mesh;
}
