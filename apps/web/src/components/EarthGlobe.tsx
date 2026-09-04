"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { HotspotEvent } from "@/lib/types";

interface EarthGlobeProps {
  events?: HotspotEvent[];
  onSelectEvent?: (event: HotspotEvent) => void;
}

// Convert geographic lat/lon to 3D Sphere Vector on untransformed sphere
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Camera focus point: India center (20.5937°N, 78.9629°E)
const FOCUS_CENTER = {
  lat: 20.5937,
  lon: 78.9629,
};

// Curated Indian industrial & thermal centers
const DEFAULT_HOTSPOTS = [
  { id: "evt-jamnagar", name: "Reliance Jamnagar Refinery", lat: 22.368, lon: 69.832, frp: 842, type: "INDUSTRIAL_FIRE_EMERGENCY", critical: true },
  { id: "evt-haldia", name: "IOCL Haldia Petrochemicals", lat: 22.031, lon: 88.082, frp: 145, type: "PERSISTENT_INDUSTRIAL_FLARE", critical: false },
  { id: "evt-panipat", name: "IOCL Panipat Refinery Flare", lat: 29.390, lon: 76.963, frp: 98, type: "PERSISTENT_INDUSTRIAL_FLARE", critical: false },
  { id: "evt-vizag", name: "HPCL Visakh Refinery", lat: 17.724, lon: 83.265, frp: 310, type: "INDUSTRIAL_FIRE_EMERGENCY", critical: true },
  { id: "evt-tata", name: "Tata Steel Jamshedpur Works", lat: 22.804, lon: 86.202, frp: 165, type: "PERSISTENT_INDUSTRIAL_FLARE", critical: false },
  { id: "evt-mumbai", name: "BPCL Mumbai Refinery", lat: 19.014, lon: 72.894, frp: 120, type: "PERSISTENT_INDUSTRIAL_FLARE", critical: false },
  { id: "evt-hazira", name: "ONGC Hazira Gas Terminal", lat: 21.112, lon: 72.645, frp: 210, type: "PERSISTENT_INDUSTRIAL_FLARE", critical: false },
  { id: "evt-kochi", name: "BPCL Kochi Refinery", lat: 9.992, lon: 76.358, frp: 140, type: "PERSISTENT_INDUSTRIAL_FLARE", critical: false },
  { id: "evt-punjab", name: "Sangrur Agrarian Stubble Cluster", lat: 30.245, lon: 75.842, frp: 65, type: "AGRICULTURAL_BURNING", critical: false },
  { id: "evt-bhatinda", name: "Bhatinda Agricultural Belt", lat: 30.211, lon: 74.945, frp: 55, type: "AGRICULTURAL_BURNING", critical: false },
  { id: "evt-haryana", name: "Karnal Crop Residue Burn", lat: 29.685, lon: 76.990, frp: 48, type: "AGRICULTURAL_BURNING", critical: false },
  { id: "evt-uk-wildfire", name: "Nainital Pine Forest Wildfire", lat: 29.380, lon: 79.463, frp: 85, type: "WILDFIRE", critical: false },
  { id: "evt-hp-forest", name: "Shimla Ridge Wildfire", lat: 31.104, lon: 77.173, frp: 72, type: "WILDFIRE", critical: false },
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

  const eventsRef = useRef(events);
  eventsRef.current = events;

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

    const TARGET_FOV = 50;
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

    const orientationGroup = new THREE.Group();
    orientationGroup.rotation.z = degToRad(-15);
    scene.add(orientationGroup);

    const globeGroup = new THREE.Group();
    orientationGroup.add(globeGroup);

    // ── 3. Earth Mesh & NASA Blue Marble Texture ─────────────────────
    const globeGeo = new THREE.SphereGeometry(globeRadius, 64, 64);
    const textureLoader = new THREE.TextureLoader();
    const earthDayMap = textureLoader.load(
      "https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg"
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
    const activeHotspots = eventsRef.current && eventsRef.current.length > 0
      ? eventsRef.current.map((e) => ({
          id: e.id,
          name: e.facility_name || `${e.classification.replace(/_/g, " ")}`,
          lat: e.latitude,
          lon: e.longitude,
          frp: e.frp_megawatts ?? 25,
          type: e.classification,
          critical: e.is_critical_alert || e.classification === "INDUSTRIAL_FIRE_EMERGENCY",
          raw: e,
        }))
      : DEFAULT_HOTSPOTS.map((d) => ({ ...d, raw: null as HotspotEvent | null }));

    const thermalBeamObjects: Array<{
      beamMesh: THREE.Mesh;
      rings: Array<{ mesh: THREE.Mesh; speed: number; phase: number; maxRadius: number; baseOpacity: number }>;
      currentScaleZ: number;
      targetScaleZ: number;
      delay: number;
    }> = [];

    const interactiveMeshes: THREE.Object3D[] = [];

    activeHotspots.forEach((h, idx) => {
      const beamGroup = new THREE.Group();

      const beamRadius = 0.011;
      const targetAltitude = Math.min(0.65, Math.max(0.18, (h.frp / 850) * 0.65));

      const beamGeo = new THREE.CylinderGeometry(beamRadius, beamRadius, targetAltitude, 24, 1);
      beamGeo.translate(0, targetAltitude / 2, 0);
      beamGeo.rotateX(Math.PI / 2);

      const colorHex = h.critical ? 0xff2200 : 0x00ffff;
      const rgbVec = h.critical ? new THREE.Vector3(1.0, 0.13, 0.0) : new THREE.Vector3(0.0, 1.0, 1.0);

      const beamMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: rgbVec },
          uMaxAltitude: { value: targetAltitude },
        },
        vertexShader: `
          varying float vHeight;
          void main() {
            vHeight = position.z;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uMaxAltitude;
          varying float vHeight;
          void main() {
            float normH = clamp(vHeight / uMaxAltitude, 0.0, 1.0);
            float alpha = (1.0 - normH * 0.88) * 0.95;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
      });

      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.scale.z = 0.001;
      beamGroup.add(beamMesh);

      // Flat circular disc at the exact peak altitude
      const capGeo = new THREE.CircleGeometry(beamRadius * 1.05, 16);
      const capMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.position.z = targetAltitude;
      beamMesh.add(capMesh);

      // Interactive hit cylinder for effortless hover detection
      const hitGeo = new THREE.CylinderGeometry(0.045, 0.045, targetAltitude, 12);
      hitGeo.translate(0, targetAltitude / 2, 0);
      hitGeo.rotateX(Math.PI / 2);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { hotspotData: h };
      beamGroup.add(hitMesh);
      interactiveMeshes.push(hitMesh);

      // 2 Radar Terrain Waves expanding around the beam root
      const rings: Array<{ mesh: THREE.Mesh; speed: number; phase: number; maxRadius: number; baseOpacity: number }> = [];
      const ringConfigs = [
        { initialRadius: 0.016, speed: 0.75, phase: 0.0, maxRadius: 3.4, baseOpacity: 0.75 },
        { initialRadius: 0.016, speed: 0.75, phase: 0.5, maxRadius: 3.4, baseOpacity: 0.55 },
      ];

      ringConfigs.forEach((cfg) => {
        const ringGeo = new THREE.RingGeometry(cfg.initialRadius * 0.82, cfg.initialRadius, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: cfg.baseOpacity,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.z = 0.002;
        beamGroup.add(ringMesh);

        rings.push({
          mesh: ringMesh,
          speed: cfg.speed,
          phase: cfg.phase,
          maxRadius: cfg.maxRadius,
          baseOpacity: cfg.baseOpacity,
        });
      });

      // Position beamGroup at coordinates on the sphere and orient outward along surface normal
      const pos = latLonToVector3(h.lat, h.lon, globeRadius * 1.001);
      beamGroup.position.copy(pos);

      const normal = pos.clone().normalize();
      beamGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

      globeGroup.add(beamGroup);

      thermalBeamObjects.push({
        beamMesh,
        rings,
        currentScaleZ: 0.001,
        targetScaleZ: 1.0,
        delay: idx * 0.08,
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

    // ── 7. Fly-in Animation Setup (Spins on load into India focus) ─────
    const START_YAW_Y = TARGET_YAW_Y - Math.PI * 1.5;
    globeGroup.rotation.y = START_YAW_Y;
    globeGroup.rotation.x = 0;

    let flyInProgress = 0;
    const FLY_IN_DURATION = 1.8;
    let lastTime = performance.now();
    const startTime = lastTime;

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
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const matched = hit.userData?.hotspotData as typeof activeHotspots[0] | undefined;
        if (matched?.raw && onSelectRef.current) {
          onSelectRef.current(matched.raw);
        }
      }
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("click", handleClick);

    // ── 9. Main Render Loop with Smooth Easing ────────────────────────
    const animate = () => {
      const now = performance.now();
      const rawDelta = (now - lastTime) / 1000;
      lastTime = now;
      const delta = Math.min(rawDelta, 0.1);
      const elapsed = (now - startTime) / 1000;

      // Smooth Fly-in sequence (spins gracefully into position on load)
      if (flyInProgress < 1) {
        flyInProgress += delta / FLY_IN_DURATION;
        const t = Math.min(1, flyInProgress);
        // Quintic ease-out: 1 - (1 - t)^5
        const ease = 1 - Math.pow(1 - t, 5);

        globeGroup.rotation.y = START_YAW_Y + (TARGET_YAW_Y - START_YAW_Y) * ease;
        globeGroup.rotation.x = TARGET_PITCH_X * ease;
      } else {
        // Locked stably onto India center
        globeGroup.rotation.y = TARGET_YAW_Y;
        globeGroup.rotation.x = TARGET_PITCH_X;
      }

      // Progressive Laser Beam Spring Erection & Scanning Radar Waves
      thermalBeamObjects.forEach((tb) => {
        if (elapsed > tb.delay) {
          tb.currentScaleZ += (tb.targetScaleZ - tb.currentScaleZ) * (delta * 5);
          tb.beamMesh.scale.z = tb.currentScaleZ;

          tb.rings.forEach((ring) => {
            const wave = ((elapsed * ring.speed + ring.phase) % 1);
            const scale = 1 + wave * ring.maxRadius;
            ring.mesh.scale.set(scale, scale, 1);

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
  }, []);

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
              {hoveredHotspot.critical && (
                <div className="text-[#ff3300] font-semibold tracking-wider text-[9px] mt-1 pt-1 border-t border-red-500/20">
                  CRITICAL THERMAL ANOMALY
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
