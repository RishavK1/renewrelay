"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { PreviewAction } from "../ui/preview-action";

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <a className="navigation-link" href="#product" onClick={onNavigate}>Product</a>
      <a className="navigation-link" href="#how-it-works" onClick={onNavigate}>How it works</a>
      <a className="navigation-link" href="#pricing" onClick={onNavigate}>Pricing</a>
    </>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTrial, setShowTrial] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let frame: number | undefined;
    const sync = () => {
      frame = undefined;
      // Separate thresholds avoid flicker as the compact header changes page height.
      const y = Math.max(0, window.scrollY);
      setScrolled(previous => previous ? y > 8 : y > 64);
    };
    const onScroll = () => { if (frame === undefined) frame = window.requestAnimationFrame(sync); };
    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const heroActions = document.querySelector("#hero .hero-actions");
    const headerElement = header.current;
    if (!heroActions || !headerElement) return;

    // Reveal only after the hero action has passed above the sticky header.
    // Being below the initial viewport must not trigger the header CTA.
    let observer: IntersectionObserver | undefined;
    const reconnect = () => {
      observer?.disconnect();
      const height = headerElement.getBoundingClientRect().height;
      const sync = () => setShowTrial(heroActions.getBoundingClientRect().bottom <= height);
      observer = new IntersectionObserver(sync, { rootMargin: `-${height}px 0px 0px 0px`, threshold: [0, 1] });
      observer.observe(heroActions);
      sync();
    };
    const resizeObserver = new ResizeObserver(reconnect);
    resizeObserver.observe(headerElement);
    return () => { observer?.disconnect(); resizeObserver.disconnect(); };
  }, []);

  useEffect(() => {
    const breakpoint = window.matchMedia("(min-width: 960px)");
    const closeOnDesktop = () => {
      if (breakpoint.matches) setMenuOpen(false);
    };
    breakpoint.addEventListener("change", closeOnDesktop);
    return () => breakpoint.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header ref={header} className="site-header" data-scrolled={showTrial} data-elevated={scrolled}>
      <div className="site-header__inner page-container">
        <div className="header-brand-navigation">
          <a className="wordmark" href="/" aria-label="RenewRelay home">RenewRelay</a>
          <nav className="desktop-navigation" aria-label="Main navigation"><NavigationLinks /></nav>
        </div>
        <div className="header-actions">
          <PreviewAction href="/login" variant="quiet" compact className="login-action">Log in</PreviewAction>
          <div className="sticky-trial" aria-hidden={!showTrial} inert={!showTrial}>
            <PreviewAction compact>Start free trial</PreviewAction>
          </div>
          <button
            ref={menuButton}
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen(open => !open)}
          >
            {menuOpen ? <X size={22} strokeWidth={2} aria-hidden="true" /> : <Menu size={22} strokeWidth={2} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav id="mobile-navigation" className="mobile-navigation page-container" aria-label="Mobile navigation" hidden={!menuOpen}>
        <NavigationLinks onNavigate={() => setMenuOpen(false)} />
        <PreviewAction compact>Start free trial</PreviewAction>
      </nav>
    </header>
  );
}
