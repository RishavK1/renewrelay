"use client";

// Adapted from Aceternity Compare's two-layer reveal and divider.
// Reference: https://ui.aceternity.com/components/compare
import { useId, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronsLeftRight } from "lucide-react";

type CompareProps = {
  firstContent: ReactNode;
  secondContent: ReactNode;
  firstLabel: string;
  secondLabel: string;
};

export function Compare({ firstContent, secondContent, firstLabel, secondLabel }: CompareProps) {
  const id = useId();
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const reducedMotion = useReducedMotion();
  const transition = { duration: dragging || reducedMotion ? 0 : 0.18, ease: "easeOut" as const };

  return (
    <div className="renewal-compare">
      <div className="compare-labels" aria-hidden="true"><span>{firstLabel}</span><span>{secondLabel}</span></div>
      <div className="compare-desktop">
        <div className="compare-stage">
          <div className="compare-layer" aria-hidden="true">{secondContent}</div>
          <motion.div
            className="compare-layer compare-layer--front"
            aria-hidden="true"
            initial={false}
            animate={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
            transition={transition}
          >{firstContent}</motion.div>
          <motion.div className="compare-divider" aria-hidden="true" initial={false} animate={{ left: `${position}%` }} transition={transition}>
            <span className="compare-handle"><ChevronsLeftRight size={20} /></span>
          </motion.div>
          <label className="sr-only" htmlFor={`${id}-range`}>Compare scattered context with one renewal record</label>
          <input
            id={`${id}-range`}
            className="compare-range"
            type="range"
            min={0}
            max={100}
            step={1}
            value={position}
            aria-valuetext={position === 0 ? "One renewal record fully visible" : position === 100 ? "Scattered context fully visible" : `${position}% scattered context visible`}
            aria-describedby={`${id}-help`}
            onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            onLostPointerCapture={() => setDragging(false)}
            onChange={event => setPosition(Number(event.target.value))}
          />
        </div>
        <div className="compare-controls">
          <p id={`${id}-help`}>Drag to compare, or use the arrow keys.</p>
          <div>
            <button type="button" aria-pressed={position === 100} onClick={() => setPosition(100)}>View scattered context</button>
            <button type="button" aria-pressed={position === 0} onClick={() => setPosition(0)}>View renewal record</button>
          </div>
        </div>
      </div>
      <div className="compare-mobile" aria-hidden="true">
        <div><p className="compare-mobile__label">{firstLabel}</p>{firstContent}</div>
        <div><p className="compare-mobile__label">{secondLabel}</p>{secondContent}</div>
      </div>
    </div>
  );
}
