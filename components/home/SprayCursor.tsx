"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./CarsystemHomePage.module.css";

type Theme = "dark" | "light";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  decay: number;
  color: string;
};

type SpraySignal = {
  x: number;
  y: number;
  burst?: boolean;
};

const darkPalette = [
  "255, 255, 255",
  "143, 176, 218",
  "229, 50, 42",
  "178, 188, 202",
];

const lightPalette = [
  "16, 20, 28",
  "34, 76, 132",
  "196, 36, 30",
  "78, 90, 108",
];

function pickColor(theme: Theme) {
  const palette = theme === "dark" ? darkPalette : lightPalette;
  const roll = Math.random();

  if (roll < 0.45) return palette[0];
  if (roll < 0.72) return palette[1];
  if (roll < 0.9) return palette[3];
  return palette[2];
}

export function SprayCursor({ theme }: { theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const pointerRef = useRef({ x: -100, y: -100, lastX: -100, lastY: -100 });
  const frameRef = useRef<number | null>(null);
  const themeRef = useRef(theme);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const canRun = window.matchMedia(
      "(min-width: 861px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );

    function updateEnabled() {
      setEnabled(canRun.matches);
    }

    updateEnabled();
    canRun.addEventListener("change", updateEnabled);

    return () => canRun.removeEventListener("change", updateEnabled);
  }, []);

  useEffect(() => {
    if (!enabled) {
      particlesRef.current = [];
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const activeCanvas = canvas;
    const activeContext = context;

    const maxDpr = 2;
    let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    let lastTrailAt = 0;
    let lastBurstAt = 0;
    let lastBurstPoint = { x: -1000, y: -1000 };
    const listenerOptions: AddEventListenerOptions = { passive: true, capture: true };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      activeCanvas.width = Math.round(window.innerWidth * dpr);
      activeCanvas.height = Math.round(window.innerHeight * dpr);
      activeCanvas.style.width = `${window.innerWidth}px`;
      activeCanvas.style.height = `${window.innerHeight}px`;
      activeContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function addMist(x: number, y: number, count: number, burst = false) {
      const particles = particlesRef.current;
      const themeNow = themeRef.current;

      for (let index = 0; index < count; index += 1) {
        const angle = burst
          ? Math.random() * Math.PI * 2
          : -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
        const speed = burst ? 0.65 + Math.random() * 2.4 : 0.22 + Math.random() * 0.78;
        const driftX = burst ? 0 : (Math.random() - 0.5) * 0.7;

        particles.push({
          x: x + (Math.random() - 0.5) * (burst ? 12 : 8),
          y: y + (Math.random() - 0.5) * (burst ? 12 : 8),
          vx: Math.cos(angle) * speed + driftX,
          vy: Math.sin(angle) * speed + (burst ? 0 : 0.18),
          size: burst ? 1.1 + Math.random() * 3.4 : 0.7 + Math.random() * 1.5,
          life: burst ? 1.08 : 1,
          decay: burst ? 0.018 + Math.random() * 0.016 : 0.026 + Math.random() * 0.018,
          color: pickColor(themeNow),
        });
      }

      if (particles.length > 280) {
        particles.splice(0, particles.length - 280);
      }
    }

    function getEventPoint(event: PointerEvent | MouseEvent) {
      if (
        Number.isFinite(event.clientX) &&
        Number.isFinite(event.clientY) &&
        (event.clientX !== 0 || event.clientY !== 0)
      ) {
        return { x: event.clientX, y: event.clientY };
      }

      const current = pointerRef.current;
      if (current.x >= 0 && current.y >= 0) {
        return { x: current.x, y: current.y };
      }

      if (event.target instanceof Element) {
        const rect = event.target.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
        }
      }

      return {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
    }

    function addTrailAt(point: { x: number; y: number }) {
      pointerRef.current.x = point.x;
      pointerRef.current.y = point.y;

      const now = window.performance.now();
      const dx = point.x - pointerRef.current.lastX;
      const dy = point.y - pointerRef.current.lastY;
      const distance = Math.hypot(dx, dy);

      if (now - lastTrailAt > 22 || distance > 18) {
        lastTrailAt = now;
        pointerRef.current.lastX = point.x;
        pointerRef.current.lastY = point.y;
        addMist(point.x, point.y, distance > 38 ? 6 : 4);
      }
    }

    function addBurstAt(point: { x: number; y: number }) {
      const now = window.performance.now();
      const burstDistance = Math.hypot(point.x - lastBurstPoint.x, point.y - lastBurstPoint.y);

      if (now - lastBurstAt < 80 && burstDistance < 24) return;

      lastBurstAt = now;
      lastBurstPoint = point;
      addMist(point.x, point.y, 66, true);
    }

    function handlePointerMove(event: PointerEvent | MouseEvent) {
      addTrailAt(getEventPoint(event));
    }

    function handlePointerDown(event: PointerEvent | MouseEvent) {
      addBurstAt(getEventPoint(event));
    }

    function handleSpraySignal(event: Event) {
      const detail = (event as CustomEvent<SpraySignal>).detail;

      if (
        !detail ||
        !Number.isFinite(detail.x) ||
        !Number.isFinite(detail.y)
      ) {
        return;
      }

      const point = { x: detail.x, y: detail.y };

      if (detail.burst) {
        addBurstAt(point);
        return;
      }

      addTrailAt(point);
    }

    function render() {
      activeContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
      activeContext.globalCompositeOperation = "source-over";

      const particles = particlesRef.current;

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.985;
        particle.vy = particle.vy * 0.985 + 0.006;
        particle.life -= particle.decay;

        if (particle.life <= 0) {
          particles.splice(index, 1);
          continue;
        }

        const alpha = Math.max(0, Math.min(0.82, particle.life * 0.68));
        activeContext.beginPath();
        activeContext.fillStyle = `rgba(${particle.color}, ${alpha})`;
        activeContext.shadowBlur = particle.size > 1.8 ? 6 : 3;
        activeContext.shadowColor = `rgba(${particle.color}, ${alpha * 0.4})`;
        activeContext.arc(
          particle.x,
          particle.y,
          particle.size * (1.05 - particle.life * 0.15),
          0,
          Math.PI * 2,
        );
        activeContext.fill();
      }

      frameRef.current = window.requestAnimationFrame(render);
    }

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("pointermove", handlePointerMove, listenerOptions);
    document.addEventListener("pointerdown", handlePointerDown, listenerOptions);
    document.addEventListener("mousemove", handlePointerMove, listenerOptions);
    document.addEventListener("mousedown", handlePointerDown, listenerOptions);
    document.addEventListener("click", handlePointerDown, listenerOptions);
    window.addEventListener("click", handlePointerDown, listenerOptions);
    window.addEventListener("carsystem:spray", handleSpraySignal);
    frameRef.current = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("pointermove", handlePointerMove, listenerOptions);
      document.removeEventListener("pointerdown", handlePointerDown, listenerOptions);
      document.removeEventListener("mousemove", handlePointerMove, listenerOptions);
      document.removeEventListener("mousedown", handlePointerDown, listenerOptions);
      document.removeEventListener("click", handlePointerDown, listenerOptions);
      window.removeEventListener("click", handlePointerDown, listenerOptions);
      window.removeEventListener("carsystem:spray", handleSpraySignal);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      activeContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particlesRef.current = [];
    };
  }, [enabled]);

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.sprayCanvas} ${enabled ? styles.sprayCanvasActive : ""}`}
      aria-hidden="true"
    />
  );
}
