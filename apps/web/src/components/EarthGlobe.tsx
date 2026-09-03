"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { HotspotEvent } from "@/lib/types";

interface EarthGlobeProps {
  events?: HotspotEvent[];
  onSelectEvent?: (event: HotspotEvent) => void;
}

// Convert geographic lat/lon to 3D Sphere Vector on untransformed sphere
// Three.js SphereGeometry:
// Polar angle phi: 0 at North Pole (+Y), PI at South Pole (-Y)
// Azimuthal angle theta: (lon + 180) * PI / 180
// x = -r * sin(phi) * cos(theta)
// y =  r * cos(phi)
// z =  r * sin(phi) * sin(theta)
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Camera focus point: shifted East (~89°E) so India (78.96°E) sits left-of-center on the visible sphere,
// accentuating the spherical curvature and 3D bulge. Latitude kept at India's 20.5937°N.
const FOCUS_CENTER = {
  lat: 20.5937,
  lon: 89.0,
};

// Curated Indian industrial & thermal centers
const DEFAULT_HOTSPOTS = [
  { id: "evt-jamnagar", name: "Reliance Jamnagar Refinery", lat: 22.368, lon: 69.832, frp: 842, type: "INDUSTRIAL_FIRE_EMERGENCY", critical: true },
  { id: "evt-haldia", name: "IOCL Haldia Petrochemicals", lat: 22.031, lon: 88.082, frp: 145, type: "PERSISTENT_INDUSTRIAL_FLARE", critical: false },
  { id: "evt-panipat", name: "IOCL Panipat Refinery Flare", lat: 29.390, lon: 76.963, frp: 98, type: "PERSISTENT_INDUSTRIAL_FLARE", critical: false },
  { id: "evt-vizag", name: "HPCL Visakh Refinery", lat: 17.724, lon: 83.265, frp: 310, type: "INDUSTRIAL_FIRE_EMERGENCY", critical: true },
  { id: "evt-mumbai", name: "BPCL Trombay Complex", lat: 19.006, lon: 72.894, frp: 520, type: "INDUSTRIAL_FIRE_EMERGENCY", critical: true },
  { id: "evt-bhatinda", name: "Punjab Agri Residue Cluster", lat: 30.211, lon: 74.945, frp: 76, type: "AGRICULTURAL_BURNING", critical: false },
  { id: "evt-jamshedpur", name: "Tata Steel Blast Furnace", lat: 22.805, lon: 86.203, frp: 215, type: "PERSISTENT_INDUSTRIAL_FLARE", critical: false },
];

export function EarthGlobe({ events, onSelectEvent }: EarthGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredHotspot, setHoveredHotspot] = useState<{
    name: string;
    type: string;
    frp: number;
    critical: boolean;
    x: number;
    y: number;
  } | null>(null);

  const onSelectRef = useRef(onSelectEvent);
  onSelectRef.current = onSelectEvent;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId: number;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 600;

    // ── 1. Three.js Scene, Camera, Renderer ──────────────────────────
    const scene = new THREE.Scene();

    const globeRadius = 1.0;
    const atmoRadius = globeRadius * 1.08;

    // Strong Orbital Depth: FOV 50° provides rich 3D curvature
    const TARGET_FOV = 50;
    // Camera distance at 2.52 provides 30-40px of breathing room at canvas top edge so the blue glow is completely uncropped
    const CAMERA_DISTANCE = 2.52;

    const initialAspect = width / height;
    const camera = new THREE.PerspectiveCamera(TARGET_FOV, initialAspect, 0.1, 1000);
    camera.position.set(0, 0, CAMERA_DISTANCE);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // ── 2. Precise Upright Centering + Gentle Clockwise Diagonal Tilt ─
    const degToRad = (deg: number) => (deg * Math.PI) / 180;

    const TARGET_YAW_Y = -degToRad(FOCUS_CENTER.lon + 90);
    const TARGET_PITCH_X = degToRad(FOCUS_CENTER.lat);
    const TARGET_ROLL_Z = -degToRad(26.0);

    const orientationGroup = new THREE.Group();
    orientationGroup.rotation.z = TARGET_ROLL_Z;
    scene.add(orientationGroup);

    const globeGroup = new THREE.Group();
    orientationGroup.add(globeGroup);

    // ── 3. Earth Mesh & NASA Blue Marble Texture ─────────────────────
    const globeGeo = new THREE.SphereGeometry(globeRadius, 64, 64);
    const textureLoader = new THREE.TextureLoader();
    const earthDayMap = textureLoader.load(
      "https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg",
      () => renderer.render(scene, camera)
    );

    const globeMat = new THREE.MeshStandardMaterial({
      map: earthDayMap,
      roughness: 0.78,
      metalness: 0.12,
      color: 0x9dc6ec,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    globeGroup.add(globeMesh);

    // ── 4. Cinematic Atmospheric Outer Glow ──────────────────────────
    const atmoGeo = new THREE.SphereGeometry(atmoRadius, 64, 64);
    const atmoMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float viewDot = dot(vNormal, vec3(0.0, 0.0, 1.0));
          float intensity = pow(clamp(0.72 - viewDot, 0.0, 1.0), 2.4);
          gl_FragColor = vec4(0.25, 0.82, 1.0, 1.0) * intensity * 1.35;
        }
      `,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    globeGroup.add(atmoMesh);

    // ── 5. 3D Light Beams with Vertical Opacity Gradient & Flat Top ──
    const activeHotspots = events && events.length > 0
      ? events.map((e) => ({
          id: e.id,
          name: e.facility_name ?? "Thermal Anomaly",
          lat: e.latitude,
          lon: e.longitude,
          frp: e.frp_megawatts ?? 100,
          type: e.classification,
          critical: e.is_critical_alert,
          raw: e,
        }))
      : DEFAULT_HOTSPOTS.map((d) => ({
          ...d,
          raw: undefined as unknown as HotspotEvent,
        }));

    interface RadarRing {
      mesh: THREE.Mesh;
      initialScale: number;
      speed: number;
      phase: number;
      maxRadius: number;
      baseOpacity: number;
    }

    interface ThermalBeamObj {
      data: typeof activeHotspots[0];
      group: THREE.Group;
      beamMesh: THREE.Mesh;
      rings: RadarRing[];
      targetScaleZ: number;
      currentScaleZ: number;
      delay: number;
    }

    const thermalBeamObjects: ThermalBeamObj[] = [];
    const interactiveMeshes: THREE.Object3D[] = [];

    // Custom Vertical Opacity Gradient Shader:
    // Ground base is 100% solid (1.0 opacity), apex fades smoothly to 0% (0.0 opacity, perfectly transparent)
    const beamVertexShader = `
      varying float vAltitude;
      void main() {
        // position.z runs from 0.0 (ground base) to 1.0 (peak apex)
        vAltitude = clamp(position.z, 0.0, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const beamFragmentShader = `
      uniform vec3 uColor;
      uniform float uEmissiveIntensity;
      varying float vAltitude;
      void main() {
        // Base is 1.0 (100% solid), top fades smoothly to 0.0 (0% transparent)
        float alpha = 1.0 - smoothstep(0.0, 1.0, vAltitude);
        vec3 finalColor = uColor * uEmissiveIntensity;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    activeHotspots.forEach((h, idx) => {
      // Base point on sphere surface
      const pos = latLonToVector3(h.lat, h.lon, globeRadius * 1.001);
      const isCrit = h.critical;

      // Color mapping:
      // Critical industrial hazards: Blinding intense Neon Orange/Red (#FF3300)
      // Standard monitoring / active flares: Blinding Neon Cyan (#00FFFF)
      // Agricultural Burning: Vivid Gold (#FFD700)
      let beamColor = new THREE.Color(0x00ffff); // Blinding Neon Cyan default
      if (isCrit) {
        beamColor = new THREE.Color(0xff3300); // Intense Neon Orange/Red
      } else if (h.type === "PERSISTENT_INDUSTRIAL_FLARE") {
        beamColor = new THREE.Color(0x00f0ff); // Electric Cyan
      } else if (h.type === "AGRICULTURAL_BURNING") {
        beamColor = new THREE.Color(0xffd700); // Vivid Gold
      }

      // Height proportional to thermal FRP intensity (min 0.10, max 0.30)
      const frpClamped = Math.min(Math.max(h.frp, 50), 900);
      const beamHeight = 0.10 + (frpClamped / 900) * 0.20;

      // Solid beam thickness (pointRadius ~0.12 equivalent)
      const beamRadius = 0.0075;

      const beamGroup = new THREE.Group();
      beamGroup.position.copy(pos);
      // Align +Z / normal with the outward radial vector
      beamGroup.lookAt(pos.clone().multiplyScalar(2));
      globeGroup.add(beamGroup);

      // ── Standard Flat-Ended CylinderGeometry (Open-Ended, NO caps) ──
      // Flat top edges become invisible as alpha fades to 0.0 at altitude 1.0
      const cylinderGeo = new THREE.CylinderGeometry(beamRadius * 0.75, beamRadius, 1.0, 16, 1, true);
      // Center base at origin (0, 0, 0) and extend toward +Y
      cylinderGeo.translate(0, 0.5, 0);
      // Rotate so it extends along +Z (outward from Earth surface)
      cylinderGeo.rotateX(Math.PI / 2);

      const beamMat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: beamColor },
          uEmissiveIntensity: { value: 1.85 }, // Luminous radiance
        },
        vertexShader: beamVertexShader,
        fragmentShader: beamFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false, // Ensures fading transparency renders cleanly without clipping
        side: THREE.DoubleSide,
      });

      const beamMesh = new THREE.Mesh(cylinderGeo, beamMat);
      beamMesh.scale.set(1, 1, 0); // Start flat on ground, springs upward along Z
      beamMesh.userData = { hotspotData: h };
      beamGroup.add(beamMesh);

      // Invisible hit cylinder for effortless raycast hovering
      const hitGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.0, 8, 1, true);
      hitGeo.translate(0, 0.5, 0);
      hitGeo.rotateX(Math.PI / 2);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { hotspotData: h };
      hitMesh.scale.set(1, 1, beamHeight);
      beamGroup.add(hitMesh);
      interactiveMeshes.push(hitMesh);

      // ── High-Visibility Scanning Radar Zones ─────────────────────────
      const ringCount = isCrit ? 2 : 1;
      const rings: RadarRing[] = [];

      for (let r = 0; r < ringCount; r++) {
        const ringGeo = new THREE.RingGeometry(0.012, 0.018, 32);
        const ringColor = isCrit ? new THREE.Color(0xff3300) : new THREE.Color(0x00ffff);
        const ringMat = new THREE.MeshBasicMaterial({
          color: ringColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.set(0, 0, 0.001);
        beamGroup.add(ringMesh);

        rings.push({
          mesh: ringMesh,
          initialScale: 0.2,
          speed: 0.40 + r * 0.15,
          phase: (r / ringCount) * Math.PI * 2,
          maxRadius: isCrit ? 4.5 : 3.4,
          baseOpacity: 0.38,
        });
      }

      thermalBeamObjects.push({
        data: h,
        group: beamGroup,
        beamMesh,
        rings,
        targetScaleZ: beamHeight,
        currentScaleZ: 0,
        delay: 1.8 + idx * 0.12,
      });
    });

    // ── 6. Directional 3D Space Lighting ─────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.05);
    scene.add(ambientLight);

    const keySunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keySunLight.position.set(5, 5, 4.5);
    scene.add(keySunLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.2);
    rimLight.position.set(-4, 6, -3);
    scene.add(rimLight);

    // ── 7. Fly-in Animation Setup ────────────────────────────────────
    const START_YAW_Y = TARGET_YAW_Y - Math.PI * 1.5;
    globeGroup.rotation.y = START_YAW_Y;
    globeGroup.rotation.x = 0;

    let flyInProgress = 0;
    const FLY_IN_DURATION = 2.0;
    const clock = new THREE.Clock();

    // ── 8. Raycasting for Hover Tooltips ──────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);

    const handleMouseMove = (evt: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes, false);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const hData = hit.userData?.hotspotData as typeof activeHotspots[0] | undefined;
        if (hData) {
          setHoveredHotspot({
            name: hData.name,
            type: hData.type,
            frp: hData.frp,
            critical: hData.critical,
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top,
          });
          container.style.cursor = "pointer";
          return;
        }
      }
      setHoveredHotspot(null);
      container.style.cursor = "default";
    };

    const handleClick = () => {
      if (hoveredHotspot && onSelectRef.current) {
        const matched = activeHotspots.find((h) => h.name === hoveredHotspot.name);
        if (matched?.raw) {
          onSelectRef.current(matched.raw);
        }
      }
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("click", handleClick);

    // ── 9. Main Render Loop with Smooth Easing ────────────────────────
    const animate = () => {
      const rawDelta = clock.getDelta();
      const delta = Math.min(rawDelta, 0.1);
      const elapsed = clock.getElapsedTime();

      // Smooth Fly-in sequence (ambient rotation strictly paused during fly-in)
      if (flyInProgress < 1) {
        flyInProgress += delta / FLY_IN_DURATION;
        const t = Math.min(1, flyInProgress);
        // Quintic ease-out: 1 - (1 - t)^5
        const ease = 1 - Math.pow(1 - t, 5);

        globeGroup.rotation.y = START_YAW_Y + (TARGET_YAW_Y - START_YAW_Y) * ease;
        globeGroup.rotation.x = TARGET_PITCH_X * ease;
      } else {
        // Locked stably onto India center with clockwise diagonal roll
        globeGroup.rotation.y = TARGET_YAW_Y;
        globeGroup.rotation.x = TARGET_PITCH_X;
      }

      // Progressive Laser Beam Spring Erection & Scanning Radar Waves
      thermalBeamObjects.forEach((tb) => {
        if (elapsed > tb.delay) {
          // Smooth spring erection of laser beam along altitude Z
          tb.currentScaleZ += (tb.targetScaleZ - tb.currentScaleZ) * (delta * 5);
          tb.beamMesh.scale.z = tb.currentScaleZ;

          // Animate propagating terrain scan ripples
          tb.rings.forEach((ring) => {
            const wave = ((elapsed * ring.speed + ring.phase) % 1);
            const scale = 1 + wave * ring.maxRadius;
            ring.mesh.scale.set(scale, scale, 1);

            // Fade opacity outward gracefully
            const mat = ring.mesh.material as THREE.MeshBasicMaterial;
            mat.opacity = (1 - wave) * ring.baseOpacity;
          });
        }
      });

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    // ── 10. Resize Observer ──────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("click", handleClick);
      renderer.dispose();
    };
  }, [events]);

  return (
    <div className="relative w-full h-full select-none">
      <div ref={containerRef} className="w-full h-full" />

      {/* High-Tech Tactical Tooltip */}
      {hoveredHotspot && (
        <div
          className="absolute pointer-events-none z-30 transition-all duration-75 ease-out"
          style={{
            left: `${hoveredHotspot.x + 14}px`,
            top: `${hoveredHotspot.y - 14}px`,
          }}
        >
          <div className="bg-black/90 border border-blue-500/30 backdrop-blur-md px-3.5 py-2.5 rounded shadow-[0_4px_24px_rgba(0,0,0,0.8)] font-mono text-[11px] text-white">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  hoveredHotspot.critical ? "bg-[#ff3300] shadow-[0_0_8px_#ff3300]" : "bg-[#00ffff] shadow-[0_0_8px_#00ffff]"
                }`}
              />
              <span className="font-bold tracking-tight">{hoveredHotspot.name}</span>
            </div>
            <div className="text-slate-400 text-[10px] space-y-0.5">
              <div>
                <span className="text-slate-500">CLASS:</span> {hoveredHotspot.type}
              </div>
              <div>
                <span className="text-slate-500">THERMAL FRP:</span>{" "}
                <span className={hoveredHotspot.critical ? "text-[#ff3300] font-bold" : "text-[#00ffff]"}>
                  {hoveredHotspot.frp} MW
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
