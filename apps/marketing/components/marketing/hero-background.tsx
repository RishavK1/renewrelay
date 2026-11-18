"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";

const BackgroundCubesGrid = dynamic(
  () => import("../ui/background-cubes-grid").then(module => module.BackgroundCubesGrid),
  { ssr: false, loading: () => null },
);

/** Decoration must never take the page down when a device cannot create WebGL. */
class DecorationBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function HeroBackground({ paused = false }: { paused?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [animate, setAnimate] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    // Mobile, touch and reduced-motion visitors retain the static local texture.
    const capable = window.matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let inView = true;
    const sync = () => setAnimate(capable.matches && inView && !document.hidden);
    const observer = new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting);
      sync();
    });
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    observer.observe(element);
    capable.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    element.addEventListener("webglcontextlost", onContextLost, true);
    sync();
    return () => {
      observer.disconnect();
      capable.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      element.removeEventListener("webglcontextlost", onContextLost, true);
    };
  }, []);

  return (
    <div ref={container} className="hero-background" aria-hidden="true">
      <div className="hero-background__static" />
      {animate && !contextLost && !paused && (
        <DecorationBoundary>
          <BackgroundCubesGrid
            variant="isometric"
            cellSize={136}
            gap={0.016}
            topColor="#FCFBF8"
            leftColor="#DFE9F1"
            rightColor="#C8DBEA"
            glowColor="#C3DFFE"
            glow={0.42}
            amplitude={0.5}
            idleRipples={false}
          />
        </DecorationBoundary>
      )}
      <div className="hero-background__mask" />
    </div>
  );
}
