import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { EagleMood } from './aerieJobs';
import { HOME_POSES, poseForMood, type VitaPose } from './vitaPoses';

/**
 * The aerie in 3D (three.js, no React). A cliff on the left with three nests, a work deck on the right with a row
 * of perch stations, mountains and clouds behind. Each eagle is a low-poly model with jointed wings: it takes off
 * from its nest, flies a banking arc that swings toward the viewer, glides, flares and lands on its station, and
 * flies home the same way when its job is done.
 *
 * The host (VitaAerie3D) tells the scene which station each eagle should be at and each station's state; the scene
 * reports, every frame, where stations and eagle heads are on screen so the host can place its HTML labels.
 */

export type StationState = { phase: 'queued' | 'running' | 'done'; verdict?: string | null } | null;
export type EagleOrder = { station: number | null; mood: EagleMood };
export type ScreenPoint = { x: number; y: number };
export type FrameInfo = {
    stations: ScreenPoint[];     // the front-centre of each station's base, for its card
    eagles: (ScreenPoint & { flying: boolean })[];   // above each eagle's head, for its bubble/badge
    deck: { left: ScreenPoint; right: ScreenPoint };  // top corners of the deck, for its title and the waiting chip
};

const STATION_GAP = 3.3;           // world units between stations
const FOV = 30;
const CAM = new THREE.Vector3(0, 1.4, 15);
const LOOK = new THREE.Vector3(0, 0.5, 0);
const DECK_Y = -1.55;              // deck top
const PERCH_Y = DECK_Y + 0.16;     // where an eagle stands on a station (on its pad)

const COLORS = {
    plumage: 0x5f7489, plumageDark: 0x45576a, chest: 0xd6dde6, head: 0xeef2f6, beak: 0xf2b21b, talon: 0xe0a419,
    teal: 0x2dd4bf, rock: 0x5b6878, rockDark: 0x434e5c, rockLight: 0x8592a3, nest: 0x7a5534, twig: 0xa27548,
    deck: 0x334155, deckEdge: 0x1e293b, post: 0x64748b,
};
const RING = { idle: 0x94a3b8, queued: 0xa78bfa, running: 0x38bdf8, green: 0x22c55e, red: 0xef4444, neutral: 0xf59e0b };

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const lerp = THREE.MathUtils.lerp;
const damp = (a: number, b: number, k: number, dt: number) => lerp(a, b, 1 - Math.exp(-k * dt));

/* ------------------------------------------------------------------ eagle: the Vita artwork as sprites */

const PX = 1.95 / 235;             // world units per artwork pixel (every pose shares the sheet's scale)
const FADE_S = 0.28;               // pose cross-fade
const GREET_S = 3.2;               // the welcome wave when the page opens

type PoseTex = { tex: THREE.Texture; flip: THREE.Texture; w: number; h: number };

const softShadow = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    if (ctx) {
        const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
        g.addColorStop(0, 'rgba(15,23,42,0.55)');
        g.addColorStop(1, 'rgba(15,23,42,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(c);
};

const spriteOf = () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, fog: false, depthWrite: false, depthTest: false, alphaTest: 0.02 }));
    s.center.set(0.5, 0.03);       // anchored at the feet
    s.renderOrder = 10;            // drawn over the scenery: an eagle is never hidden behind a rock
    return s;
};

/* ------------------------------------------------------------------ scenery */

const rockMat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true });

/** An irregular boulder: an icosahedron with its vertices pushed in and out. */
const boulder = (r: number, color: number, seed: number) => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    const p = g.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const n = Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 - seed) * Math.sin(v.z * 3.7 + seed * 2);
        v.multiplyScalar(1 + n * 0.22);
        p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockMat(color));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
};

const makeNest = () => {
    const g = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.13, 6, 14), new THREE.MeshStandardMaterial({ color: COLORS.nest, roughness: 1, flatShading: true }));
    bowl.rotation.x = Math.PI / 2;
    bowl.scale.z = 0.8;
    bowl.receiveShadow = true;
    bowl.castShadow = true;
    g.add(bowl);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.4, 12), new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.04;
    floor.receiveShadow = true;
    g.add(floor);
    const twig = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4);
    const twigMat = new THREE.MeshStandardMaterial({ color: COLORS.twig, roughness: 1 });
    for (let i = 0; i < 9; i++) {
        const t = new THREE.Mesh(twig, twigMat);
        const a = (i / 9) * Math.PI * 2;
        t.position.set(Math.cos(a) * 0.44, 0.05, Math.sin(a) * 0.44);
        t.rotation.set(Math.PI / 2 + 0.3 * Math.sin(i * 1.7), a + 0.6, 0.4);
        g.add(t);
    }
    return g;
};

const makeCloud = (seed: number) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.92 });
    const n = 4 + (seed % 3);
    for (let i = 0; i < n; i++) {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + ((seed * 7 + i * 3) % 5) * 0.12, 1), mat);
        s.position.set(i * 0.7 - n * 0.35, Math.sin(i * 2.1 + seed) * 0.18, Math.cos(i * 1.3) * 0.2);
        s.scale.y = 0.7;
        g.add(s);
    }
    return g;
};

const skyTexture = () => {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (ctx) {
        const gr = ctx.createLinearGradient(0, 0, 0, 256);
        gr.addColorStop(0, '#9cc4ee');
        gr.addColorStop(0.55, '#dbeafe');
        gr.addColorStop(1, '#f1f5f9');
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, 2, 256);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
};

/* ------------------------------------------------------------------ flight */

type Flight = { curve: THREE.CubicBezierCurve3; t0: number; dur: number; toStation: number | null; leftward: boolean };

type EagleState = {
    root: THREE.Group;
    a: THREE.Sprite;                   // the pose showing
    b: THREE.Sprite;                   // the pose fading out
    shadow: THREE.Mesh;
    pose: VitaPose | null;
    flipped: boolean;
    fade: number;
    station: number | null;            // where it is (or is heading)
    mood: EagleMood;
    flight: Flight | null;
    homePose: VitaPose;
    homeTimer: number;
    greetUntil: number;
    landedAt: number;
};

/* ------------------------------------------------------------------ the scene */

export class AerieScene {
    private renderer: THREE.WebGLRenderer;
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(FOV, 4, 0.1, 120);
    private clock = new THREE.Clock();
    private raf = 0;
    private running = false;
    private width = 1;
    private height = 1;

    private cliff = new THREE.Group();
    private nests: THREE.Vector3[] = [];
    private deck = new THREE.Group();
    private deckSlab: THREE.Mesh;
    private stations: { group: THREE.Group; ring: THREE.Mesh; glow: THREE.PointLight; pos: THREE.Vector3 }[] = [];
    private stationStates: StationState[] = [];
    private eagles: EagleState[] = [];
    private clouds: THREE.Group[] = [];
    private deckLeft = 0;
    private deckRight = 0;
    private cameraSway = 0;

    /** How many stations fit at the current size (the host shows that many job slots). */
    stationCount = 1;

    private onFrame: (f: FrameInfo) => void;
    private onLayout: (stations: number) => void;
    private poses = new Map<VitaPose, PoseTex>();
    private awake = true;

    constructor(canvas: HTMLCanvasElement, poseUrls: Record<VitaPose, string>, onFrame: (f: FrameInfo) => void, onLayout: (stations: number) => void) {
        this.onFrame = onFrame;
        this.onLayout = onLayout;
        const loader = new THREE.TextureLoader();
        (Object.keys(poseUrls) as VitaPose[]).forEach((k) => {
            const entry: PoseTex = { tex: new THREE.Texture(), flip: new THREE.Texture(), w: 230, h: 230 };
            entry.tex = loader.load(poseUrls[k], (t) => {
                const img = t.image as { width: number; height: number };
                entry.w = img.width;
                entry.h = img.height;
                // the mirrored copy shares the image: flying back home faces the other way
                const f = t.clone();
                f.wrapS = THREE.RepeatWrapping;
                f.repeat.x = -1;
                f.offset.x = 1;
                f.needsUpdate = true;
                entry.flip = f;
            });
            entry.tex.colorSpace = THREE.SRGBColorSpace;
            entry.tex.anisotropy = 4;
            this.poses.set(k, entry);
        });
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
        this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene.background = skyTexture();
        this.scene.fog = new THREE.Fog(0xdbe7f5, 18, 60);
        this.camera.position.copy(CAM);
        this.camera.lookAt(LOOK);

        this.scene.add(new THREE.HemisphereLight(0xe0efff, 0x55606e, 1.25));
        const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
        sun.position.set(-6, 12, 9);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 1024);
        Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 8, bottom: -6, near: 1, far: 40 });
        sun.shadow.bias = -0.0008;
        sun.shadow.normalBias = 0.02;
        this.scene.add(sun);

        this.buildBackdrop();
        this.scene.add(this.cliff);
        this.buildCliff();

        this.deckSlab = new THREE.Mesh(
            new RoundedBoxGeometry(1, 0.5, 2.6, 4, 0.18),
            new THREE.MeshStandardMaterial({ color: COLORS.deck, roughness: 0.6, metalness: 0.15 }),
        );
        this.deckSlab.receiveShadow = true;
        this.deckSlab.castShadow = true;
        this.deck.add(this.deckSlab);
        this.scene.add(this.deck);

        for (let i = 0; i < 3; i++) {
            const c = makeCloud(i + 1);
            c.position.set(-14 + i * 11, 3.2 + (i % 2) * 0.9, -6 - i * 2);
            this.clouds.push(c);
            this.scene.add(c);
        }

        const shadowTex = softShadow();
        for (let e = 0; e < 3; e++) {
            const root = new THREE.Group();
            const a = spriteOf(), b = spriteOf();
            b.visible = false;
            root.add(a, b);
            const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.55),
                new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.9 }));
            shadow.rotation.x = -Math.PI / 2;
            shadow.position.y = 0.02;
            root.add(shadow);
            this.scene.add(root);
            this.eagles.push({
                root, a, b, shadow, pose: null, flipped: false, fade: 1, station: null, mood: 'home', flight: null,
                homePose: HOME_POSES[e % HOME_POSES.length], homeTimer: 26 + e * 9,
                greetUntil: e === 0 ? GREET_S : 0, landedAt: 0,
            });
        }
    }

    /* ---------- building */

    private buildBackdrop() {
        const far = new THREE.Group();
        const mtn = (x: number, z: number, h: number, r: number, c: number, snow: boolean) => {
            const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5 + (Math.abs(Math.round(x)) % 3)), rockMat(c));
            m.position.set(x, -4 + h / 2, z);
            m.rotation.y = x * 0.37;
            far.add(m);
            if (snow) {
                const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, h * 0.32, m.geometry.parameters.radialSegments), rockMat(0xf8fafc));
                cap.position.set(x, -4 + h - h * 0.16, z);
                cap.rotation.y = m.rotation.y;
                far.add(cap);
            }
        };
        const ridge: [number, number, number, number, number, boolean][] = [
            [-26, -38, 13, 9, 0x8fa3bb, true], [-12, -42, 16, 10, 0x9db0c6, true], [2, -40, 12, 9, 0x8fa3bb, true],
            [16, -44, 17, 11, 0x9db0c6, true], [30, -38, 12, 9, 0x8fa3bb, false], [44, -42, 15, 10, 0x9db0c6, true],
        ];
        for (const r of ridge) mtn(...r);
        const hillMat = new THREE.MeshStandardMaterial({ color: 0x8fae8c, roughness: 1, flatShading: true });
        for (const [x, z, r] of [[-30, -20, 9], [-8, -24, 11], [14, -21, 9], [36, -24, 12]] as const) {
            const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
            hill.scale.y = 0.32;
            hill.position.set(x, -4, z);
            hill.receiveShadow = true;
            far.add(hill);
        }
        const valley = new THREE.Mesh(new THREE.PlaneGeometry(200, 80), new THREE.MeshStandardMaterial({ color: 0x9fb39a, roughness: 1 }));
        valley.rotation.x = -Math.PI / 2;
        valley.position.set(0, -4, -20);
        valley.receiveShadow = true;
        far.add(valley);
        // pine clusters on the valley floor for scale
        const pine = new THREE.ConeGeometry(0.35, 1.2, 5);
        const pineMat = new THREE.MeshStandardMaterial({ color: 0x3f6b5a, flatShading: true, roughness: 1 });
        for (let i = 0; i < 40; i++) {
            const t = new THREE.Mesh(pine, pineMat);
            t.position.set(-30 + ((i * 37) % 60) + Math.sin(i) * 2, -3.4, -8 - ((i * 13) % 14));
            t.scale.setScalar(0.8 + ((i * 7) % 5) * 0.12);
            far.add(t);
        }
        this.scene.add(far);
    }

    private buildCliff() {
        // a crag of stacked boulders with three ledges, the top one highest
        const parts: [number, number, number, number, number][] = [
            [0, -3.6, 0, 2.6, COLORS.rockDark], [0.6, -1.6, -0.2, 2.2, COLORS.rock], [-0.4, 0.2, -0.4, 1.9, COLORS.rock],
            [0.2, 1.3, -0.6, 1.4, COLORS.rockLight], [1.8, -2.4, 0.4, 1.6, COLORS.rockDark], [-1.6, -1.2, 0.4, 1.7, COLORS.rockDark],
            [1.6, 0.5, -0.3, 1.1, COLORS.rock], [-1.2, 1.9, -0.8, 1.0, COLORS.rockLight],
        ];
        parts.forEach(([x, y, z, r, c], i) => {
            const b = boulder(r, c, i * 1.7 + 0.3);
            b.position.set(x, y, z);
            b.rotation.set(i * 0.4, i * 0.9, 0);
            this.cliff.add(b);
        });
        // ledges: flat stone shelves, each holding a nest
        const ledges: [number, number, number][] = [[-0.2, 2.05, 0.55], [1.75, 0.7, 0.9], [0.1, -0.7, 1.45]];
        ledges.forEach(([x, y, z], i) => {
            const shelf = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.35, 7), rockMat(i === 1 ? COLORS.rockLight : COLORS.rock));
            shelf.position.set(x, y - 0.18, z);
            shelf.rotation.y = i;
            shelf.receiveShadow = true;
            shelf.castShadow = true;
            this.cliff.add(shelf);
            const nest = makeNest();
            nest.position.set(x, y + 0.02, z);
            this.cliff.add(nest);
            this.nests.push(new THREE.Vector3(x, y - 0.02, z));
        });
        // grass tufts in the brand teal
        const tuft = new THREE.ConeGeometry(0.08, 0.32, 4);
        const grass = new THREE.MeshStandardMaterial({ color: 0x2bb39f, roughness: 1, flatShading: true });
        const spots: [number, number, number][] = [[-1.1, 2.15, 0.2], [-0.9, 2.2, 0.1], [0.75, 2.02, 0.3], [2.3, 0.75, 0.6], [2.45, 0.73, 0.5], [-0.75, -0.65, 1.3]];
        spots.forEach(([x, y, z], i) => {
            for (let k = 0; k < 3; k++) {
                const g = new THREE.Mesh(tuft, grass);
                g.position.set(x + k * 0.07, y, z + (k % 2) * 0.05);
                g.rotation.z = (k - 1) * 0.35 + i * 0.05;
                this.cliff.add(g);
            }
        });
    }

    /** Fit the cliff to the left edge and spread the deck and its stations over the rest of the view. */
    private layout() {
        const dist = CAM.distanceTo(LOOK);
        const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
        const w = h * this.camera.aspect;
        const left = -w / 2, right = w / 2;

        const cliffX = left + 2.7;
        this.cliff.position.set(cliffX, 0, 0);

        // the deck's front edge is nearer the camera (looks wider), so fit its right end at that depth
        const front = 2 * (CAM.z - 2.0) * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * this.camera.aspect;
        this.deckLeft = cliffX + 4.6;
        this.deckRight = Math.min(right, front / 2) - 1.2;
        const span = this.deckRight - this.deckLeft;
        const count = Math.max(1, Math.min(6, Math.floor(span / STATION_GAP)));
        const gap = span / count;
        this.deckSlab.scale.x = span;
        this.deck.position.set((this.deckLeft + this.deckRight) / 2, DECK_Y - 0.25, 0.6);

        while (this.stations.length < count) this.stations.push(this.makeStation());
        this.stations.forEach((s, i) => {
            s.group.visible = i < count;
            const x = this.deckLeft + gap * (i + 0.5);
            s.group.position.set(x, DECK_Y, 0.85);
            s.pos.set(x, PERCH_Y, 0.85);
        });
        if (count !== this.stationCount) {
            this.stationCount = count;
            this.onLayout(count);
        }
        // eagles standing somewhere that just moved follow it
        this.eagles.forEach((e, i) => {
            if (!e.flight) this.place(e, this.spot(e.station, i));
        });
    }

    private makeStation() {
        const group = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.14, 28), new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.2 }));
        base.position.y = 0.07;
        base.receiveShadow = true;
        base.castShadow = true;
        group.add(base);
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.66, 0.04, 8, 48),
            new THREE.MeshStandardMaterial({ color: RING.idle, emissive: RING.idle, emissiveIntensity: 0.2, roughness: 0.4 }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.15;
        group.add(ring);
        const glow = new THREE.PointLight(RING.idle, 0, 2.2, 2);
        glow.position.y = 0.45;
        group.add(glow);
        this.scene.add(group);
        return { group, ring, glow, pos: new THREE.Vector3() };
    }

    private spot(station: number | null, eagle: number): THREE.Vector3 {
        if (station !== null && this.stations[station]) return this.stations[station].pos.clone();
        return this.nests[eagle].clone().add(this.cliff.position);
    }

    private place(e: EagleState, p: THREE.Vector3) {
        e.root.position.copy(p);
    }

    /* ---------- host API */

    setSize(w: number, h: number) {
        this.width = Math.max(1, w);
        this.height = Math.max(1, h);
        this.renderer.setSize(this.width, this.height, false);
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.layout();
    }

    /** Vita not connected: the eagles sleep in their nests. */
    setAwake(awake: boolean) {
        this.awake = awake;
    }

    /** Where each eagle should be and what each station shows. An eagle whose station changes takes off. */
    update(eagles: EagleOrder[], stations: StationState[]) {
        this.stationStates = stations;
        eagles.forEach((o, i) => {
            const e = this.eagles[i];
            if (!e) return;
            e.mood = o.mood;
            const target = o.station !== null && o.station < this.stationCount ? o.station : null;
            const heading = e.flight ? e.flight.toStation : e.station;
            if (target !== heading) this.fly(i, target);
        });
    }

    private fly(i: number, to: number | null) {
        const e = this.eagles[i];
        const from = e.root.position.clone();
        const dest = this.spot(to, i);
        const dir = new THREE.Vector3().subVectors(dest, from).setY(0);
        const len = dir.length();
        dir.normalize();
        // up out of the nest, swing out toward the viewer, then glide down onto the pad
        const c1 = from.clone().add(new THREE.Vector3(0, 1.8, 1.6)).addScaledVector(dir, len * 0.22);
        const c2 = dest.clone().add(new THREE.Vector3(0, 2.1, 2.4)).addScaledVector(dir, -len * 0.25);
        const curve = new THREE.CubicBezierCurve3(from, c1, c2, dest);
        const dur = THREE.MathUtils.clamp(curve.getLength() / 4.6, 2.2, 4.0);
        // a short wave ("on it!") before take-off; eagles leave one after another
        e.flight = { curve, t0: this.clock.elapsedTime + 0.8 + i * 0.3, dur, toStation: to, leftward: dest.x < from.x };
        e.station = to;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.clock.getDelta();
        const tick = () => {
            if (!this.running) return;
            this.frame();
            this.raf = requestAnimationFrame(tick);
        };
        this.raf = requestAnimationFrame(tick);
    }

    stop() {
        this.running = false;
        cancelAnimationFrame(this.raf);
    }

    dispose() {
        this.stop();
        this.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.geometry) m.geometry.dispose();
            const mat = m.material as THREE.Material | THREE.Material[] | undefined;
            if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
            else mat?.dispose();
        });
        (this.scene.background as THREE.Texture | null)?.dispose();
        this.poses.forEach((p) => { p.tex.dispose(); p.flip.dispose(); });
        this.renderer.dispose();
    }

    /* ---------- animation */

    private frame() {
        const dt = Math.min(0.05, this.clock.getDelta());
        const t = this.clock.elapsedTime;

        // a slow drift of the camera gives the scene depth without distracting
        this.cameraSway += dt;
        this.camera.position.set(CAM.x + Math.sin(this.cameraSway * 0.12) * 0.5, CAM.y + Math.sin(this.cameraSway * 0.09) * 0.15, CAM.z);
        this.camera.lookAt(LOOK);

        this.clouds.forEach((c, i) => {
            c.position.x += dt * (0.25 + i * 0.08);
            if (c.position.x > 30) c.position.x = -30;
        });

        this.stations.forEach((s, i) => {
            const st = this.stationStates[i] ?? null;
            const key = !st ? 'idle' : st.phase === 'done' ? (st.verdict === 'green' ? 'green' : st.verdict === 'red' ? 'red' : 'neutral') : st.phase;
            const col = RING[key as keyof typeof RING];
            const mat = s.ring.material as THREE.MeshStandardMaterial;
            mat.color.setHex(col);
            mat.emissive.setHex(col);
            const pulse = key === 'running' ? 0.6 + 0.4 * Math.sin(t * 5) : key === 'queued' ? 0.45 + 0.2 * Math.sin(t * 2) : key === 'idle' ? 0.15 : 0.8;
            mat.emissiveIntensity = pulse;
            s.glow.color.setHex(col);
            s.glow.intensity = key === 'idle' ? 0 : 1.2 * pulse;
        });

        const info: FrameInfo = { stations: [], eagles: [], deck: { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } } };
        this.eagles.forEach((e, i) => this.animateEagle(e, i, dt, t));

        for (let i = 0; i < this.stationCount; i++) info.stations.push(this.toScreen(new THREE.Vector3(this.stations[i].group.position.x, DECK_Y - 0.5, 2.0)));
        this.eagles.forEach((e) => {
            const head = e.root.position.clone();
            head.y += e.a.scale.y * 0.97 + 0.05;
            info.eagles.push({ ...this.toScreen(head), flying: !!e.flight && this.clock.elapsedTime >= e.flight.t0 });
        });
        info.deck.left = this.toScreen(new THREE.Vector3(this.deckLeft + 0.2, DECK_Y - 0.25, 1.95));
        info.deck.right = this.toScreen(new THREE.Vector3(this.deckRight, DECK_Y + 0.05, -0.7));

        this.renderer.render(this.scene, this.camera);
        this.onFrame(info);
    }

    private toScreen(v: THREE.Vector3): ScreenPoint {
        const p = v.clone().project(this.camera);
        return { x: (p.x * 0.5 + 0.5) * this.width, y: (-p.y * 0.5 + 0.5) * this.height };
    }

    private setPose(e: EagleState, pose: VitaPose, flipped: boolean) {
        if (e.pose === pose && e.flipped === flipped) return;
        const p = this.poses.get(pose);
        if (!p) return;
        const am = e.a.material, bm = e.b.material;
        if (e.pose !== null && e.pose !== pose) {
            // keep the old pose on the second sprite and fade it out
            bm.map = am.map;
            bm.rotation = am.rotation;
            e.b.scale.copy(e.a.scale);
            e.b.visible = true;
            bm.needsUpdate = true;
            e.fade = 0;
        }
        am.map = flipped ? p.flip : p.tex;
        am.needsUpdate = true;
        e.pose = pose;
        e.flipped = flipped;
    }

    private homePoseOf(e: EagleState, i: number, t: number, dt: number): VitaPose {
        if (!this.awake) return 'sleeping';
        if (t < e.greetUntil) return 'welcome';
        e.homeTimer -= dt;
        if (e.homeTimer <= 0) {
            // move on to something the other eagles at home are not doing
            const taken = new Set(this.eagles.filter((x, k) => k !== i && x.station === null).map((x) => x.homePose));
            const start = HOME_POSES.indexOf(e.homePose);
            for (let k = 1; k <= HOME_POSES.length; k++) {
                const next = HOME_POSES[(start + k) % HOME_POSES.length];
                if (!taken.has(next)) { e.homePose = next; break; }
            }
            e.homeTimer = 28 + ((i * 11 + Math.floor(t)) % 4) * 6;
        }
        return e.homePose;
    }

    private animateEagle(e: EagleState, i: number, dt: number, t: number) {
        const am = e.a.material;
        let bob = 0, sway = 0, squash = 1, tilt = 0, shadow = 0.9, shake = 0;
        const flight = e.flight;

        if (flight && t >= flight.t0) {
            const u = clamp01((t - flight.t0) / flight.dur);
            const s = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;   // ease in-out along the path
            const pos = flight.curve.getPoint(s);
            const tan = flight.curve.getTangent(Math.min(0.999, Math.max(0.001, s)));
            e.root.position.copy(pos);
            this.setPose(e, 'flying', flight.leftward);
            // wing-beats: a quick vertical bob and stretch while climbing, a steady glide on the way down
            const beating = u < 0.55 || u > 0.9;
            const beat = Math.sin(t * (beating ? 11 : 3));
            bob = beat * (beating ? 0.07 : 0.025);
            squash = 1 + beat * (beating ? 0.045 : 0.012);
            const horiz = Math.hypot(tan.x, tan.z) || 1e-3;
            tilt = THREE.MathUtils.clamp(Math.atan2(tan.y, horiz) * 0.45, -0.3, 0.3) * (flight.leftward ? -1 : 1);
            shadow = 0;
            if (u >= 1) {
                e.flight = null;
                e.landedAt = t;
            }
        } else if (flight) {
            // called: a quick wave from where it is, then off
            this.setPose(e, 'welcome', false);
            bob = Math.abs(Math.sin(t * 7)) * 0.05;
        } else if (e.station === null) {
            const pose = this.homePoseOf(e, i, t, dt);
            this.setPose(e, pose, false);
            squash = 1 + Math.sin(t * (pose === 'sleeping' ? 1.2 : 2) + i) * (pose === 'sleeping' ? 0.02 : 0.012);
            if (pose === 'welcome') sway = Math.sin(t * 4) * 0.04;
        } else {
            const pose = poseForMood(e.mood);
            this.setPose(e, pose, false);
            const since = t - e.landedAt;
            if (pose === 'working') bob = Math.max(0, Math.sin(t * 5 + i)) * 0.025;
            else if (pose === 'thinking') sway = Math.sin(t * 1.3 + i) * 0.05;
            else if (pose === 'joyful') bob = since < 6 ? Math.abs(Math.sin(t * 6)) * 0.16 : Math.abs(Math.sin(t * 3)) * 0.04;
            else if (pose === 'angry') shake = (Math.sin(t * 2.2) > 0.75 ? Math.sin(t * 40) * 0.025 : 0);
            squash = 1 + Math.sin(t * 2 + i) * 0.01;
        }

        // size from the artwork, so every pose keeps the same scale
        const p = e.pose ? this.poses.get(e.pose) : undefined;
        if (p) e.a.scale.set(p.w * PX, p.h * PX * squash, 1);
        e.a.position.set(shake, bob, 0);
        am.rotation = damp(am.rotation, tilt + sway, 10, dt);

        if (e.fade < 1) {
            e.fade = Math.min(1, e.fade + dt / FADE_S);
            const k = smooth(e.fade);
            am.opacity = k;
            e.b.material.opacity = 1 - k;
            e.b.position.copy(e.a.position);
            if (e.fade >= 1) e.b.visible = false;
        } else {
            am.opacity = 1;
        }

        const sm = e.shadow.material as THREE.MeshBasicMaterial;
        sm.opacity = damp(sm.opacity, shadow, 8, dt);
        e.shadow.visible = sm.opacity > 0.02;
        if (p) e.shadow.scale.set(Math.min(1.2, p.w * PX * 0.75), 1, 1);
    }
}
