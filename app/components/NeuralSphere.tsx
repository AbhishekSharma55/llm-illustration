"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface NeuralSphereProps {
  isStreaming: boolean;
  tokenCount: number;
}

interface SceneState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  group: THREE.Group;
  connections: [number, number][];
  neighborMap: Map<number, number[]>;
  highlightGroup: THREE.Group;
  points: THREE.Vector3[];
  nodeMeshes: THREE.Mesh[];
  nodeGlows: THREE.Mesh[];
  animationId: number;
  activeHighlights: {
    line: THREE.Line;
    tube: THREE.Mesh;
    birth: number;
    lifetime: number;
    nodeIndices: [number, number];
    segmentCount: number;
  }[];
  lastTokenCount: number;
  disposed: boolean;
}

// Seeded random for reproducible results
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Generate nodes on a sphere with subtle randomness
function generateScatteredNodes(
  numPoints: number,
  radius: number
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const rng = seededRandom(42);
  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  // ~90% surface nodes with mild jitter — keeps the sphere shape clear
  const surfaceCount = Math.floor(numPoints * 0.9);
  for (let i = 0; i < surfaceCount; i++) {
    const theta = (2 * Math.PI * i) / goldenRatio + (rng() - 0.5) * 0.2;
    const phi =
      Math.acos(1 - (2 * (i + 0.5)) / surfaceCount) + (rng() - 0.5) * 0.1;

    // Subtle radius variation: 0.95x – 1.08x
    const r = radius * (0.95 + rng() * 0.13);

    points.push(
      new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      )
    );
  }

  // ~5% interior nodes for depth
  const innerCount = Math.floor(numPoints * 0.05);
  for (let i = 0; i < innerCount; i++) {
    const r = radius * (0.6 + rng() * 0.25);
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);

    points.push(
      new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      )
    );
  }

  // ~5% outlier nodes just outside
  const outerCount = numPoints - surfaceCount - innerCount;
  for (let i = 0; i < outerCount; i++) {
    const r = radius * (1.05 + rng() * 0.12);
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);

    points.push(
      new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      )
    );
  }

  return points;
}

// Generate connections between nodes
function generateConnections(
  points: THREE.Vector3[],
  maxDistance: number
): [number, number][] {
  const connections: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dist = points[i].distanceTo(points[j]);
      if (dist < maxDistance) {
        connections.push([i, j]);
      }
    }
  }
  return connections;
}

export default function NeuralSphere({
  isStreaming,
  tokenCount,
}: NeuralSphereProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneState | null>(null);

  // Initialize scene once
  useEffect(() => {
    if (!containerRef.current || sceneRef.current) return;

    const container = containerRef.current;

    // Clear any leftover canvases from strict mode
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Main group for rotation
    const group = new THREE.Group();
    scene.add(group);

    // Generate scattered sphere nodes
    const NUM_NODES = 250;
    const SPHERE_RADIUS = 2.5;
    const points = generateScatteredNodes(NUM_NODES, SPHERE_RADIUS);

    // Create node spheres with varied sizes
    const nodeMeshes: THREE.Mesh[] = [];
    const nodeGlows: THREE.Mesh[] = [];

    const rngSize = seededRandom(99);
    for (const point of points) {
      const size = 0.015 + rngSize() * 0.015;

      // Each node gets its own material so we can tint it individually
      const nMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
      const nodeGeo = new THREE.SphereGeometry(size, 8, 8);
      const mesh = new THREE.Mesh(nodeGeo, nMat);
      mesh.position.copy(point);
      group.add(mesh);
      nodeMeshes.push(mesh);

      const gMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.12,
      });
      const glowGeo = new THREE.SphereGeometry(size * 1.6, 8, 8);
      const glow = new THREE.Mesh(glowGeo, gMat);
      glow.position.copy(point);
      group.add(glow);
      nodeGlows.push(glow);
    }

    // Add text labels to ~40% of nodes
    const nodeLabels = [
      "attn_0", "FFN", "softmax", "W_q", "W_k", "W_v", "LayerNorm",
      "embed_12", "pos_enc", "GELU", "dropout", "MLP", "head_3",
      "logits", "cross_attn", "W_o", "residual", "tok_42",
      "dim_768", "ctx_8k", "top_p", "temp_0.7", "beam_4",
      "KV_cache", "RoPE", "SwiGLU", "RMSNorm", "loss_fn",
      "grad_∇", "Adam_w", "lr_3e-4", "batch_32", "seq_2048",
      "vocab_32k", "d_model", "n_head_12", "ε=1e-5", "cos_sim",
      "QKV", "mask_causal", "proj_out", "scale_√d", "BPE_tok",
      "h_state", "z_latent", "μ_prior", "σ_post", "x_input",
      "y_pred", "∂L/∂w", "tanh", "sigmoid", "relu",
      "conv_1d", "pool_avg", "fc_256", "bias_0.1", "norm_batch",
    ];
    const rngLabel = seededRandom(77);
    for (let i = 0; i < points.length; i++) {
      if (rngLabel() > 0.4) continue;

      const label = nodeLabels[i % nodeLabels.length];
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 32;
      const ctx = canvas.getContext("2d")!;
      ctx.font = "11px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillText(label, 2, 14);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.copy(points[i]);
      sprite.position.x += 0.08;
      sprite.position.y -= 0.02;
      sprite.scale.set(0.8, 0.2, 1);
      group.add(sprite);
    }

    // Generate connections
    const connections = generateConnections(points, 1.8);

    // Build neighbor lookup: node index → list of neighbor node indices
    const neighborMap = new Map<number, number[]>();
    for (const [a, b] of connections) {
      if (!neighborMap.has(a)) neighborMap.set(a, []);
      if (!neighborMap.has(b)) neighborMap.set(b, []);
      neighborMap.get(a)!.push(b);
      neighborMap.get(b)!.push(a);
    }

    // Create base connection lines (subtle grey)
    const baseMaterial = new THREE.LineBasicMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.35,
    });

    for (const [i, j] of connections) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        points[i],
        points[j],
      ]);
      const line = new THREE.Line(geometry, baseMaterial);
      group.add(line);
    }

    // Highlight group
    const highlightGroup = new THREE.Group();
    group.add(highlightGroup);

    const state: SceneState = {
      scene,
      camera,
      renderer,
      group,
      connections,
      neighborMap,
      highlightGroup,
      points,
      nodeMeshes,
      nodeGlows,
      animationId: 0,
      activeHighlights: [],
      lastTokenCount: 0,
      disposed: false,
    };

    sceneRef.current = state;

    // Animation loop
    const clock = new THREE.Clock();

    function animate() {
      if (state.disposed) return;
      state.animationId = requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();

      // Slow rotation
      state.group.rotation.y = elapsed * 0.1;
      state.group.rotation.x = Math.sin(elapsed * 0.05) * 0.15;

      // Reset all nodes to default colour
      for (let i = 0; i < state.nodeMeshes.length; i++) {
        (state.nodeMeshes[i].material as THREE.MeshBasicMaterial).color.setHex(0xcccccc);
        (state.nodeGlows[i].material as THREE.MeshBasicMaterial).opacity = 0.12;
        (state.nodeGlows[i].material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
      }

      // Track which nodes are active this frame
      const activeNodeStrength = new Map<number, number>();

      // Update highlights - fade out over time
      const now = performance.now();
      const toRemove: number[] = [];

      for (let i = 0; i < state.activeHighlights.length; i++) {
        const h = state.activeHighlights[i];
        const age = now - h.birth;
        const progress = age / h.lifetime;

        if (progress >= 1) {
          toRemove.push(i);
          state.highlightGroup.remove(h.line);
          state.highlightGroup.remove(h.tube);
          h.line.geometry.dispose();
          (h.line.material as THREE.Material).dispose();
          h.tube.geometry.dispose();
          (h.tube.material as THREE.Material).dispose();
        } else if (progress < 0) {
          h.line.geometry.setDrawRange(0, 0);
          h.tube.visible = false;
        } else {
          const travelEnd = 0.15;
          h.tube.visible = true;

          // Lightning color: starts white-hot, transitions to red as it fades
          // 0% = pure white, ~15% = bright pink, ~40%+ = deep red, then fades out
          const colorProgress = Math.min(progress * 3, 1); // 0→1 over first 33%
          const lineMat = h.line.material as THREE.LineBasicMaterial;
          const tubeMat = h.tube.material as THREE.MeshBasicMaterial;

          // Lerp from white (1,1,1) → hot pink (1,0.2,0.3) → deep red (0.8,0.1,0.15)
          const r = 1.0;
          const g = 1.0 - colorProgress * 0.85;
          const b = 1.0 - colorProgress * 0.75;
          lineMat.color.setRGB(r, g, b);
          tubeMat.color.setRGB(r, g, b);

          if (progress < travelEnd) {
            const travelProgress = progress / travelEnd;
            const vertsToDraw = Math.ceil(travelProgress * h.segmentCount) + 1;
            h.line.geometry.setDrawRange(0, vertsToDraw);
            lineMat.opacity = 1.0;
            tubeMat.opacity = 1.0;
          } else {
            h.line.geometry.setDrawRange(0, h.segmentCount + 1);
            const fadeProgress = (progress - travelEnd) / (1 - travelEnd);
            const fade = 1.0 - fadeProgress * fadeProgress;
            lineMat.opacity = fade;
            tubeMat.opacity = fade;
          }

          // Track connected nodes
          const opacity = progress < travelEnd ? 1.0 : 1.0 - ((progress - travelEnd) / (1 - travelEnd)) ** 2;
          const strength = Math.max(0, opacity);
          for (const ni of h.nodeIndices) {
            const prev = activeNodeStrength.get(ni) ?? 0;
            activeNodeStrength.set(ni, Math.max(prev, strength));
          }
        }
      }

      // Apply glow to active nodes
      for (const [ni, strength] of activeNodeStrength) {
        const nodeMat = state.nodeMeshes[ni].material as THREE.MeshBasicMaterial;
        const glowMat = state.nodeGlows[ni].material as THREE.MeshBasicMaterial;
        // Lerp from grey toward pink-red
        nodeMat.color.setRGB(
          0.8 + strength * 0.2,
          0.8 - strength * 0.3,
          0.8 - strength * 0.2
        );
        glowMat.color.setHSL(0.95, 1, 0.55 + 0.35 * strength);
        glowMat.opacity = 0.12 + strength * 0.5;
      }

      for (let i = toRemove.length - 1; i >= 0; i--) {
        state.activeHighlights.splice(toRemove[i], 1);
      }

      renderer.render(scene, camera);
    }

    animate();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (state.disposed || !container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      state.camera.aspect = w / h;
      state.camera.updateProjectionMatrix();
      state.renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      state.disposed = true;
      cancelAnimationFrame(state.animationId);
      resizeObserver.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  // Handle streaming - add highlights when new tokens arrive
  useEffect(() => {
    const state = sceneRef.current;
    if (!state || state.disposed) return;

    if (isStreaming && tokenCount > state.lastTokenCount) {
      const newTokens = tokenCount - state.lastTokenCount;
      state.lastTokenCount = tokenCount;

      // Start 1-2 chain paths per token
      const numChains = Math.min(newTokens, 2);
      const SEGMENTS = 20;
      const CHAIN_LENGTH = 4 + Math.floor(Math.random() * 4); // 4-7 hops per chain
      const LINK_LIFETIME = 500 + Math.random() * 300;
      // Travel portion of lifetime — next link starts when travel finishes
      const travelDuration = LINK_LIFETIME * 0.15;

      for (let c = 0; c < numChains; c++) {
        // Pick random starting connection
        const startIdx = Math.floor(Math.random() * state.connections.length);
        let [fromNode, toNode] = state.connections[startIdx];

        for (let hop = 0; hop < CHAIN_LENGTH; hop++) {
          const start = state.points[fromNode];
          const end = state.points[toNode];

          const color = new THREE.Color().setHSL(
            0.95 + Math.random() * 0.05, 1, 0.55
          );

          const segPoints: THREE.Vector3[] = [];
          for (let s = 0; s <= SEGMENTS; s++) {
            const t = s / SEGMENTS;
            segPoints.push(
              new THREE.Vector3(
                start.x + (end.x - start.x) * t,
                start.y + (end.y - start.y) * t,
                start.z + (end.z - start.z) * t
              )
            );
          }

          const geometry = new THREE.BufferGeometry().setFromPoints(segPoints);
          geometry.setDrawRange(0, 0);
          const lineMat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 1.0,
          });
          const line = new THREE.Line(geometry, lineMat);
          state.highlightGroup.add(line);

          const path = new THREE.LineCurve3(start, end);
          const tubeGeo = new THREE.TubeGeometry(path, 1, 0.006, 4, false);
          const tubeMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 1.0,
          });
          const tube = new THREE.Mesh(tubeGeo, tubeMat);
          tube.visible = false;
          state.highlightGroup.add(tube);

          state.activeHighlights.push({
            line,
            tube,
            // Each hop starts when the previous hop's travel finishes
            birth: performance.now() + hop * travelDuration,
            lifetime: LINK_LIFETIME,
            nodeIndices: [fromNode, toNode],
            segmentCount: SEGMENTS,
          });

          // Chain: next hop starts from the end node
          const neighbors = state.neighborMap.get(toNode);
          if (!neighbors || neighbors.length === 0) break;
          // Pick a random neighbor that isn't where we came from
          const candidates = neighbors.filter((n) => n !== fromNode);
          const next =
            candidates.length > 0
              ? candidates[Math.floor(Math.random() * candidates.length)]
              : neighbors[Math.floor(Math.random() * neighbors.length)];
          fromNode = toNode;
          toNode = next;
        }
      }
    }

    if (!isStreaming) {
      state.lastTokenCount = 0;
    }
  }, [isStreaming, tokenCount]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: "100vh" }}
    />
  );
}
