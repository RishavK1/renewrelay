"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { CyclingGlyph } from "./cycling-glyph";
import { PreviewAction } from "../ui/preview-action";
import { HeroBackground } from "./hero-background";

export function RenewalHero() {
  const [motionPaused, setMotionPaused] = useState(false);

  return (
    <section id="hero" className="renewal-hero" data-motion-paused={motionPaused} aria-labelledby="hero-title">
      <HeroBackground paused={motionPaused} />
      <div className="hero-content page-container">
        <h1 id="hero-title" className="hero-title">
          <span className="hero-title__line">
            Track <CyclingGlyph kind="renewal" /> client renewals.
          </span>{" "}
          <span className="hero-title__line">
            Get clear <CyclingGlyph kind="decision" /> decisions.
          </span>{" "}
          <span className="hero-title__line">
            Keep work <CyclingGlyph kind="progress" /> moving.
          </span>
        </h1>
        <p className="hero-description">
          For web agencies managing domains, hosting and ongoing services.
          Track renewal dates, collect client decisions and keep your team’s
          next steps in one place.
        </p>
        <div className="hero-actions">
          <PreviewAction>Start your free trial</PreviewAction>
          <a className="button button--secondary" href="#pricing">See plans</a>
        </div>
        <p className="hero-trial-note">
          <span>14-day trial</span><span className="note-divider" aria-hidden="true">·</span>{" "}
          <span>10 renewal items</span><span className="note-divider" aria-hidden="true">·</span>{" "}
          <span>3 team seats</span>
        </p>
      </div>
      <button
        type="button"
        className="motion-toggle"
        aria-pressed={motionPaused}
        onClick={() => setMotionPaused(paused => !paused)}
      >
        {motionPaused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
        {motionPaused ? "Resume motion" : "Pause motion"}
      </button>
    </section>
  );
}
