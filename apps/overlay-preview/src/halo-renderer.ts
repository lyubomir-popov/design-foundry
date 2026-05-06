/**
 * halo-renderer.ts — Three.js renderer for the halo field animation.
 * Faithful port of the rendering pipeline from racoon-anim rendering.js.
 *
 * Creates a WebGLRenderer with an orthographic camera, instanced circle/segment
 * layers, and renders: background spokes → dots → thin spokes → thick spokes →
 * echo markers.
 */
import * as THREE from "three";
import { createCircleLayer, createSegmentLayer, type CircleLayer, type SegmentLayer } from "./three-primitives.js";
import type { UbuntuSummitAnimationSceneDescriptor } from "@brand-layout-ops/operator-ubuntu-summit-animation";
import {
  type HaloFieldConfig,
  type IntroFieldState,
  type PostFinaleFieldState,
  type MascotBox,
  type Spoke,
  type RuntimePoint,
  type RuntimeTiming,
  type EchoMarkerVariant,
  TAU,
  clamp,
  lerp,
  smoothstep,
  wrapPositive,
  getEchoMarkerVariant,
  buildIntroHaloFieldState,
  buildRuntimePoints,
  UBUNTU_RELEASE_LABELS
} from "@brand-layout-ops/operator-halo-field";

// ─── Constants ────────────────────────────────────────────────────────

const BACKGROUND_SPOKE_WIDTH_PX = 1;
const BACKGROUND_SPOKE_FADE_SEGMENTS = 16;
const ECHO_PLUS_SIZE_PX = 8;
const ECHO_TEXT_BASE_FONT_SIZE_PX = 18;
const TEXT_LABEL_FONT_FAMILY = '"Ubuntu Sans", "Ubuntu", sans-serif';
const TEXT_LABEL_MARGIN_PX = 16;
const MASCOT_FACE_ASSET_PATH = "/assets/racoon-mascot-face.svg";
const MASCOT_HALO_ASSET_PATH = "/assets/racoon-mascot-halo.svg";
const MASCOT_REFERENCE_HALO_OPACITY = 0.3;
const MASCOT_VIEWBOX_SIZE = 600;
const MASCOT_EYE_SPECS = [
  { cx: 260, cy: 290.25, radius: 8 },
  { cx: 340, cy: 290.25, radius: 8 }
] as const;
const MASCOT_NOSE_PATH = new Path2D(
  "M314.719,325.951c1.206.283,1.861,1.609,1.362,2.749-3.479,7.962-8.503,15.086-14.69,20.992-.78.744-2.004.744-2.784,0-6.186-5.905-11.211-13.029-14.69-20.992-.498-1.14.156-2.466,1.362-2.749,4.728-1.111,9.655-1.701,14.719-1.701s9.991.59,14.719,1.701Z"
);

const LAYER_ORDER = {
  backgroundSpokes: 1,
  points: 5,
  haloThinSpokes: 10,
  haloThickSpokes: 11,
  haloEchoDots: 15,
  haloEchoMarks: 16
};

const LAYER_CAPACITIES = {
  backgroundSpokes: 2048,
  points: 8192,
  haloThinSpokes: 512,
  haloThickSpokes: 512,
  haloEchoDots: 8192,
  haloEchoMarks: 8192
};

// ─── renderer interface ───────────────────────────────────────────────

export interface HaloRendererConfig {
  canvas: HTMLCanvasElement;
  textOverlayCanvas: HTMLCanvasElement;
  widthPx: number;
  heightPx: number;
}

export interface HaloRendererLayers {
  backgroundSpokes: SegmentLayer;
  points: CircleLayer;
  haloThinSpokes: SegmentLayer;
  haloThickSpokes: SegmentLayer;
  haloEchoDots: CircleLayer;
  haloEchoMarks: SegmentLayer;
}

export interface HaloRenderer {
  /** Resize stage to the given pixel dimensions. */
  resize(widthPx: number, heightPx: number): void;
  /** Clear the WebGL and text overlay canvases without drawing a halo frame. */
  clearFrame(): void;
  /** Render one frame with the current field config. */
  renderFrame(sceneDescriptor: UbuntuSummitAnimationSceneDescriptor, transparentBackground?: boolean): void;
  /** Dispose all GPU resources. */
  dispose(): void;
  /** Access to the canvas element. */
  canvas: HTMLCanvasElement;
  /** Access to the text overlay canvas. */
  textOverlayCanvas: HTMLCanvasElement;
}

// ─── Create renderer ──────────────────────────────────────────────────

export function createHaloRenderer(opts: HaloRendererConfig): HaloRenderer {
  const { canvas, textOverlayCanvas } = opts;
  let stageW = opts.widthPx;
  let stageH = opts.heightPx;
  const debugTriangleEnabled = new URLSearchParams(window.location.search).get("debugThree") === "triangle";

  // Three.js setup — orthographic camera in pixel space
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(stageW, stageH, false);
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = true;
  (renderer as unknown as Record<string, boolean>).sortObjects = false;

  const camera = new THREE.OrthographicCamera(0, stageW, stageH, 0, -100, 100);
  camera.position.set(0, 0, 10);

  const scene = new THREE.Scene();
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let debugTriangleMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null = null;
  if (debugTriangleEnabled) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([
        stageW * 0.18, stageH * 0.82, 0,
        stageW * 0.82, stageH * 0.72, 0,
        stageW * 0.52, stageH * 0.18, 0
      ], 3)
    );
    const material = new THREE.MeshBasicMaterial({
      color: "#2dff87",
      depthTest: false,
      depthWrite: false
    });
    material.toneMapped = false;
    debugTriangleMesh = new THREE.Mesh(geometry, material);
    debugTriangleMesh.frustumCulled = false;
    debugTriangleMesh.renderOrder = 999;
    worldGroup.add(debugTriangleMesh);
  }

  // Instanced layers
  const layers: HaloRendererLayers = {
    backgroundSpokes: createSegmentLayer(LAYER_CAPACITIES.backgroundSpokes, "#333333", LAYER_ORDER.backgroundSpokes),
    points: createCircleLayer(LAYER_CAPACITIES.points, "#ffffff", LAYER_ORDER.points),
    haloThinSpokes: createSegmentLayer(LAYER_CAPACITIES.haloThinSpokes, "#666666", LAYER_ORDER.haloThinSpokes),
    haloThickSpokes: createSegmentLayer(LAYER_CAPACITIES.haloThickSpokes, "#ffffff", LAYER_ORDER.haloThickSpokes),
    haloEchoDots: createCircleLayer(LAYER_CAPACITIES.haloEchoDots, "#444444", LAYER_ORDER.haloEchoDots),
    haloEchoMarks: createSegmentLayer(LAYER_CAPACITIES.haloEchoMarks, "#444444", LAYER_ORDER.haloEchoMarks)
  };

  for (const layer of Object.values(layers)) {
    worldGroup.add(layer.mesh);
  }

  // Text overlay 2D context
  const textCtx = textOverlayCanvas.getContext("2d")!;

  // Scene state — rebuilt when config changes
  let cachedConfigFingerprint = "";
  let introField: IntroFieldState | null = null;
  let runtimePoints: RuntimePoint[] = [];
  let lastSceneDescriptor: UbuntuSummitAnimationSceneDescriptor | null = null;
  let lastTransparentBackground = false;
  let mascotFaceImage: HTMLImageElement | null = null;
  let mascotHaloImage: HTMLImageElement | null = null;
  let mascotAssetsRequested = false;

  function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      image.src = url;
    });
  }

  function ensureMascotAssetsLoaded() {
    if (mascotAssetsRequested) {
      return;
    }

    mascotAssetsRequested = true;
    Promise.all([
      loadImage(MASCOT_FACE_ASSET_PATH),
      loadImage(MASCOT_HALO_ASSET_PATH)
    ])
      .then(([faceImage, haloImage]) => {
        mascotFaceImage = faceImage;
        mascotHaloImage = haloImage;
        if (lastSceneDescriptor) {
          renderFrame(lastSceneDescriptor, lastTransparentBackground);
        }
      })
      .catch(() => {
        mascotFaceImage = null;
        mascotHaloImage = null;
      });
  }

  /** Rebuild intro field + runtime points when config changes. */
  function ensureSceneData(
    config: HaloFieldConfig,
    mascotBox: MascotBox | null,
    runtimeTiming: RuntimeTiming,
    configFingerprint: string
  ) {
    if (configFingerprint !== cachedConfigFingerprint) {
      cachedConfigFingerprint = configFingerprint;
      introField = buildIntroHaloFieldState(config, mascotBox);
      runtimePoints = buildRuntimePoints(config, introField, runtimeTiming);
    }
  }

  // ── helpers ─────────────────────────────────────────────────────────

  function clearLayers() {
    for (const layer of Object.values(layers)) {
      layer.clear();
    }
  }

  function finalizeLayers() {
    for (const layer of Object.values(layers)) {
      layer.finalize();
    }
  }

  function updateLayerColors(config: HaloFieldConfig) {
    layers.backgroundSpokes.setColor(config.spoke_lines.construction_color);
    layers.points.setColor(config.point_style.color);
    layers.haloThinSpokes.setColor(config.spoke_lines.reference_color);
    layers.haloThickSpokes.setColor(config.spoke_lines.color);
    const echoColor = config.spoke_lines.echo_color || config.spoke_lines.color;
    layers.haloEchoDots.setColor(echoColor);
    layers.haloEchoMarks.setColor(echoColor);
  }

  function getGeometryScale(box: MascotBox | null, config: HaloFieldConfig): number {
    if (box) return box.draw_size_px / MASCOT_VIEWBOX_SIZE;
    return Math.max(0.01, config.composition.scale || 1);
  }

  function getRadialFadeAlpha(radius: number, fullR: number, config: HaloFieldConfig): number {
    if (config.vignette?.enabled === false) return 1;
    const strength = clamp(config.vignette?.shape_fade ?? 1, 0, 1);
    if (strength <= 0 || fullR <= 0) return 1;
    const startU = clamp(config.vignette?.shape_fade_start ?? 0.3, 0, 1);
    const endU = clamp(config.vignette?.shape_fade_end ?? 1.0, startU + 0.01, 1);
    const innerR = fullR * startU;
    const outerR = fullR * endU;
    const fadeU = clamp((radius - innerR) / Math.max(1, outerR - innerR), 0, 1);
    return 1 - strength * fadeU;
  }

  // ── background spokes ───────────────────────────────────────────────

  function pushBackgroundSpokes(
    spokes: Spoke[],
    fullFrameR: number,
    config: HaloFieldConfig
  ) {
    const bgWidth = BACKGROUND_SPOKE_WIDTH_PX * getGeometryScale(null, config);
    const cx = config.composition.center_x_px;
    const cy = config.composition.center_y_px;

    for (const spoke of spokes) {
      if (spoke.seam_overlay_only) continue;
      const spokeAlpha = clamp(spoke.alpha ?? 1, 0, 1);
      if (spokeAlpha <= 0) continue;

      const cosA = Math.cos(spoke.angle);
      const sinA = Math.sin(spoke.angle);

      for (let seg = 0; seg < BACKGROUND_SPOKE_FADE_SEGMENTS; seg++) {
        const t0 = seg / BACKGROUND_SPOKE_FADE_SEGMENTS;
        const t1 = (seg + 1) / BACKGROUND_SPOKE_FADE_SEGMENTS;
        const r0 = lerp(spoke.start_radius, fullFrameR, t0);
        const r1 = lerp(spoke.start_radius, fullFrameR, t1);
        const midR = (r0 + r1) * 0.5;
        const fade = getRadialFadeAlpha(midR, fullFrameR, config);
        if (fade <= 0) continue;
        layers.backgroundSpokes.push(
          cx + cosA * r0, cy + sinA * r0,
          cx + cosA * r1, cy + sinA * r1,
          bgWidth,
          spokeAlpha * fade
        );
      }
    }
  }

  // ── dots (intro field — animated spiral) ─────────────────────────────

  function pushAnimatedIntroPoints(
    timeSec: number,
    forceFinal: boolean,
    config: HaloFieldConfig,
    timing: RuntimeTiming
  ) {
    const alphaRampDur = Math.max(0, config.transition_wrangle.alpha_ramp_duration_sec || 0);

    for (const pt of runtimePoints) {
      if (!forceFinal && timeSec < pt.birth_sec) continue;
      if (
        !forceFinal &&
        config.transition_wrangle.hide_invisible_by_pscale &&
        timeSec < pt.visible_sec
      ) continue;

      // Angle: spiral easing from spawn rotation to target
      let angle = pt.target_angle;
      if (!forceFinal) {
        const liveAgeSec = Math.max(0, timeSec - pt.birth_sec);
        const liveAngle = timing.spawn_angle_rad - pt.speed_rad_per_sec * liveAgeSec;

        const capDurSec = Math.max(0.0001, timing.dot_end_sec - pt.capture_start_sec);
        const rawCapU = clamp((timeSec - pt.capture_start_sec) / capDurSec, 0, 1);
        const capU = rawCapU * rawCapU * (3 - 2 * rawCapU); // Hermite smoothstep

        const deltaAngle = wrapPositive(liveAngle - pt.target_angle, TAU);
        angle = liveAngle - deltaAngle * capU;
      }

      const px = pt.center_x_px + Math.cos(angle) * pt.radius;
      const py = pt.center_y_px + Math.sin(angle) * pt.radius;

      // Alpha ramp
      let pointAlpha = config.point_style.alpha;
      if (!forceFinal && alphaRampDur > 0) {
        const alphaStart = Math.max(pt.birth_sec, pt.visible_sec);
        pointAlpha *= smoothstep(alphaStart, alphaStart + alphaRampDur, timeSec);
      }
      if (pointAlpha <= 0) continue;

      // Flash-on-capture: sine bell in last 20% of capture window
      if (!forceFinal) {
        const flashCapDur = Math.max(0.0001, timing.dot_end_sec - pt.capture_start_sec);
        const flashRawU = clamp((timeSec - pt.capture_start_sec) / flashCapDur, 0, 1);
        if (flashRawU >= 0.8) {
          const flashU = (flashRawU - 0.8) / 0.2;
          pointAlpha = Math.min(1, pointAlpha * (1 + 1.8 * Math.sin(flashU * Math.PI)));
        }
      }

      layers.points.push(px, py, pt.radius_px * 2, pt.radius_px * 2, pointAlpha);
    }
  }

  // ── dots (post-finale field) ────────────────────────────────────────

  function pushPostFinalePoints(
    fieldState: PostFinaleFieldState,
    config: HaloFieldConfig
  ) {
    for (const pt of fieldState.points) {
      const alpha = config.point_style.alpha * pt.alpha;
      if (alpha <= 0 || pt.radius_px <= 0) continue;
      layers.points.push(pt.x, pt.y, pt.radius_px * 2, pt.radius_px * 2, alpha);
    }
  }

  // ── finale reveal state ──────────────────────────────────────────────

  type RevealState = NonNullable<UbuntuSummitAnimationSceneDescriptor["frameState"]["reveal"]>;

  /** Soft-edged angle sweep reveal alpha (for echo dots). */
  function getRevealLocalAlpha(
    localX: number, localY: number,
    reveal: RevealState | null,
    spokeCount: number
  ): number {
    if (!reveal) return 1;
    if (reveal.haloU >= 0.999) return 1;
    if (reveal.haloU <= 0) return 0;

    const r = Math.hypot(localX, localY);
    if (r < reveal.innerRadiusPx - 0.01 || r > reveal.outerRadiusPx + 0.01) return 0;

    const pointAngle = Math.atan2(localY, localX);
    const sweepDist = wrapPositive(reveal.startAngleRad - pointAngle, TAU);
    const sweepLimit = TAU * reveal.haloU;
    const softness = TAU * 0.45 / Math.max(1, spokeCount);
    return 1 - smoothstep(sweepLimit, sweepLimit + softness, sweepDist);
  }

  /** Hard-edged angle sweep reveal alpha (for spokes/markers). */
  function getSpokeRevealAlpha(
    localX: number, localY: number,
    reveal: RevealState | null
  ): number {
    if (!reveal) return 1;
    if (reveal.haloU >= 0.999) return 1;
    if (reveal.haloU <= 0) return 0;

    const r = Math.hypot(localX, localY);
    if (r < reveal.innerRadiusPx - 0.01 || r > reveal.outerRadiusPx + 0.01) return 0;

    const pointAngle = Math.atan2(localY, localX);
    const sweepDist = wrapPositive(reveal.startAngleRad - pointAngle, TAU);
    const sweepLimit = TAU * reveal.haloU;
    return sweepDist <= sweepLimit ? 1 : 0;
  }

  // ── ray-circle intersection for thick spokes ────────────────────────

  function getWorldRayCircleSegment(
    oxPx: number, oyPx: number, angle: number,
    ccxPx: number, ccyPx: number, radiusPx: number,
    rayStart: number, rayEnd: number
  ): { start_x: number; start_y: number; end_x: number; end_y: number } | null {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const rcx = ccxPx - oxPx;
    const rcy = ccyPx - oyPx;
    const proj = dx * rcx + dy * rcy;
    const cDistSq = rcx * rcx + rcy * rcy;
    const disc = proj * proj - (cDistSq - radiusPx * radiusPx);
    if (disc <= 0) return null;

    const root = Math.sqrt(disc);
    const entry = proj - root;
    const exit = proj + root;
    const sr = Math.max(rayStart, Math.min(entry, exit));
    const er = Math.min(rayEnd, Math.max(entry, exit));
    if (er <= sr) return null;

    return {
      start_x: oxPx + dx * sr,
      start_y: oyPx + dy * sr,
      end_x: oxPx + dx * er,
      end_y: oyPx + dy * er
    };
  }

  function getThickSpokeWidthPx(spoke: Spoke, geoScale: number, config: HaloFieldConfig): number {
    const startPx = Math.max(0, config.spoke_lines.phase_start_width_px ?? 0);
    const endPx = Math.max(0, config.spoke_lines.phase_end_width_px ?? 0);
    const wpu = clamp(spoke.width_phase_u ?? spoke.phase_u ?? 1, 0, 1);
    return lerp(startPx, endPx, wpu) * geoScale;
  }

  // ── echo marker push helpers ────────────────────────────────────────

  function pushPlusMarker(
    cx: number, cy: number, size: number, strokeW: number, alpha: number, _angle: number
  ) {
    const half = size * 0.5;
    layers.haloEchoMarks.push(cx - half, cy, cx + half, cy, strokeW, alpha);
    layers.haloEchoMarks.push(cx, cy - half, cx, cy + half, strokeW, alpha);
  }

  function pushTriangleMarker(
    cx: number, cy: number, side: number, strokeW: number, alpha: number, angle: number
  ) {
    const r = side / Math.sqrt(3);
    for (let i = 0; i < 3; i++) {
      const a1 = angle + (TAU * i) / 3;
      const a2 = angle + (TAU * (i + 1)) / 3;
      layers.haloEchoMarks.push(
        cx + Math.cos(a1) * r, cy + Math.sin(a1) * r,
        cx + Math.cos(a2) * r, cy + Math.sin(a2) * r,
        strokeW, alpha
      );
    }
  }

  function pushDiamondMarker(
    cx: number, cy: number, size: number, strokeW: number, alpha: number, angle: number
  ) {
    const half = size * 0.5;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const pts = [
      [half, 0], [0, half], [-half, 0], [0, -half]
    ].map(([lx, ly]) => [cx + cos * lx - sin * ly, cy + sin * lx + cos * ly]);
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4];
      layers.haloEchoMarks.push(a[0], a[1], b[0], b[1], strokeW, alpha);
    }
  }

  function pushRadialDashMarker(
    cx: number, cy: number, len: number, strokeW: number, alpha: number, angle: number
  ) {
    const half = len * 0.5;
    const dx = Math.cos(angle) * half;
    const dy = Math.sin(angle) * half;
    layers.haloEchoMarks.push(cx - dx, cy - dy, cx + dx, cy + dy, strokeW, alpha);
  }

  function pushStarMarker(
    cx: number, cy: number, size: number, strokeW: number, alpha: number, _angle: number
  ) {
    const half = size * 0.5;
    for (let i = 0; i < 3; i++) {
      const a = (TAU * i) / 6;
      const cos = Math.cos(a) * half;
      const sin = Math.sin(a) * half;
      layers.haloEchoMarks.push(cx - cos, cy - sin, cx + cos, cy + sin, strokeW, alpha);
    }
  }

  function pushHexagonMarker(
    cx: number, cy: number, size: number, strokeW: number, alpha: number, angle: number
  ) {
    const r = size * 0.5;
    for (let i = 0; i < 6; i++) {
      const a1 = angle + (TAU * i) / 6;
      const a2 = angle + (TAU * (i + 1)) / 6;
      layers.haloEchoMarks.push(
        cx + Math.cos(a1) * r, cy + Math.sin(a1) * r,
        cx + Math.cos(a2) * r, cy + Math.sin(a2) * r,
        strokeW, alpha
      );
    }
  }

  function getEchoMarkerGeometry(
    variant: EchoMarkerVariant,
    dotRadiusPx: number,
    templateRadiusPx: number,
    geoScale: number,
    echoMarkerScaleMult: number,
    echoSparseScaleMult: number
  ): {
    variant: EchoMarkerVariant;
    outerRadiusPx: number;
    sizePx: number;
    triangleSidePx: number;
    dashLengthPx: number;
  } {
    const scaleFactor =
      ECHO_PLUS_SIZE_PX * geoScale *
      clamp(dotRadiusPx / Math.max(0.0001, templateRadiusPx), 0.25, 4) *
      echoMarkerScaleMult * echoSparseScaleMult;
    const triangleSidePx = Math.max(
      6.4 * geoScale,
      dotRadiusPx * 3.2 * echoMarkerScaleMult * echoSparseScaleMult
    );
    const dashLengthPx = scaleFactor * 0.75;

    let outerRadiusPx = dotRadiusPx;
    if (variant === "plus" || variant === "diamond" || variant === "star") {
      outerRadiusPx = scaleFactor * 0.5;
    } else if (variant === "triangles") {
      outerRadiusPx = triangleSidePx / Math.sqrt(3);
    } else if (variant === "radial_dash") {
      outerRadiusPx = dashLengthPx * 0.5;
    } else if (variant === "hexagon") {
      outerRadiusPx = scaleFactor * 1.1 * 0.5;
    }

    return {
      variant,
      outerRadiusPx,
      sizePx: scaleFactor,
      triangleSidePx,
      dashLengthPx
    };
  }

  // ── fold seam alpha (angle-dependent spoke fade at phase boundary) ──

  function getFoldSeamAlpha(angleRad: number, config: HaloFieldConfig): number {
    const baseAngleRad =
      (config.generator_wrangle.base_angle_deg ?? 0) * (Math.PI / 180) +
      (config.composition.global_rotation_deg ?? 0) * (Math.PI / 180);
    const displayU = wrapPositive(angleRad - baseAngleRad, TAU) / TAU;
    const seamDisplayU = 0.5;
    if (displayU <= seamDisplayU) return 1;
    const fadeWidthU = 3.5 / Math.max(1, config.generator_wrangle.spoke_count || 1);
    return smoothstep(0, fadeWidthU, displayU - seamDisplayU);
  }

  // ── halo layers (spokes + echo markers) ─────────────────────────────

  function pushHaloLayers(
    spokes: Spoke[],
    visibleSpokeCount: number,
    box: MascotBox | null,
    haloOuterR: number,
    fullFrameR: number,
    config: HaloFieldConfig,
    baseAlpha: number,
    reveal: RevealState | null = null
  ) {
    if (!box || baseAlpha <= 0) return;

    const cx = config.composition.center_x_px;
    const cy = config.composition.center_y_px;
    const geoScale = getGeometryScale(box, config);
    const outerWidthPx = Math.max(0, config.spoke_lines.width_px || 0) * geoScale;
    const thickEnabled =
      (config.spoke_lines.phase_start_width_px ?? 0) > 0 ||
      (config.spoke_lines.phase_end_width_px ?? 0) > 0;
    const echoCount = Math.max(0, Math.round(config.spoke_lines.echo_count || 0));
    const echoDotScaleMult = clamp(config.spoke_lines.echo_width_mult ?? 1, 0.01, 1);
    const echoWaveCount = Math.max(0, config.spoke_lines.echo_wave_count || 0);
    const echoFadeMult = clamp(config.spoke_lines.echo_opacity_mult ?? 1, 0, 1);
    const echoStyle = config.spoke_lines.echo_style || "dots";
    const echoMarkerScaleMult = Math.max(0.1, config.spoke_lines.echo_marker_scale_mult ?? 1);
    const maxSpokeCount = Math.max(1, config.generator_wrangle.spoke_count || 1);
    const minSpokeCount = clamp(
      config.screensaver?.min_spoke_count ?? maxSpokeCount, 1, maxSpokeCount
    );
    const currentVisCount = clamp(visibleSpokeCount || maxSpokeCount, 1, maxSpokeCount);
    const sparseScaleBoost = Math.max(0, config.spoke_lines.echo_sparse_scale_boost ?? 0);
    const sparseU = maxSpokeCount <= minSpokeCount
      ? 0
      : clamp(
        (maxSpokeCount - currentVisCount) / Math.max(0.0001, maxSpokeCount - minSpokeCount),
        0, 1
      );
    const echoSparseScaleMult = 1 + sparseScaleBoost * sparseU;
    const echoMarkerWidthPx = Math.max(
      0.5 * geoScale,
      Math.max(0, config.spoke_lines.echo_marker_stroke_px ?? config.spoke_lines.width_px ?? 0) * geoScale
    );
    const echoSpacingOffsetPx = Math.max(0, config.spoke_lines.echo_spacing_offset_px ?? 0) * geoScale;
    const minimumContentStartRadius = getSharedContentStartRadius(haloOuterR, config);
    const minimumMarkerStartRadius = minimumContentStartRadius + echoSpacingOffsetPx;
    const rippleMinScale = 0.45;
    const rippleMaxScale = 1.55;
    const rippleFadeStartU = lerp(0.2, 0.85, echoFadeMult);

    for (const spoke of spokes) {
      const foldSeam = getFoldSeamAlpha(spoke.angle, config);
      const spokeAlpha = baseAlpha * clamp(spoke.alpha ?? 1, 0, 1) * foldSeam;
      if (spokeAlpha <= 0) continue;

      // thin spoke line: from start_radius to halo outer
      if (!spoke.seam_overlay_only && outerWidthPx > 0) {
        const worldSx = cx + Math.cos(spoke.angle) * spoke.start_radius;
        const worldSy = cy + Math.sin(spoke.angle) * spoke.start_radius;
        const worldEx = cx + Math.cos(spoke.angle) * haloOuterR;
        const worldEy = cy + Math.sin(spoke.angle) * haloOuterR;
        const midX = (worldSx + worldEx) * 0.5 - cx;
        const midY = (worldSy + worldEy) * 0.5 - cy;
        const revealA = getSpokeRevealAlpha(midX, midY, reveal);
        if (revealA > 0) {
          layers.haloThinSpokes.push(worldSx, worldSy, worldEx, worldEy, outerWidthPx, spokeAlpha * revealA);
        }
      }

      // thick spoke line: clipped by phase mask circle
      if (thickEnabled) {
        const seg = getWorldRayCircleSegment(
          cx, cy, spoke.angle,
          spoke.inner_clip_center_x_px, spoke.inner_clip_center_y_px,
          spoke.phase_clip_radius_px ?? spoke.phase_field_radius_px,
          spoke.start_radius, haloOuterR
        );
        if (seg) {
          const segMidX = (seg.start_x + seg.end_x) * 0.5 - cx;
          const segMidY = (seg.start_y + seg.end_y) * 0.5 - cy;
          const revealA = getSpokeRevealAlpha(segMidX, segMidY, reveal);
          if (revealA > 0) {
            layers.haloThickSpokes.push(
              seg.start_x, seg.start_y, seg.end_x, seg.end_y,
              getThickSpokeWidthPx(spoke, geoScale, config),
              spokeAlpha * revealA
            );
          }
        }
      }

      // echo dots/markers outside the halo
      const dotTemplates = spoke.echo_dots;
      const orbitStep = spoke.echo_dot_step_px;
      if (
        spoke.seam_overlay_only ||
        !dotTemplates.length ||
        orbitStep <= 0 ||
        echoCount <= 0 ||
        spoke.inner_clip_offset_px <= 0
      ) continue;

      const labelBandMetrics = config.spoke_text?.enabled
        ? getSpokeLabelBandMetrics(spoke, haloOuterR, fullFrameR, getTextLabelFontSizePx(config), maxSpokeCount, config)
        : null;

      const maxOrbitIdx = Math.ceil(
        (fullFrameR - spoke.echo_dot_origin_radius) / orbitStep
      );
      const rippleSpan = Math.max(1, fullFrameR - spoke.echo_dot_origin_radius);
      let lastPlacedMarkerCenterR = Number.NEGATIVE_INFINITY;
      let lastPlacedMarkerOuterRadiusPx = 0;

      for (let oi = 0; oi <= maxOrbitIdx; oi++) {
        const tmpl = dotTemplates[Math.min(oi, dotTemplates.length - 1)];
        const dotR = spoke.echo_dot_origin_radius + oi * orbitStep;

        const wdx = cx + Math.cos(spoke.angle) * dotR;
        const wdy = cy + Math.sin(spoke.angle) * dotR;
        const clipDist = Math.hypot(
          wdx - spoke.inner_clip_center_x_px,
          wdy - spoke.inner_clip_center_y_px
        );
        if (clipDist <= spoke.phase_field_radius_px + 0.01) continue;

        const echoIdx = Math.ceil(
          (clipDist - spoke.phase_field_radius_px) / spoke.inner_clip_offset_px
        );
        if (echoIdx < 1 || echoIdx > echoCount) continue;

        const rippleU = clamp(
          (dotR - spoke.echo_dot_origin_radius) / rippleSpan, 0, 1
        );
        const ripplePhase = rippleU * echoWaveCount * TAU;
        const rippleScale = echoWaveCount > 0
          ? lerp(rippleMinScale, rippleMaxScale, 0.5 + 0.5 * Math.cos(ripplePhase))
          : 1;
        const cappedMult = Math.min(
          1, Math.pow(echoDotScaleMult, echoIdx) * rippleScale
        );
        const dotRadiusPx = tmpl.radius_px * cappedMult;
        if (dotRadiusPx <= 0) continue;

        const variant = getEchoMarkerVariant(
          echoStyle,
          spoke.source_spoke_id ?? spoke.display_slot_id,
          oi,
          config.spoke_lines.echo_shape_seed ?? 0,
          config.spoke_lines.echo_mix_shape_pct ?? 0.56
        );
        const markerGeometry = getEchoMarkerGeometry(
          variant,
          dotRadiusPx,
          tmpl.radius_px,
          geoScale,
          echoMarkerScaleMult,
          echoSparseScaleMult
        );

        // Suppress shapes whose actual drawn footprint would enter the text-label clearance zone.
        if (
          labelBandMetrics
          && dotR + markerGeometry.outerRadiusPx >= labelBandMetrics.clearStartR
          && dotR - markerGeometry.outerRadiusPx <= labelBandMetrics.clearEndR
        ) continue;

        const dotAlpha =
          spokeAlpha *
          (1 - smoothstep(rippleFadeStartU, 1, rippleU)) *
          getRadialFadeAlpha(dotR, fullFrameR, config) *
          getRevealLocalAlpha(wdx - cx, wdy - cy, reveal, maxSpokeCount);
        if (dotAlpha <= 0) continue;

        // marker beyond the shared spoke-content clearance?
        if (dotR - markerGeometry.outerRadiusPx <= minimumMarkerStartRadius + 0.01) continue;

        if (Number.isFinite(lastPlacedMarkerCenterR)) {
          const minimumMarkerGapPx =
            lastPlacedMarkerOuterRadiusPx + markerGeometry.outerRadiusPx + echoSpacingOffsetPx;
          if (dotR - lastPlacedMarkerCenterR <= minimumMarkerGapPx - 0.01) continue;
        }

        lastPlacedMarkerCenterR = dotR;
        lastPlacedMarkerOuterRadiusPx = markerGeometry.outerRadiusPx;

        if (variant === "plus") {
          pushPlusMarker(wdx, wdy, markerGeometry.sizePx, echoMarkerWidthPx, dotAlpha, spoke.angle);
        } else if (variant === "triangles") {
          pushTriangleMarker(wdx, wdy, markerGeometry.triangleSidePx, echoMarkerWidthPx, dotAlpha, spoke.angle + Math.PI);
        } else if (variant === "diamond") {
          pushDiamondMarker(wdx, wdy, markerGeometry.sizePx, echoMarkerWidthPx, dotAlpha, spoke.angle);
        } else if (variant === "radial_dash") {
          pushRadialDashMarker(wdx, wdy, markerGeometry.dashLengthPx, echoMarkerWidthPx, dotAlpha, spoke.angle);
        } else if (variant === "star") {
          pushStarMarker(wdx, wdy, markerGeometry.sizePx, echoMarkerWidthPx, dotAlpha, spoke.angle);
        } else if (variant === "hexagon") {
          pushHexagonMarker(wdx, wdy, markerGeometry.sizePx * 1.1, echoMarkerWidthPx, dotAlpha, spoke.angle);
        } else {
          // "dots"
          layers.haloEchoDots.push(wdx, wdy, dotRadiusPx * 2, dotRadiusPx * 2, dotAlpha);
        }
      }
    }
  }

  // ── shared spoke-content band metrics ──────────────────────────────

  interface ContentBandMetrics {
    startRadius: number;
    endRadius: number;
    clearStartR: number;
    clearEndR: number;
  }

  interface SpokeLabelBandMetrics extends ContentBandMetrics {
    label: string;
  }

  function getTextLabelFontSizePx(config: HaloFieldConfig): number {
    return Math.max(
      3,
      Math.round(
        Math.max(3, config.spoke_text?.font_size_px ?? ECHO_TEXT_BASE_FONT_SIZE_PX) *
        Math.max(0.01, Math.min(stageW, stageH) / 1080) *
        Math.max(0.01, config.composition.scale || 1)
      )
    );
  }

  function getTextLabelWidthPx(label: string, fontSizePx: number): number {
    textCtx.save();
    textCtx.font = `${fontSizePx}px ${TEXT_LABEL_FONT_FAMILY}`;
    const w = textCtx.measureText(label).width;
    textCtx.restore();
    return w;
  }

  function getSharedContentStartRadius(haloOuterR: number, config: HaloFieldConfig): number {
    return haloOuterR + Math.max(0, config.spoke_lines.content_clearance_px ?? 0);
  }

  function getContentBandMetrics(
    haloOuterR: number,
    fullFrameR: number,
    contentLengthPx: number,
    config: HaloFieldConfig
  ): ContentBandMetrics {
    const contentStartRadius = Math.min(fullFrameR, getSharedContentStartRadius(haloOuterR, config));
    const startRadius = contentStartRadius;
    const endRadius = clamp(
      startRadius + contentLengthPx,
      startRadius,
      fullFrameR
    );
    return {
      startRadius,
      endRadius,
      clearStartR: Math.max(
        contentStartRadius,
        startRadius - TEXT_LABEL_MARGIN_PX
      ),
      clearEndR: Math.min(fullFrameR, endRadius + TEXT_LABEL_MARGIN_PX)
    };
  }

  function getSpokeLabelBandMetrics(
    spoke: Spoke | null,
    haloOuterR: number,
    fullFrameR: number,
    fontSizePx: number,
    maxSpokeCount: number,
    config: HaloFieldConfig
  ): SpokeLabelBandMetrics | null {
    const labelSlotId = wrapPositive(
      Math.round(spoke?.label_slot_id ?? spoke?.display_slot_id ?? 0),
      maxSpokeCount
    );
    if (labelSlotId >= UBUNTU_RELEASE_LABELS.length) {
      return null;
    }

    const label = UBUNTU_RELEASE_LABELS[labelSlotId];
    if (!label) {
      return null;
    }

    return {
      label,
      ...getContentBandMetrics(
        haloOuterR,
        fullFrameR,
        getTextLabelWidthPx(label, fontSizePx),
        config
      )
    };
  }

  // ── draw release labels on text overlay canvas ──────────────────────

  function drawReleaseLabelOverlay(
    spokes: Spoke[],
    box: MascotBox | null,
    haloOuterR: number,
    fullFrameR: number,
    config: HaloFieldConfig,
    baseAlpha: number,
    reveal: RevealState | null
  ) {
    if (!box || baseAlpha <= 0 || !config.spoke_text?.enabled) return;
    const cx = config.composition.center_x_px;
    const cy = config.composition.center_y_px;
    const fontSize = getTextLabelFontSizePx(config);
    const bgColor = config.composition.background_color || "#202020";
    const textColor = config.spoke_lines.reference_color || "#666666";
    const labelPadX = Math.max(4, Math.round(fontSize * 0.28));
    const labelPadY = Math.max(2, Math.round(fontSize * 0.18));

    textCtx.save();
    textCtx.font = `${fontSize}px ${TEXT_LABEL_FONT_FAMILY}`;
    textCtx.textBaseline = "middle";

    const maxSlots = Math.max(1, Math.round(config.generator_wrangle.spoke_count || 1));

    for (const spoke of spokes) {
      if (spoke.seam_overlay_only) continue;
      const labelBandMetrics = getSpokeLabelBandMetrics(
        spoke,
        haloOuterR,
        fullFrameR,
        fontSize,
        maxSlots,
        config
      );
      if (!labelBandMetrics) continue;

      const foldSeam = getFoldSeamAlpha(spoke.angle, config);
      const spokeAlpha = baseAlpha * clamp(spoke.alpha ?? 1, 0, 1) * foldSeam;
      if (spokeAlpha <= 0) continue;

      // World coords (Y-up), then convert to canvas (Y-down)
      const worldX = cx + Math.cos(spoke.angle) * labelBandMetrics.startRadius;
      const worldY = cy + Math.sin(spoke.angle) * labelBandMetrics.startRadius;
      const canvasX = worldX;
      const canvasY = stageH - worldY;
      // Negate angle for canvas Y-down coordinate system
      let labelRotation = -spoke.angle;
      const normRot = wrapPositive(labelRotation + Math.PI, TAU) - Math.PI;
      const shouldFlip = normRot > Math.PI * 0.5 || normRot < -Math.PI * 0.5;
      if (shouldFlip) labelRotation += Math.PI;

      const revealAlpha = getRevealLocalAlpha(
        worldX - (box?.center_x_px ?? cx),
        worldY - (box?.center_y_px ?? cy),
        reveal, maxSlots
      );
      if (revealAlpha <= 0) continue;

      const radialFade = getRadialFadeAlpha(labelBandMetrics.startRadius, fullFrameR, config);
      const alpha = spokeAlpha * revealAlpha * radialFade;
      if (alpha <= 0) continue;

      const measure = textCtx.measureText(labelBandMetrics.label);
      const measuredAscent = measure.actualBoundingBoxAscent || fontSize * 0.38;
      const measuredDescent = measure.actualBoundingBoxDescent || fontSize * 0.18;
      const measuredHeight = measuredAscent + measuredDescent;

      textCtx.save();
      textCtx.translate(canvasX, canvasY);
      textCtx.rotate(labelRotation);
      textCtx.textAlign = shouldFlip ? "right" : "left";
      textCtx.globalAlpha = alpha;
      textCtx.fillStyle = bgColor;
      textCtx.fillRect(
        shouldFlip ? -measure.width - labelPadX : -labelPadX,
        -measuredAscent - labelPadY,
        measure.width + labelPadX * 2,
        measuredHeight + labelPadY * 2
      );
      textCtx.fillStyle = textColor;
      textCtx.fillText(labelBandMetrics.label, 0, 0);
      textCtx.restore();
    }

    textCtx.restore();
  }

  function drawMascotOverlay(sceneDescriptor: UbuntuSummitAnimationSceneDescriptor) {
    const mascotBox = sceneDescriptor.mascotBox;
    const mascotMotion = sceneDescriptor.frameState.mascotMotion;
    if (!mascotBox || !mascotFaceImage) {
      return;
    }

    const baseAlpha = clamp(mascotMotion.mascotFadeU, 0, 1);
    if (baseAlpha <= 0) {
      return;
    }

    const sizePx = mascotBox.draw_size_px;
    const centerX = mascotBox.center_x_px;
    const centerY = stageH - mascotBox.center_y_px;
    const bgColor = sceneDescriptor.haloConfig.composition.background_color || "#202020";
    const eyeScaleY = clamp(mascotMotion.eyeScaleY, 0.02, 1);
    const headTurnRad = -sceneDescriptor.frameState.mascotMotion.headTurnDeg * Math.PI / 180;
    const unitScale = sizePx / MASCOT_VIEWBOX_SIZE;
    const haloAlpha = baseAlpha
      * clamp(sceneDescriptor.frameState.haloU, 0, 1)
      * MASCOT_REFERENCE_HALO_OPACITY;

    textCtx.save();
    textCtx.translate(centerX, centerY);
    textCtx.rotate(headTurnRad);

    if (sceneDescriptor.haloConfig.spoke_lines.show_reference_halo && mascotHaloImage && haloAlpha > 0) {
      textCtx.save();
      textCtx.globalAlpha = haloAlpha;
      textCtx.drawImage(mascotHaloImage, -sizePx * 0.5, -sizePx * 0.5, sizePx, sizePx);
      textCtx.restore();
    }

    textCtx.save();
    textCtx.globalAlpha = baseAlpha;
    textCtx.drawImage(mascotFaceImage, -sizePx * 0.5, -sizePx * 0.5, sizePx, sizePx);
    textCtx.restore();

    // Match the reference layering: fixed white nose, animated cutout above it, then eyes.
    textCtx.save();
    textCtx.translate(-sizePx * 0.5, -sizePx * 0.5);
    textCtx.scale(unitScale, unitScale);
    textCtx.globalAlpha = baseAlpha;
    textCtx.fillStyle = "#ffffff";
    textCtx.fill(MASCOT_NOSE_PATH);
    textCtx.restore();

    textCtx.save();
    textCtx.translate(-sizePx * 0.5, -sizePx * 0.5 - mascotMotion.noseBobPx);
    textCtx.scale(unitScale, unitScale);
    textCtx.globalAlpha = baseAlpha;
    textCtx.fillStyle = bgColor;
    textCtx.fill(MASCOT_NOSE_PATH);
    textCtx.restore();

    textCtx.fillStyle = "#ffffff";
    for (const eye of MASCOT_EYE_SPECS) {
      const localX = sizePx * (eye.cx / MASCOT_VIEWBOX_SIZE - 0.5);
      const localY = sizePx * (eye.cy / MASCOT_VIEWBOX_SIZE - 0.5);
      const radiusX = sizePx * (eye.radius / MASCOT_VIEWBOX_SIZE);
      const radiusY = Math.max(0.75, radiusX * eyeScaleY);
      textCtx.beginPath();
      textCtx.ellipse(localX, localY, radiusX, radiusY, 0, 0, Math.PI * 2);
      textCtx.fill();
    }

    textCtx.restore();
  }

  function getSceneBaseAlpha(sceneDescriptor: UbuntuSummitAnimationSceneDescriptor): number {
    return clamp(sceneDescriptor.frameState.mascotMotion.mascotFadeU, 0, 1);
  }

  // ── main render ─────────────────────────────────────────────────────

  function renderFrame(
    sceneDescriptor: UbuntuSummitAnimationSceneDescriptor,
    transparentBackground: boolean = false
  ) {
    lastSceneDescriptor = sceneDescriptor;
    lastTransparentBackground = transparentBackground;
    const config = sceneDescriptor.haloConfig;
    const mascotBox = sceneDescriptor.mascotBox;
    const frameState = sceneDescriptor.frameState;

    // Background + clear
    const bgHex = config.composition.background_color || "#202020";
    renderer.setClearColor(new THREE.Color(bgHex), transparentBackground ? 0 : 1);

    clearLayers();
    updateLayerColors(config);

    if (debugTriangleEnabled) {
      finalizeLayers();
      renderer.render(scene, camera);
      if (textOverlayCanvas.width !== stageW) textOverlayCanvas.width = stageW;
      if (textOverlayCanvas.height !== stageH) textOverlayCanvas.height = stageH;
      textCtx.clearRect(0, 0, stageW, stageH);
      return;
    }

    // Rebuild scene data when config changes
    ensureSceneData(
      config,
      mascotBox,
      sceneDescriptor.runtimeTiming,
      sceneDescriptor.frameState.nextTransitionState.configFingerprint
    );
    ensureMascotAssetsLoaded();

    const fullFrameR = frameState.fullFrameOuterRadiusPx;
    const screensaverFieldState = frameState.screensaverFieldState;
    const haloOuterR = frameState.haloOuterRadiusPx;
    const spokes = screensaverFieldState?.spokes ?? introField?.spokes ?? [];
    const visibleSpokeCount = screensaverFieldState?.visible_spoke_count
      ?? introField?.visible_spoke_count ?? 0;
    const reveal = frameState.reveal;
    const sceneBaseAlpha = getSceneBaseAlpha(sceneDescriptor);

    // ── Render ────────────────────────────────────────────────────────

    // Construction lines render from frame 1 (always visible).
    // Halo layers (spokes, echoes) are gated by reveal_state.haloU which is
    // 0 during dot intro, sweeps 0→1 during finale, and 1 after.
    pushBackgroundSpokes(spokes, fullFrameR, config);

    if (screensaverFieldState) {
      pushPostFinalePoints(screensaverFieldState, config);
    } else {
      pushAnimatedIntroPoints(frameState.dotTimeSec, frameState.isDotComplete, config, sceneDescriptor.runtimeTiming);
    }

    pushHaloLayers(
      spokes,
      visibleSpokeCount,
      mascotBox,
      haloOuterR,
      fullFrameR,
      config,
      sceneBaseAlpha,
      reveal
    );

    finalizeLayers();
    renderer.render(scene, camera);

    // Text overlay (release labels)
    if (textOverlayCanvas.width !== stageW) textOverlayCanvas.width = stageW;
    if (textOverlayCanvas.height !== stageH) textOverlayCanvas.height = stageH;
    textCtx.clearRect(0, 0, stageW, stageH);
    drawMascotOverlay(sceneDescriptor);
    drawReleaseLabelOverlay(spokes, mascotBox, haloOuterR, fullFrameR, config, sceneBaseAlpha, reveal);
  }

  function clearFrame() {
    renderer.clear();
    if (textOverlayCanvas.width !== stageW) textOverlayCanvas.width = stageW;
    if (textOverlayCanvas.height !== stageH) textOverlayCanvas.height = stageH;
    textCtx.clearRect(0, 0, stageW, stageH);
  }

  // ── resize ──────────────────────────────────────────────────────────

  function resize(w: number, h: number) {
    stageW = w;
    stageH = h;
    renderer.setSize(w, h, false);
    camera.left = 0;
    camera.right = w;
    camera.top = h;
    camera.bottom = 0;
    camera.updateProjectionMatrix();
    textOverlayCanvas.width = w;
    textOverlayCanvas.height = h;
  }

  // ── dispose ─────────────────────────────────────────────────────────

  function disposeAll() {
    for (const layer of Object.values(layers)) {
      layer.dispose();
    }
    if (debugTriangleMesh) {
      debugTriangleMesh.geometry.dispose();
      debugTriangleMesh.material.dispose();
      worldGroup.remove(debugTriangleMesh);
      debugTriangleMesh = null;
    }
    renderer.dispose();
  }

  return {
    resize,
    clearFrame,
    renderFrame,
    dispose: disposeAll,
    canvas,
    textOverlayCanvas
  };
}
