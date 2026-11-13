import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { VitaPose } from './vitaPoses';

/**
 * The Vita campus, built once in low-poly three.js (no React). Seen from above at an angle:
 *
 *   back   |  play area        swimming pool        loungers + umbrellas
 *          |  cliff (home)  ─────────────── glass-walled office floor ─────────────  garden + fountain
 *   front  |  café             8 desks in two rows (monitor shows the job's state)
 *
 * The scene (aerieScene.ts) reads the anchors returned here: nests, desks, leisure spots, zone labels, and the box
 * the camera must keep in view. `animate` moves the water, swings, seesaw, fountain and clouds.
 */

export type Desk = {
    spot: THREE.Vector3;                  // where the eagle stands (beside the desk)
    card: THREE.Vector3;                  // where the desk's number chip floats (above the monitor)
    screen: THREE.MeshStandardMaterial;   // monitor: lights up in the job's colour
    ring: THREE.MeshStandardMaterial;     // pad around the eagle's spot
};
export type LeisureSpot = { pos: THREE.Vector3; pose: VitaPose; bounce?: boolean };
export type Zone = { label: string; at: THREE.Vector3 };
export type World = {
    root: THREE.Group;
    nests: THREE.Vector3[];
    desks: Desk[];
    leisure: LeisureSpot[];
    zones: Zone[];
    fitPoints: THREE.Vector3[];           // what the camera must keep in view
    center: THREE.Vector3;
    animate: (t: number, dt: number) => void;
    dispose: () => void;
};

export const NEST_COUNT = 5;
export const DESK_COLS = 4;
export const DESK_ROWS = 2;

const C = {
    plaza: 0xe9e4da, plazaEdge: 0xb9b2a5, grass: 0x9dc08f, grassDark: 0x7fa874,
    floor: 0xe3d3b8, glass: 0xcfe8ff, frame: 0x475569, desk: 0xf8fafc, deskLeg: 0x64748b, monitor: 0x1e293b,
    rock: 0x5b6878, rockDark: 0x434e5c, rockLight: 0x8592a3, nest: 0x7a5534, twig: 0xa27548, teal: 0x2dd4bf,
    rim: 0xf8fafc, poolFloor: 0x1590c8, water: 0x4cc6f2, rubber: 0xf2b27e, rubber2: 0x8fd19e,
    wood: 0xb07a4a, woodLight: 0xd8b48a, yellow: 0xfacc15, red: 0xef4444, blue: 0x3b82f6, orange: 0xf97316,
    leaf: 0x4f9d6a, leaf2: 0x6bb57a, trunk: 0x7c5a3c, white: 0xffffff,
};

const std = (color: number, p: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...p });

type MeshOpts = { cast?: boolean; receive?: boolean };
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, at: [number, number, number], o: MeshOpts = {}) => {
    const x = new THREE.Mesh(g, m);
    x.position.set(...at);
    x.castShadow = o.cast ?? true;
    x.receiveShadow = o.receive ?? true;
    return x;
};
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);

/** A canvas texture with text, for signs. */
const signTexture = (text: string, bg: string, fg: string, w = 512, h = 128) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (ctx) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = fg;
        ctx.font = `700 ${Math.round(h * 0.46)}px system-ui, -apple-system, Segoe UI, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, h / 2 + 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
};

/** Square tiles for floors (a light grout grid). */
const tileTexture = (base: string, line: string, repeat: [number, number]) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = line;
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, 128, 128);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
};

const skyTexture = () => {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (ctx) {
        const g = ctx.createLinearGradient(0, 0, 0, 256);
        g.addColorStop(0, '#8fbdea');
        g.addColorStop(0.6, '#d7e8fb');
        g.addColorStop(1, '#eef4fa');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 2, 256);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
};

/* ------------------------------------------------------------------ pieces */

const tree = (h = 1, tone = C.leaf) => {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.08, 0.12, 0.9 * h, 6), std(C.trunk), [0, 0.45 * h, 0]));
    const crown = mesh(new THREE.IcosahedronGeometry(0.62 * h, 0), std(tone), [0, 1.2 * h, 0]);
    crown.scale.y = 1.15;
    g.add(crown);
    g.add(mesh(new THREE.IcosahedronGeometry(0.42 * h, 0), std(C.leaf2), [0.25 * h, 1.55 * h, 0.1 * h]));
    return g;
};

const pine = (h = 1) => {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.06, 0.09, 0.5 * h, 5), std(C.trunk), [0, 0.25 * h, 0]));
    g.add(mesh(new THREE.ConeGeometry(0.5 * h, 1.3 * h, 6), std(0x3f7a5c), [0, 1.05 * h, 0]));
    return g;
};

const plant = () => {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.22, 0.17, 0.4, 10), std(0xe2e8f0, { flatShading: false, roughness: 0.5 }), [0, 0.2, 0]));
    g.add(mesh(new THREE.IcosahedronGeometry(0.34, 0), std(C.leaf2), [0, 0.65, 0]));
    return g;
};

const parasol = (canopy: number, h = 2.1) => {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.03, 0.03, h, 6), std(0xe5e7eb), [0, h / 2, 0]));
    const top = mesh(new THREE.ConeGeometry(1.05, 0.42, 10, 1, true), std(canopy, { side: THREE.DoubleSide }), [0, h, 0]);
    g.add(top);
    return g;
};

const lamp = () => {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.04, 0.06, 1.8, 6), std(0x334155), [0, 0.9, 0]));
    g.add(mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff7d6, emissive: 0xffe9a8, emissiveIntensity: 0.8 }), [0, 1.85, 0], { cast: false }));
    return g;
};

const bench = () => {
    const g = new THREE.Group();
    g.add(mesh(box(1.3, 0.06, 0.42), std(C.wood), [0, 0.42, 0]));
    g.add(mesh(box(1.3, 0.34, 0.06), std(C.wood), [0, 0.68, -0.2]));
    for (const x of [-0.55, 0.55]) g.add(mesh(box(0.06, 0.42, 0.4), std(0x334155), [x, 0.21, 0]));
    return g;
};

/* ------------------------------------------------------------------ zones */

const buildCliff = (root: THREE.Group, origin: THREE.Vector3) => {
    const g = new THREE.Group();
    g.position.copy(origin);
    root.add(g);
    // a tall crag of boulders, flattened front-to-back so the ledges stand out toward the viewer
    const parts: [number, number, number, number, number][] = [
        [0, 0.6, 0, 3.0, C.rockDark], [1.4, 1.2, -0.4, 2.2, C.rock], [-1.3, 2.4, -0.3, 2.2, C.rock],
        [0.9, 3.8, -0.6, 2.0, C.rockLight], [-0.7, 5.2, -0.7, 1.8, C.rock], [0.5, 6.5, -0.9, 1.5, C.rockLight],
        [-0.1, 7.6, -1.0, 1.1, C.rock], [2.6, 0.2, 0.2, 1.6, C.rockDark], [-2.6, 0.5, 0.0, 1.8, C.rockDark],
    ];
    const SZ = 0.6;
    parts.forEach(([x, y, z, r, c], i) => {
        const geo = new THREE.IcosahedronGeometry(r, 1);
        const p = geo.getAttribute('position');
        const v = new THREE.Vector3();
        for (let k = 0; k < p.count; k++) {
            v.fromBufferAttribute(p, k);
            const n = Math.sin(v.x * 3.1 + i) * Math.cos(v.y * 2.7 - i) * Math.sin(v.z * 3.7 + i * 2);
            v.multiplyScalar(1 + n * 0.16);
            p.setXYZ(k, v.x, v.y, v.z);
        }
        geo.computeVertexNormals();
        const b = mesh(geo, std(c, { roughness: 0.95 }), [x, y, z]);
        b.scale.z = SZ;
        b.rotation.y = i * 0.7;
        g.add(b);
    });
    // where the rock's front surface is at (x, y), so a ledge can sit on it
    const front = (x: number, y: number) => {
        let zf = -Infinity;
        for (const [cx, cy, cz, r] of parts) {
            const d2 = (x - cx) ** 2 + (y - cy) ** 2;
            if (d2 < r * r) zf = Math.max(zf, cz + SZ * Math.sqrt(r * r - d2) * 1.16);
        }
        return zf === -Infinity ? 0 : zf;
    };
    const ledgeXY: [number, number][] = [[1.9, 1.3], [-1.5, 2.6], [1.5, 3.95], [-1.0, 5.3], [0.9, 6.7]];
    const nests: THREE.Vector3[] = [];
    ledgeXY.forEach(([x, y], i) => {
        const z = front(x, y) + 0.15;
        const shelf = mesh(cyl(0.95, 1.1, 0.34, 7), std(i % 2 ? C.rockLight : C.rock, { roughness: 0.95 }), [x, y - 0.17, z]);
        shelf.rotation.y = i;
        g.add(shelf);
        const nest = new THREE.Group();
        nest.position.set(x, y, z);
        const bowl = mesh(new THREE.TorusGeometry(0.46, 0.13, 6, 14), std(C.nest, { roughness: 1 }), [0, 0.04, 0]);
        bowl.rotation.x = Math.PI / 2;
        bowl.scale.z = 0.8;
        nest.add(bowl);
        const twig = cyl(0.012, 0.012, 0.5, 4);
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            const tw = mesh(twig, std(C.twig, { roughness: 1 }), [Math.cos(a) * 0.48, 0.08, Math.sin(a) * 0.48], { cast: false });
            tw.rotation.set(Math.PI / 2 + 0.3 * Math.sin(k * 1.7), a + 0.6, 0.4);
            nest.add(tw);
        }
        g.add(nest);
        nests.push(new THREE.Vector3(x, y, z).add(origin));
    });
    // a pine on top, teal grass tufts on the ledges
    const top = pine(1.1);
    top.position.set(-0.1, 8.5, -1.0);
    g.add(top);
    const tuft = new THREE.ConeGeometry(0.07, 0.3, 4);
    ledgeXY.forEach(([x, y], i) => {
        for (let k = 0; k < 3; k++) {
            const t = mesh(tuft, std(0x2bb39f, { roughness: 1 }), [x + 0.6 + k * 0.07, y + 0.12, front(x, y) + 0.2 + (k % 2) * 0.05], { cast: false });
            t.rotation.z = (k - 1) * 0.35 + i * 0.05;
            g.add(t);
        }
    });
    return nests;
};

const buildOffice = (root: THREE.Group, disposables: { dispose: () => void }[]) => {
    const g = new THREE.Group();
    root.add(g);
    const X0 = 1.8, X1 = 15.6, Z0 = -1.0, Z1 = 6.2;
    const W = X1 - X0, D = Z1 - Z0, CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2;
    const floorTex = tileTexture('#e7d8bf', '#d3c09f', [W / 1.2, D / 1.2]);
    disposables.push(floorTex);
    g.add(mesh(box(W, 0.14, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }), [CX, 0.07, CZ], { cast: false }));
    // glass walls on three sides (front left open so the floor is visible), slim dark frames
    const glass = new THREE.MeshPhysicalMaterial({ color: C.glass, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, depthWrite: false });
    const frame = std(C.frame, { flatShading: false, roughness: 0.4, metalness: 0.4 });
    const H = 2.0;
    const wall = (x0: number, z0: number, x1: number, z1: number) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const ang = Math.atan2(z1 - z0, x1 - x0);
        const pane = mesh(box(len, H, 0.04), glass, [(x0 + x1) / 2, 0.14 + H / 2, (z0 + z1) / 2], { cast: false, receive: false });
        pane.rotation.y = -ang;
        g.add(pane);
        const top = mesh(box(len, 0.07, 0.08), frame, [(x0 + x1) / 2, 0.14 + H, (z0 + z1) / 2]);
        top.rotation.y = -ang;
        g.add(top);
        const n = Math.max(1, Math.round(len / 1.9));
        for (let i = 0; i <= n; i++) {
            const k = i / n;
            g.add(mesh(box(0.07, H, 0.07), frame, [x0 + (x1 - x0) * k, 0.14 + H / 2, z0 + (z1 - z0) * k]));
        }
    };
    wall(X0, Z0, X1, Z0);
    wall(X0, Z0, X0, 1.8);
    wall(X1, Z0, X1, 2.8);
    // the sign on the back wall
    const signTex = signTexture('VITA  ·  TEST OFFICE', '#0f172a', '#5eead4', 1024, 128);
    disposables.push(signTex);
    const sign = mesh(new THREE.PlaneGeometry(4.2, 0.52), new THREE.MeshBasicMaterial({ map: signTex }), [CX, 0.14 + H + 0.42, Z0], { cast: false, receive: false });
    g.add(sign);
    g.add(mesh(box(4.36, 0.62, 0.06), frame, [CX, 0.14 + H + 0.42, Z0 - 0.04]));

    const desks: Desk[] = [];
    const cols = [3.75, 7.05, 10.35, 13.65];
    const rows = [4.3, 1.0];      // front row first: desks 1-4 are nearest the viewer
    const top = std(C.desk, { flatShading: false, roughness: 0.4 });
    const leg = std(C.deskLeg, { flatShading: false, roughness: 0.5, metalness: 0.3 });
    const body = std(C.monitor, { flatShading: false, roughness: 0.4 });
    for (const z of rows) {
        for (const x of cols) {
            g.add(mesh(box(1.55, 0.07, 0.78), top, [x, 0.84, z]));
            for (const [dx, dz] of [[-0.7, -0.32], [0.7, -0.32], [-0.7, 0.32], [0.7, 0.32]]) g.add(mesh(box(0.05, 0.7, 0.05), leg, [x + dx, 0.49, z + dz]));
            // monitor facing the viewer; its screen glows in the job's colour
            g.add(mesh(box(0.08, 0.3, 0.08), body, [x - 0.1, 1.02, z - 0.22]));
            g.add(mesh(box(0.92, 0.56, 0.05), body, [x - 0.1, 1.38, z - 0.22]));
            const screen = new THREE.MeshStandardMaterial({ color: 0x0b1220, emissive: 0x1e293b, emissiveIntensity: 0.6, roughness: 0.3 });
            g.add(mesh(new THREE.PlaneGeometry(0.82, 0.46), screen, [x - 0.1, 1.38, z - 0.193], { cast: false }));
            g.add(mesh(box(0.5, 0.02, 0.16), leg, [x - 0.1, 0.885, z + 0.12], { cast: false }));
            // an office chair tucked behind
            const chair = new THREE.Group();
            chair.position.set(x - 0.15, 0, z - 0.75);
            chair.add(mesh(cyl(0.22, 0.22, 0.07, 12), std(0x334155), [0, 0.5, 0]));
            chair.add(mesh(box(0.42, 0.45, 0.06), std(0x334155), [0, 0.78, -0.2]));
            chair.add(mesh(cyl(0.03, 0.03, 0.45, 6), leg, [0, 0.25, 0]));
            g.add(chair);
            // the pad the eagle stands on, right of the desk
            const ring = new THREE.MeshStandardMaterial({ color: 0x94a3b8, emissive: 0x94a3b8, emissiveIntensity: 0.15, roughness: 0.4 });
            const pad = mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 40), ring, [x + 1.15, 0.16, z + 0.2], { cast: false });
            pad.rotation.x = Math.PI / 2;
            g.add(pad);
            desks.push({ spot: new THREE.Vector3(x + 1.15, 0.15, z + 0.2), card: new THREE.Vector3(x - 0.1, 1.85, z - 0.22), screen, ring });
        }
    }
    for (const [x, z] of [[X0 + 0.4, Z0 + 0.4], [X1 - 0.4, Z0 + 0.4], [X1 - 0.4, Z1 - 0.5], [X0 + 0.4, 2.4]] as const) {
        const p = plant();
        p.position.set(x, 0.14, z);
        g.add(p);
    }
    return { desks, label: new THREE.Vector3(X0 + 0.2, 0.2, Z1 + 0.1) };
};

const buildPool = (root: THREE.Group, disposables: { dispose: () => void }[]) => {
    const g = new THREE.Group();
    root.add(g);
    const CX = 8.7, CZ = -3.9, W = 8.4, D = 2.7, RIM = 0.32, H = 0.24;
    const rim = std(C.rim, { flatShading: false, roughness: 0.6 });
    g.add(mesh(box(W + 2 * RIM, H, RIM), rim, [CX, H / 2, CZ - D / 2 - RIM / 2]));
    g.add(mesh(box(W + 2 * RIM, H, RIM), rim, [CX, H / 2, CZ + D / 2 + RIM / 2]));
    g.add(mesh(box(RIM, H, D), rim, [CX - W / 2 - RIM / 2, H / 2, CZ]));
    g.add(mesh(box(RIM, H, D), rim, [CX + W / 2 + RIM / 2, H / 2, CZ]));
    const floorTex = tileTexture('#1aa0d8', '#5cc4ec', [W / 0.5, D / 0.5]);
    disposables.push(floorTex);
    const bottom = mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.4 }), [CX, 0.02, CZ], { cast: false });
    bottom.rotation.x = -Math.PI / 2;
    g.add(bottom);
    const waterGeo = new THREE.PlaneGeometry(W, D, 40, 14);
    const water = mesh(waterGeo, new THREE.MeshStandardMaterial({ color: C.water, transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0.15 }), [CX, 0.17, CZ], { cast: false });
    water.rotation.x = -Math.PI / 2;
    g.add(water);
    // a float ring, a ladder and a diving board
    const float = mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 18), std(C.orange, { flatShading: false }), [CX - 1.6, 0.2, CZ + 0.3], { cast: false });
    float.rotation.x = Math.PI / 2;
    g.add(float);
    const steel = std(0xcbd5e1, { flatShading: false, metalness: 0.8, roughness: 0.3 });
    for (const dx of [-0.22, 0.22]) {
        const r = mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 12, Math.PI), steel, [CX + 2.4 + dx, 0.24, CZ + D / 2 + 0.05]);
        r.rotation.y = Math.PI / 2;
        g.add(r);
    }
    g.add(mesh(box(1.4, 0.07, 0.42), std(0x60a5fa, { flatShading: false }), [CX - W / 2 + 0.3, 0.42, CZ - 0.2]));
    g.add(mesh(box(0.3, 0.42, 0.42), std(0x94a3b8), [CX - W / 2 - 0.35, 0.21, CZ - 0.2]));
    const pos = waterGeo.getAttribute('position') as THREE.BufferAttribute;
    const base = Float32Array.from(pos.array as Float32Array);
    return {
        label: new THREE.Vector3(CX + W / 2 + 0.3, 0.35, CZ - D / 2 - 0.3),
        animate: (t: number) => {
            for (let i = 0; i < pos.count; i++) {
                const x = base[i * 3], y = base[i * 3 + 1];
                pos.setZ(i, Math.sin(x * 2.2 + t * 1.6) * 0.025 + Math.cos(y * 3.1 + t * 1.2) * 0.02);
            }
            pos.needsUpdate = true;
            waterGeo.computeVertexNormals();
            float.position.y = 0.2 + Math.sin(t * 1.3) * 0.02;
            float.position.x = CX - 1.6 + Math.sin(t * 0.25) * 0.5;
        },
    };
};

const buildLoungers = (root: THREE.Group): LeisureSpot[] => {
    const g = new THREE.Group();
    root.add(g);
    const spots: LeisureSpot[] = [];
    const xs = [16.6, 18.3, 20.0];
    xs.forEach((x, i) => {
        const z = -3.9;
        g.add(mesh(box(0.72, 0.1, 1.7), std(C.white, { flatShading: false, roughness: 0.6 }), [x, 0.32, z]));
        const back = mesh(box(0.72, 0.08, 0.7), std(i === 1 ? 0x5eead4 : 0x7dd3fc), [x, 0.55, z - 0.62]);
        back.rotation.x = 0.7;
        g.add(back);
        g.add(mesh(box(0.66, 0.05, 1.0), std(i === 1 ? 0x5eead4 : 0x7dd3fc), [x, 0.39, z + 0.25]));
        for (const dx of [-0.3, 0.3]) for (const dz of [-0.75, 0.75]) g.add(mesh(box(0.05, 0.3, 0.05), std(0x94a3b8), [x + dx, 0.15, z + dz]));
        spots.push({ pos: new THREE.Vector3(x, 0.38, z + 0.3), pose: i === 1 ? 'resting2' : 'resting' });
    });
    for (const [x, c] of [[17.45, 0x14b8a6], [19.15, 0xf59e0b]] as const) {
        const p = parasol(c, 2.2);
        p.position.set(x, 0, -4.7);
        g.add(p);
    }
    const towel = mesh(box(0.6, 0.02, 1.1), std(0xfda4af), [21.2, 0.02, -3.0], { cast: false });
    towel.rotation.y = 0.3;
    g.add(towel);
    return spots;
};

const buildPlay = (root: THREE.Group) => {
    const g = new THREE.Group();
    root.add(g);
    const CX = -2.6, CZ = -3.6;
    const floor = mesh(new THREE.CircleGeometry(3.0, 40), std(C.rubber, { flatShading: false, roughness: 1 }), [CX, 0.012, CZ], { cast: false });
    floor.rotation.x = -Math.PI / 2;
    g.add(floor);
    const inner = mesh(new THREE.CircleGeometry(1.6, 32), std(C.rubber2, { flatShading: false, roughness: 1 }), [CX + 0.6, 0.016, CZ + 0.6], { cast: false });
    inner.rotation.x = -Math.PI / 2;
    g.add(inner);

    // slide: a tower with a ladder behind and a yellow chute toward the viewer
    const sx = CX - 1.7, sz = CZ - 1.3;
    for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) g.add(mesh(cyl(0.05, 0.05, 1.4, 6), std(C.blue), [sx + dx, 0.7, sz + dz]));
    g.add(mesh(box(1.0, 0.1, 1.0), std(C.red), [sx, 1.4, sz]));
    g.add(mesh(new THREE.ConeGeometry(0.8, 0.6, 4), std(C.yellow), [sx, 2.1, sz]));
    for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) g.add(mesh(cyl(0.04, 0.04, 0.5, 6), std(C.blue), [sx + dx, 1.65, sz + dz]));
    const chute = mesh(box(0.6, 0.06, 2.0), std(C.yellow, { flatShading: false }), [sx, 0.75, sz + 1.35]);
    chute.rotation.x = 0.72;
    g.add(chute);
    for (const dx of [-0.3, 0.3]) {
        const rail = mesh(box(0.05, 0.16, 2.0), std(C.yellow, { flatShading: false }), [sx + dx, 0.83, sz + 1.35]);
        rail.rotation.x = 0.72;
        g.add(rail);
    }
    for (let k = 0; k < 5; k++) g.add(mesh(box(0.7, 0.04, 0.05), std(C.blue), [sx, 0.25 + k * 0.27, sz - 0.5]));

    // swing set
    const wx = CX + 1.4, wz = CZ - 1.6;
    const frame = std(0x16a34a, { flatShading: false });
    for (const dx of [-1.15, 1.15]) {
        for (const dz of [-0.45, 0.45]) {
            const legM = mesh(cyl(0.05, 0.05, 2.1, 6), frame, [wx + dx, 1.0, wz + dz * 0.55]);
            legM.rotation.x = dz > 0 ? -0.22 : 0.22;
            g.add(legM);
        }
    }
    const bar = mesh(cyl(0.05, 0.05, 2.4, 6), frame, [wx, 2.02, wz]);
    bar.rotation.z = Math.PI / 2;
    g.add(bar);
    const swings: THREE.Group[] = [];
    for (const dx of [-0.5, 0.5]) {
        const s = new THREE.Group();
        s.position.set(wx + dx, 2.0, wz);
        for (const rx of [-0.17, 0.17]) s.add(mesh(cyl(0.012, 0.012, 1.55, 4), std(0x475569), [rx, -0.78, 0], { cast: false }));
        s.add(mesh(box(0.42, 0.05, 0.2), std(dx < 0 ? C.orange : C.blue), [0, -1.55, 0]));
        g.add(s);
        swings.push(s);
    }

    // seesaw
    const kx = CX - 0.7, kz = CZ + 1.4;
    g.add(mesh(new THREE.ConeGeometry(0.22, 0.42, 3), std(0x64748b), [kx, 0.21, kz]));
    const plank = new THREE.Group();
    plank.position.set(kx, 0.42, kz);
    plank.add(mesh(box(2.4, 0.07, 0.24), std(C.red, { flatShading: false }), [0, 0, 0]));
    for (const dx of [-1.0, 1.0]) plank.add(mesh(box(0.1, 0.22, 0.24), std(C.yellow), [dx, 0.12, 0]));
    g.add(plank);

    // trampoline: an eagle bounces here when it wants to play
    const tx = CX + 1.4, tz = CZ + 0.9;
    const ringM = mesh(new THREE.TorusGeometry(0.85, 0.07, 8, 28), std(C.blue, { flatShading: false }), [tx, 0.45, tz]);
    ringM.rotation.x = Math.PI / 2;
    g.add(ringM);
    const mat = mesh(new THREE.CircleGeometry(0.8, 28), std(0x111827, { flatShading: false }), [tx, 0.44, tz], { cast: false });
    mat.rotation.x = -Math.PI / 2;
    g.add(mat);
    for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        g.add(mesh(cyl(0.03, 0.03, 0.44, 5), std(0x334155), [tx + Math.cos(a) * 0.82, 0.22, tz + Math.sin(a) * 0.82]));
    }
    return {
        spots: [{ pos: new THREE.Vector3(tx, 0.45, tz), pose: 'joyful' as VitaPose, bounce: true }],
        label: new THREE.Vector3(sx, 2.6, sz),
        animate: (t: number) => {
            swings.forEach((s, i) => { s.rotation.x = Math.sin(t * 1.7 + i * 1.3) * (0.32 - i * 0.1); });
            plank.rotation.z = Math.sin(t * 1.1) * 0.2;
        },
    };
};

const buildCafe = (root: THREE.Group, disposables: { dispose: () => void }[]) => {
    const g = new THREE.Group();
    root.add(g);
    const wood = std(C.wood, { flatShading: false, roughness: 0.6 });
    // counter with an awning, a coffee machine and a menu board
    g.add(mesh(box(2.6, 1.0, 0.75), wood, [-3.4, 0.5, 1.65]));
    g.add(mesh(box(2.7, 0.06, 0.85), std(C.woodLight, { flatShading: false }), [-3.4, 1.03, 1.65]));
    g.add(mesh(box(0.42, 0.5, 0.36), std(0x1f2937, { flatShading: false, metalness: 0.4, roughness: 0.35 }), [-4.2, 1.31, 1.6]));
    g.add(mesh(cyl(0.07, 0.06, 0.14, 10), std(C.white, { flatShading: false }), [-4.0, 1.13, 1.82]));
    for (const dx of [-1.25, 1.25]) g.add(mesh(cyl(0.04, 0.04, 1.4, 6), std(0x334155), [-3.4 + dx, 1.75, 1.35]));
    const awning = mesh(box(2.9, 0.06, 1.1), std(0x14b8a6, { flatShading: false }), [-3.4, 2.42, 1.75]);
    awning.rotation.x = 0.28;
    g.add(awning);
    const menuTex = signTexture('CAFÉ', '#fff7ed', '#9a3412', 256, 96);
    disposables.push(menuTex);
    g.add(mesh(new THREE.PlaneGeometry(1.2, 0.45), new THREE.MeshBasicMaterial({ map: menuTex }), [-3.4, 2.1, 1.27], { cast: false, receive: false }));
    // two tables under parasols
    const tables: [number, number][] = [[-4.5, 4.3], [-1.7, 4.6]];
    tables.forEach(([x, z], i) => {
        g.add(mesh(cyl(0.5, 0.5, 0.05, 18), std(C.white, { flatShading: false }), [x, 0.76, z]));
        g.add(mesh(cyl(0.05, 0.07, 0.74, 8), std(0x334155), [x, 0.37, z]));
        for (const a of [0.3, 2.6]) g.add(mesh(cyl(0.18, 0.18, 0.05, 12), std(i ? 0xf59e0b : 0x14b8a6, { flatShading: false }), [x + Math.cos(a) * 0.8, 0.48, z + Math.sin(a) * 0.8]));
        g.add(mesh(cyl(0.12, 0.1, 0.06, 10), std(C.white, { flatShading: false }), [x - 0.15, 0.81, z]));
        const p = parasol(i ? 0xf97316 : 0xfef3c7, 2.0);
        p.position.set(x, 0, z);
        g.add(p);
    });
    return {
        spots: [
            { pos: new THREE.Vector3(-2.7, 0.0, 2.45), pose: 'relaxed' as VitaPose },
            { pos: new THREE.Vector3(-1.0, 0.0, 4.9), pose: 'eating' as VitaPose },
        ],
        label: new THREE.Vector3(-3.0, 0.1, 6.2),
    };
};

const buildGarden = (root: THREE.Group) => {
    const g = new THREE.Group();
    root.add(g);
    // fountain
    const fx = 19.0, fz = 2.9;
    g.add(mesh(cyl(1.2, 1.3, 0.35, 20), std(0xe2e8f0, { flatShading: false }), [fx, 0.17, fz]));
    const pool = mesh(new THREE.CircleGeometry(1.05, 24), new THREE.MeshStandardMaterial({ color: C.water, roughness: 0.1, transparent: true, opacity: 0.8 }), [fx, 0.33, fz], { cast: false });
    pool.rotation.x = -Math.PI / 2;
    g.add(pool);
    g.add(mesh(cyl(0.14, 0.2, 0.9, 10), std(0xe2e8f0, { flatShading: false }), [fx, 0.75, fz]));
    g.add(mesh(cyl(0.5, 0.35, 0.12, 16), std(0xe2e8f0, { flatShading: false }), [fx, 1.2, fz]));
    const jets: THREE.Mesh[] = [];
    const jetMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.85, roughness: 0.1 });
    for (let k = 0; k < 6; k++) {
        const j = mesh(new THREE.SphereGeometry(0.05, 6, 4), jetMat, [fx, 1.35, fz], { cast: false });
        g.add(j);
        jets.push(j);
    }
    for (const [x, z, h, tone] of [[17.0, 0.6, 1.1, C.leaf], [21.2, 1.2, 1.3, C.leaf2], [21.4, 4.9, 1.0, C.leaf], [16.8, 5.4, 1.2, C.leaf2]] as const) {
        const t = tree(h, tone);
        t.position.set(x, 0, z);
        g.add(t);
    }
    const b1 = bench();
    b1.position.set(19.0, 0, 5.3);
    b1.rotation.y = Math.PI;
    g.add(b1);
    return {
        label: new THREE.Vector3(fx, 2.3, fz),
        animate: (t: number) => {
            jets.forEach((j, k) => {
                const a = (k / jets.length) * Math.PI * 2;
                const u = (t * 0.9 + k * 0.17) % 1;
                j.position.set(fx + Math.cos(a) * u * 0.8, 1.35 + Math.sin(u * Math.PI) * 0.45 - u * 0.35, fz + Math.sin(a) * u * 0.8);
            });
        },
    };
};

const buildBackdrop = (scene: THREE.Scene) => {
    const g = new THREE.Group();
    const ground = mesh(new THREE.PlaneGeometry(400, 200), std(C.grass, { flatShading: false, roughness: 1 }), [3, -0.6, -40], { cast: false });
    ground.rotation.x = -Math.PI / 2;
    g.add(ground);
    const mtn = (x: number, z: number, h: number, r: number, c: number, snow: boolean) => {
        const seg = 5 + (Math.abs(Math.round(x)) % 3);
        const m = mesh(new THREE.ConeGeometry(r, h, seg), std(c, { roughness: 1 }), [x, -0.6 + h / 2, z], { cast: false, receive: false });
        m.rotation.y = x * 0.37;
        g.add(m);
        if (snow) {
            const cap = mesh(new THREE.ConeGeometry(r * 0.32, h * 0.32, seg), std(0xf8fafc), [x, -0.6 + h - h * 0.16, z], { cast: false, receive: false });
            cap.rotation.y = m.rotation.y;
            g.add(cap);
        }
    };
    const peaks: [number, number, number, number, number, boolean][] = [
        [-40, -70, 26, 18, 0x8fa3bb, true], [-14, -78, 32, 20, 0x9db0c6, true], [10, -74, 24, 17, 0x8fa3bb, true],
        [34, -80, 34, 22, 0x9db0c6, true], [58, -72, 22, 16, 0x8fa3bb, false], [80, -78, 28, 19, 0x9db0c6, true],
    ];
    for (const r of peaks) mtn(...r);
    const hill = std(0x8fae8c, { roughness: 1 });
    for (const [x, z, r] of [[-30, -34, 12], [-4, -40, 15], [24, -36, 13], [48, -40, 16]] as const) {
        const h = mesh(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), hill, [x, -0.6, z], { cast: false });
        h.scale.y = 0.18;
        g.add(h);
    }
    for (let i = 0; i < 46; i++) {
        const p = pine(0.9 + ((i * 7) % 5) * 0.12);
        const x = -24 + ((i * 37) % 56) + Math.sin(i) * 2;
        const z = -10 - ((i * 13) % 16);
        p.position.set(x, -0.6, z);
        g.add(p);
    }
    // a few pines in front of the campus, left and right, for depth
    for (const [x, z] of [[-14, 6], [-13, 3.5], [24, 6.5], [25, 2], [24.5, -3]] as const) {
        const p = pine(1.2);
        p.position.set(x, -0.6, z);
        g.add(p);
    }
    scene.add(g);
    const clouds: THREE.Group[] = [];
    const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.94 });
    for (let s = 0; s < 4; s++) {
        const c = new THREE.Group();
        const n = 4 + (s % 3);
        for (let i = 0; i < n; i++) {
            const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + ((s * 7 + i * 3) % 5) * 0.18, 1), cm);
            b.position.set(i * 1.05 - n * 0.5, Math.sin(i * 2.1 + s) * 0.25, Math.cos(i * 1.3) * 0.3);
            b.scale.y = 0.7;
            c.add(b);
        }
        c.position.set(-30 + s * 17, 9 + (s % 2) * 1.6, -16 - s * 3);
        clouds.push(c);
        scene.add(c);
    }
    return (dt: number) => clouds.forEach((c, i) => {
        c.position.x += dt * (0.35 + i * 0.07);
        if (c.position.x > 50) c.position.x = -40;
    });
};

/* ------------------------------------------------------------------ the world */

export const buildWorld = (scene: THREE.Scene): World => {
    const disposables: { dispose: () => void }[] = [];
    const sky = skyTexture();
    disposables.push(sky);
    scene.background = sky;
    scene.fog = new THREE.Fog(0xdbe7f5, 40, 120);

    const root = new THREE.Group();
    scene.add(root);
    const moveClouds = buildBackdrop(scene);

    // the plaza everything stands on
    const plazaTex = tileTexture('#ece7de', '#ddd5c7', [28.8 / 1.5, 13.6 / 1.5]);
    disposables.push(plazaTex);
    root.add(mesh(new RoundedBoxGeometry(29.3, 0.6, 13.6, 3, 0.25), new THREE.MeshStandardMaterial({ color: C.plazaEdge, roughness: 0.9 }), [8.0, -0.31, -0.2], { cast: false }));
    const plazaTop = mesh(new THREE.PlaneGeometry(28.8, 13.1), new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.85 }), [8.0, 0.002, -0.2], { cast: false });
    plazaTop.rotation.x = -Math.PI / 2;
    root.add(plazaTop);
    // lawn strips and lamp posts along the front edge
    for (const [x, w] of [[-3.0, 5.6], [19.0, 5.8]] as const) {
        const lawn = mesh(box(w, 0.04, 1.0), std(C.grassDark, { flatShading: false, roughness: 1 }), [x, 0.02, 6.0], { cast: false });
        root.add(lawn);
    }
    for (const x of [-5.4, 0.6, 16.4, 21.6]) {
        const l = lamp();
        l.position.set(x, 0, 6.1);
        root.add(l);
    }

    const nests = buildCliff(root, new THREE.Vector3(-10.6, -0.6, -1.8));
    const office = buildOffice(root, disposables);
    const pool = buildPool(root, disposables);
    const loungers = buildLoungers(root);
    const play = buildPlay(root);
    const cafe = buildCafe(root, disposables);
    const garden = buildGarden(root);

    const zones: Zone[] = [
        { label: 'Home cliff', at: new THREE.Vector3(-10.6, 8.6, -2.2) },
        { label: 'Office', at: office.label },
        { label: 'Pool', at: pool.label },
        { label: 'Play area', at: play.label },
        { label: 'Café', at: cafe.label },
        { label: 'Garden', at: garden.label },
    ];

    return {
        root,
        nests,
        desks: office.desks,
        leisure: [...loungers, ...play.spots, ...cafe.spots],
        zones,
        fitPoints: [
            new THREE.Vector3(-10.6, 9.2, -2.4), new THREE.Vector3(-13.6, -0.6, -1.5), new THREE.Vector3(-7.6, -0.6, 1.4),
            new THREE.Vector3(-6.7, 0, -6.9), new THREE.Vector3(22.6, 0, -6.9), new THREE.Vector3(-6.7, -0.6, 6.5), new THREE.Vector3(22.6, -0.6, 6.5),
            new THREE.Vector3(-4.3, 2.4, -4.9), new THREE.Vector3(18.3, 2.5, -4.7), new THREE.Vector3(8.7, 2.9, -1.0),
        ],
        center: new THREE.Vector3(4.5, 1.2, 0.2),
        animate: (t: number, dt: number) => {
            pool.animate(t);
            play.animate(t);
            garden.animate(t);
            moveClouds(dt);
        },
        dispose: () => disposables.forEach((d) => d.dispose()),
    };
};
