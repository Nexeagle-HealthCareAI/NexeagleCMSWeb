import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { EagleMood } from './aerieJobs';
import { buildWorld, NEST_COUNT, type World } from './aerieWorld';
import { HOME_POSES, poseForMood, type VitaPose } from './vitaPoses';

/**
 * The Vita campus scene (three.js, no React): the world from aerieWorld.ts, five eagles drawn from the Vita artwork,
 * and a camera that looks down on the campus at an angle and can be turned by dragging (zoom and reset come from the
 * host's buttons, so the page still scrolls with the mouse wheel).
 *
 * Eagles: an eagle given a job flies to its desk (a wave first: "on it!"), works or thinks there, shows joy or anger
 * at the verdict, then flies home to its nest. An eagle with no job spends its free time on the campus — a lounger by
 * the pool, the café, the trampoline — and goes back to its nest in between. When Vita is offline everyone sleeps at
 * home. The host gets, every frame, where desks, eagles and zone labels are on screen, for its HTML labels.
 */

export const SCENE_EAGLES = NEST_COUNT;    // one eagle per nest
export const SCENE_STATIONS = 8;           // desks in the office

export type StationState = { phase: 'queued' | 'running' | 'done'; verdict?: string | null } | null;
export type EagleOrder = { station: number | null; mood: EagleMood };
export type ScreenPoint = { x: number; y: number };
export type FrameInfo = {
    stations: ScreenPoint[];
    eagles: (ScreenPoint & { flying: boolean })[];
    zones: (ScreenPoint & { label: string })[];
    office: ScreenPoint;
};

type Place = { kind: 'nest' | 'desk' | 'spot'; i: number };
type Flight = { curve: THREE.CubicBezierCurve3; t0: number; dur: number; to: Place; leftward: boolean };
type PoseTex = { tex: THREE.Texture; flip: THREE.Texture; w: number; h: number };
type EagleState = {
    root: THREE.Group;
    a: THREE.Sprite;
    b: THREE.Sprite;
    shadow: THREE.Mesh;
    pose: VitaPose | null;
    flipped: boolean;
    fade: number;
    place: Place;                 // where it is, or where it is flying to
    flight: Flight | null;
    mood: EagleMood;
    working: boolean;             // has a desk job
    leisureTimer: number;
    homePose: VitaPose;
    homeTimer: number;
    greetUntil: number;
    landedAt: number;
};

const FOV = 32;
const PX = 2.0 / 235;              // world units per artwork pixel (every pose shares the sheet's scale)
const FADE_S = 0.28;
const GREET_S = 3.2;
const POLAR = 1.16;                // default camera: ~24° above the horizon, sky and mountains in view
const STATUS = { idle: 0x94a3b8, queued: 0xa78bfa, running: 0x38bdf8, green: 0x22c55e, red: 0xef4444, neutral: 0xf59e0b };

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const damp = (a: number, b: number, k: number, dt: number) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-k * dt));

const softShadow = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    if (ctx) {
        const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
        g.addColorStop(0, 'rgba(15,23,42,0.5)');
        g.addColorStop(1, 'rgba(15,23,42,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(c);
};

const spriteOf = () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, fog: false, depthWrite: false, alphaTest: 0.02 }));
    s.center.set(0.5, 0.03);       // anchored at the feet
    s.renderOrder = 10;
    return s;
};

export class AerieScene {
    private renderer: THREE.WebGLRenderer;
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(FOV, 3, 0.1, 400);
    private controls: OrbitControls;
    private clock = new THREE.Clock();
    private raf = 0;
    private running = false;
    private width = 1;
    private height = 1;
    private world: World;
    private poses = new Map<VitaPose, PoseTex>();
    private eagles: EagleState[] = [];
    private stationStates: StationState[] = [];
    private awake = true;
    private fitDistance = 30;
    private onFrame: (f: FrameInfo) => void;
    private shadowTex: THREE.Texture;

    constructor(canvas: HTMLCanvasElement, poseUrls: Record<VitaPose, string>, onFrame: (f: FrameInfo) => void) {
        this.onFrame = onFrame;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
        this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene.add(new THREE.HemisphereLight(0xe6f1ff, 0x5b6b5a, 1.2));
        const sun = new THREE.DirectionalLight(0xfff1d6, 2.3);
        sun.position.set(-10, 22, 14);
        sun.target.position.set(3, 0, 0);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 20, bottom: -20, near: 1, far: 70 });
        sun.shadow.bias = -0.0006;
        sun.shadow.normalBias = 0.03;
        this.scene.add(sun, sun.target);

        this.world = buildWorld(this.scene);

        const loader = new THREE.TextureLoader();
        (Object.keys(poseUrls) as VitaPose[]).forEach((k) => {
            const entry: PoseTex = { tex: new THREE.Texture(), flip: new THREE.Texture(), w: 230, h: 230 };
            entry.tex = loader.load(poseUrls[k], (t) => {
                const img = t.image as { width: number; height: number };
                entry.w = img.width;
                entry.h = img.height;
                const f = t.clone();          // mirrored copy: flying the other way
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

        this.shadowTex = softShadow();
        for (let e = 0; e < SCENE_EAGLES; e++) {
            const root = new THREE.Group();
            const a = spriteOf(), b = spriteOf();
            b.visible = false;
            root.add(a, b);
            const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.55), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, opacity: 0.9 }));
            shadow.rotation.x = -Math.PI / 2;
            shadow.position.y = 0.03;
            root.add(shadow);
            root.position.copy(this.world.nests[e]);
            this.scene.add(root);
            this.eagles.push({
                root, a, b, shadow, pose: null, flipped: false, fade: 1, place: { kind: 'nest', i: e }, flight: null,
                mood: 'home', working: false, leisureTimer: 5 + e * 6, homePose: HOME_POSES[e % HOME_POSES.length],
                homeTimer: 26 + e * 9, greetUntil: e === 0 ? GREET_S : 0, landedAt: 0,
            });
        }

        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.target.copy(this.world.center);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enablePan = false;
        this.controls.enableZoom = false;           // the page keeps the wheel; zoom is on the host's buttons
        this.controls.rotateSpeed = 0.5;
        this.controls.minPolarAngle = 0.55;
        this.controls.maxPolarAngle = 1.36;
        this.controls.minAzimuthAngle = -0.75;
        this.controls.maxAzimuthAngle = 0.75;
    }

    /* ---------- camera */

    /** Distance at which the campus fits the view from the current direction (the target is re-centred on it). */
    private fit(): number {
        const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
        if (!Number.isFinite(dir.x) || dir.lengthSq() < 0.5) dir.setFromSphericalCoords(1, POLAR, 0);
        const pts = this.world.fitPoints;
        const place = (d: number) => {
            this.camera.position.copy(this.controls.target).addScaledVector(dir, d);
            this.camera.lookAt(this.controls.target);
            this.camera.updateMatrixWorld();
        };
        const ndc = () => pts.map((c) => c.clone().project(this.camera));
        const distance = () => {
            let lo = 4, hi = 200;
            for (let k = 0; k < 28; k++) {
                const mid = (lo + hi) / 2;
                place(mid);
                const ok = ndc().every((p) => Math.abs(p.x) <= 0.96 && Math.abs(p.y) <= 0.9 && p.z < 1);
                if (ok) hi = mid; else lo = mid;
            }
            place(hi);
            return hi;
        };
        let d = distance();
        // centre the campus in the frame: move the target by the off-centre amount, then fit again
        for (let pass = 0; pass < 3; pass++) {
            const ps = ndc();
            const cx = (Math.min(...ps.map((p) => p.x)) + Math.max(...ps.map((p) => p.x))) / 2;
            const cy = (Math.min(...ps.map((p) => p.y)) + Math.max(...ps.map((p) => p.y))) / 2;
            const halfH = d * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
            const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
            const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
            this.controls.target.addScaledVector(right, cx * halfH * this.camera.aspect).addScaledVector(up, cy * halfH);
            d = distance();
        }
        return d;
    }

    /** Back to the default angle, whole campus in view. */
    resetView() {
        this.controls.target.copy(this.world.center);
        this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSphericalCoords(1, POLAR, 0));
        this.fitDistance = this.fit();
        this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSphericalCoords(this.fitDistance, POLAR, 0));
        this.controls.minDistance = this.fitDistance * 0.35;
        this.controls.maxDistance = this.fitDistance * 1.2;
        this.controls.update();
    }

    /** Zoom in (f < 1) or out (f > 1), within limits. */
    zoomBy(f: number) {
        const off = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
        const d = THREE.MathUtils.clamp(off.length() * f, this.controls.minDistance, this.controls.maxDistance);
        this.camera.position.copy(this.controls.target).addScaledVector(off.normalize(), d);
        this.controls.update();
    }

    setSize(w: number, h: number) {
        const first = this.width === 1;
        this.width = Math.max(1, w);
        this.height = Math.max(1, h);
        this.renderer.setSize(this.width, this.height, false);
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        if (first) {
            this.resetView();
        } else {
            this.controls.target.copy(this.world.center);
            // keep the user's angle and zoom ratio, refit to the new shape
            const off = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
            const ratio = off.length() / this.fitDistance;
            this.fitDistance = this.fit();
            this.controls.minDistance = this.fitDistance * 0.35;
            this.controls.maxDistance = this.fitDistance * 1.2;
            this.camera.position.copy(this.controls.target).addScaledVector(off.normalize(), this.fitDistance * ratio);
            this.controls.update();
        }
    }

    /* ---------- host API */

    setAwake(awake: boolean) {
        this.awake = awake;
    }

    update(orders: EagleOrder[], stations: StationState[]) {
        this.stationStates = stations;
        orders.forEach((o, i) => {
            const e = this.eagles[i];
            if (!e) return;
            e.mood = o.mood;
            const desk = o.station !== null && o.station < this.world.desks.length ? o.station : null;
            e.working = desk !== null;
            if (desk !== null) {
                if (!(e.place.kind === 'desk' && e.place.i === desk)) this.fly(i, { kind: 'desk', i: desk });
            } else if (e.place.kind === 'desk') {
                this.fly(i, { kind: 'nest', i });
                e.leisureTimer = 20 + Math.random() * 20;
            }
        });
    }

    private spot(p: Place): THREE.Vector3 {
        if (p.kind === 'desk') return this.world.desks[p.i].spot.clone();
        if (p.kind === 'spot') return this.world.leisure[p.i].pos.clone();
        return this.world.nests[p.i].clone();
    }

    private fly(i: number, to: Place) {
        const e = this.eagles[i];
        const from = e.root.position.clone();
        const dest = this.spot(to);
        const dir = new THREE.Vector3().subVectors(dest, from).setY(0);
        const len = dir.length();
        dir.normalize();
        // up and out toward the viewer, then a glide down onto the target
        const lift = 2.4 + len * 0.08;
        const c1 = from.clone().add(new THREE.Vector3(0, lift, 1.4)).addScaledVector(dir, len * 0.25);
        const c2 = dest.clone().add(new THREE.Vector3(0, lift + 0.4, 1.8)).addScaledVector(dir, -len * 0.25);
        const curve = new THREE.CubicBezierCurve3(from, c1, c2, dest);
        const dur = THREE.MathUtils.clamp(curve.getLength() / 5.5, 2.0, 4.6);
        const a = from.clone().project(this.camera).x, b = dest.clone().project(this.camera).x;
        // called to work: wave first; leisure trips leave without ceremony
        const wait = to.kind === 'desk' ? 0.8 + i * 0.25 : 0.1;
        e.flight = { curve, t0: this.clock.elapsedTime + wait, dur, to, leftward: b < a };
        e.place = to;
    }

    /** Free time: hop between the nest and the campus's leisure spots. */
    private leisure(e: EagleState, i: number, dt: number) {
        if (e.working || e.flight) return;
        if (!this.awake) {
            if (e.place.kind !== 'nest') this.fly(i, { kind: 'nest', i });
            return;
        }
        e.leisureTimer -= dt;
        if (e.leisureTimer > 0) return;
        if (e.place.kind === 'spot') {
            this.fly(i, { kind: 'nest', i });
            e.leisureTimer = 18 + Math.random() * 25;
            return;
        }
        const taken = new Set(this.eagles.filter((x) => x.place.kind === 'spot').map((x) => x.place.i));
        const free = this.world.leisure.map((_, k) => k).filter((k) => !taken.has(k));
        if (free.length && Math.random() < 0.75) {
            this.fly(i, { kind: 'spot', i: free[Math.floor(Math.random() * free.length)] });
            e.leisureTimer = 16 + Math.random() * 16;
        } else {
            e.leisureTimer = 10 + Math.random() * 15;
        }
    }

    /* ---------- loop */

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
        this.controls.dispose();
        this.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.geometry) m.geometry.dispose();
            const mat = m.material as THREE.Material | THREE.Material[] | undefined;
            if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
            else mat?.dispose();
        });
        this.world.dispose();
        this.shadowTex.dispose();
        this.poses.forEach((p) => { p.tex.dispose(); p.flip.dispose(); });
        this.renderer.dispose();
    }

    private frame() {
        const raw = this.clock.getDelta();          // real time: drives the free-time timers
        const dt = Math.min(0.05, raw);             // capped: drives smoothing, so a slow frame doesn't jump
        const t = this.clock.elapsedTime;
        this.controls.update();
        this.world.animate(t, dt);

        this.world.desks.forEach((d, i) => {
            const st = this.stationStates[i] ?? null;
            const key = !st ? 'idle' : st.phase === 'done' ? (st.verdict === 'green' ? 'green' : st.verdict === 'red' ? 'red' : 'neutral') : st.phase;
            const col = STATUS[key as keyof typeof STATUS];
            const pulse = key === 'running' ? 0.65 + 0.35 * Math.sin(t * 5) : key === 'queued' ? 0.5 + 0.2 * Math.sin(t * 2) : key === 'idle' ? 0.12 : 0.85;
            d.ring.color.setHex(col);
            d.ring.emissive.setHex(col);
            d.ring.emissiveIntensity = pulse;
            d.screen.emissive.setHex(key === 'idle' ? 0x1e293b : col);
            d.screen.emissiveIntensity = key === 'idle' ? 0.5 : 0.35 + 0.45 * pulse;
        });

        this.eagles.forEach((e, i) => {
            this.leisure(e, i, Math.min(raw, 1));
            this.animateEagle(e, i, dt, t, Math.min(raw, 1));
        });

        const info: FrameInfo = {
            stations: this.world.desks.map((d) => this.toScreen(d.card)),
            eagles: this.eagles.map((e) => {
                const head = e.root.position.clone();
                head.y += e.a.scale.y * 0.97 + 0.08;
                return { ...this.toScreen(head), flying: !!e.flight && t >= e.flight.t0 };
            }),
            zones: this.world.zones.map((z) => ({ ...this.toScreen(z.at), label: z.label })),
            office: this.toScreen(this.world.zones[1].at),
        };
        this.renderer.render(this.scene, this.camera);
        this.onFrame(info);
    }

    private toScreen(v: THREE.Vector3): ScreenPoint {
        const p = v.clone().project(this.camera);
        return { x: (p.x * 0.5 + 0.5) * this.width, y: (-p.y * 0.5 + 0.5) * this.height };
    }

    /* ---------- eagles */

    private setPose(e: EagleState, pose: VitaPose, flipped: boolean) {
        if (e.pose === pose && e.flipped === flipped) return;
        const p = this.poses.get(pose);
        if (!p) return;
        const am = e.a.material, bm = e.b.material;
        if (e.pose !== null && e.pose !== pose) {
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

    private nestPose(e: EagleState, i: number, t: number, dt: number): VitaPose {
        if (!this.awake) return 'sleeping';
        if (t < e.greetUntil) return 'welcome';
        e.homeTimer -= dt;
        if (e.homeTimer <= 0) {
            const taken = new Set(this.eagles.filter((x, k) => k !== i && x.place.kind === 'nest').map((x) => x.homePose));
            const start = HOME_POSES.indexOf(e.homePose);
            for (let k = 1; k <= HOME_POSES.length; k++) {
                const next = HOME_POSES[(start + k) % HOME_POSES.length];
                if (!taken.has(next)) { e.homePose = next; break; }
            }
            e.homeTimer = 28 + ((i * 11 + Math.floor(t)) % 4) * 6;
        }
        return e.homePose;
    }

    private animateEagle(e: EagleState, i: number, dt: number, t: number, realDt: number) {
        const am = e.a.material;
        let bob = 0, sway = 0, squash = 1, tilt = 0, shadow = 0.9, shake = 0;
        const flight = e.flight;
        let overScenery = e.place.kind === 'nest';      // never hidden behind the cliff's rocks

        if (flight && t >= flight.t0) {
            const u = clamp01((t - flight.t0) / flight.dur);
            const s = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
            const pos = flight.curve.getPoint(s);
            const tan = flight.curve.getTangent(Math.min(0.999, Math.max(0.001, s)));
            e.root.position.copy(pos);
            this.setPose(e, 'flying', flight.leftward);
            const beating = u < 0.55 || u > 0.9;
            const beat = Math.sin(t * (beating ? 11 : 3));
            bob = beat * (beating ? 0.08 : 0.03);
            squash = 1 + beat * (beating ? 0.045 : 0.012);
            const horiz = Math.hypot(tan.x, tan.z) || 1e-3;
            tilt = THREE.MathUtils.clamp(Math.atan2(tan.y, horiz) * 0.4, -0.3, 0.3) * (flight.leftward ? -1 : 1);
            shadow = 0;
            overScenery = true;
            if (u >= 1) {
                e.flight = null;
                e.landedAt = t;
            }
        } else if (flight) {
            if (flight.to.kind === 'desk') {
                this.setPose(e, 'welcome', false);
                bob = Math.abs(Math.sin(t * 7)) * 0.05;
            }
        } else if (e.place.kind === 'nest') {
            const pose = this.nestPose(e, i, t, realDt);
            this.setPose(e, pose, false);
            squash = 1 + Math.sin(t * (pose === 'sleeping' ? 1.2 : 2) + i) * (pose === 'sleeping' ? 0.02 : 0.012);
            if (pose === 'welcome') sway = Math.sin(t * 4) * 0.04;
        } else if (e.place.kind === 'spot') {
            const sp = this.world.leisure[e.place.i];
            this.setPose(e, sp.pose, false);
            if (sp.bounce) {
                bob = Math.abs(Math.sin(t * 3.2 + i)) * 0.55;
                shadow = 0.9 - bob;
            } else {
                squash = 1 + Math.sin(t * 2 + i) * 0.012;
                if (sp.pose === 'eating') bob = Math.max(0, Math.sin(t * 4 + i)) * 0.02;
            }
        } else {
            const pose = poseForMood(e.mood);
            this.setPose(e, pose, false);
            const since = t - e.landedAt;
            if (pose === 'working') bob = Math.max(0, Math.sin(t * 5 + i)) * 0.025;
            else if (pose === 'thinking') sway = Math.sin(t * 1.3 + i) * 0.05;
            else if (pose === 'joyful') bob = since < 6 ? Math.abs(Math.sin(t * 6)) * 0.18 : Math.abs(Math.sin(t * 3)) * 0.04;
            else if (pose === 'angry') shake = Math.sin(t * 2.2) > 0.75 ? Math.sin(t * 40) * 0.025 : 0;
            squash = 1 + Math.sin(t * 2 + i) * 0.01;
        }

        const p = e.pose ? this.poses.get(e.pose) : undefined;
        if (p) e.a.scale.set(p.w * PX, p.h * PX * squash, 1);
        e.a.position.set(shake, bob, 0);
        am.rotation = damp(am.rotation, tilt + sway, 10, dt);
        am.depthTest = !overScenery;
        e.b.material.depthTest = !overScenery;

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
        sm.opacity = damp(sm.opacity, Math.max(0, shadow), 8, dt);
        e.shadow.visible = sm.opacity > 0.02;
        if (p) e.shadow.scale.set(Math.min(1.2, p.w * PX * 0.75), 1, 1);
    }
}
