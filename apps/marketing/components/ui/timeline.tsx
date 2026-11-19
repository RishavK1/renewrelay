"use client";

// Adapted from Aceternity Timeline (official registry, 18 November 2026).
// Reference: https://ui.aceternity.com/components/timeline
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSafeReducedMotion } from "./use-motion-preference";
import { motion, useScroll, useTransform } from "motion/react";

type TimelineEntry = {
  id: string;
  label: string;
  title: string;
  description: string;
  content: ReactNode;
};

export function Timeline({ data }: { data: readonly TimelineEntry[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const reducedMotion = useSafeReducedMotion();
  const { scrollYProgress } = useScroll({ target: container, offset: ["start 70%", "end 60%"] });
  const progressHeight = useTransform(scrollYProgress, [0, 1], [0, height]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = () => setHeight(element.getBoundingClientRect().height);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={container} className="workflow-timeline">
      <ol className="workflow-timeline__steps">
      {data.map((entry, index) => (
        <li className="workflow-step" key={entry.id}>
          <span className="workflow-step__marker" aria-hidden="true">{index + 1}</span>
          <div className="workflow-step__copy">
            <p className="workflow-step__label">{entry.label}</p>
            <h3>{entry.title}</h3>
            <p className="workflow-step__description">{entry.description}</p>
          </div>
          <div className="workflow-step__visual">{entry.content}</div>
        </li>
      ))}
      </ol>
      <div className="timeline-decoration" aria-hidden="true">
        <span className="workflow-rail" />
        {!reducedMotion && <motion.span className="workflow-rail__progress" style={{ height: progressHeight }} />}
      </div>
    </div>
  );
}
