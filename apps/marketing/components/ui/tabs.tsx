"use client";

// Adapted from Aceternity Animated Tabs (official registry, 18 November 2026).
// Source and deliberate changes: docs/design/FRONTEND_SOURCES.md.
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";

export type Tab = {
  title: string;
  value: string;
  content: ReactNode;
  caption: string;
};

export function Tabs({ tabs, label }: { tabs: readonly Tab[]; label: string }) {
  const id = useId();
  const [active, setActive] = useState(tabs[0]?.value);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const reducedMotion = useReducedMotion();

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = index === last ? 0 : index + 1; break;
      case "ArrowLeft": next = index === 0 ? last : index - 1; break;
      case "Home": next = 0; break;
      case "End": next = last; break;
      default: return;
    }
    event.preventDefault();
    setFocusedIndex(next);
    buttons.current[next]?.focus();
  }

  return (
    <LayoutGroup id={id}>
      <div className="preview-tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            key={tab.value}
            ref={node => { buttons.current[index] = node; }}
            type="button"
            role="tab"
            id={`${id}-tab-${tab.value}`}
            aria-controls={`${id}-panel-${tab.value}`}
            aria-selected={active === tab.value}
            tabIndex={focusedIndex === index ? 0 : -1}
            onFocus={() => setFocusedIndex(index)}
            onKeyDown={event => moveFocus(event, index)}
            onClick={() => setActive(tab.value)}
            className="preview-tab"
          >
            {active === tab.value && (
              <motion.span
                layoutId="active-tab"
                className="preview-tab__indicator"
                transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
              />
            )}
            <span className="preview-tab__label">{tab.title}</span>
          </button>
        ))}
      </div>
      <div className="preview-panels">
        {tabs.map(tab => {
          const selected = active === tab.value;
          return (
            <motion.div
              key={tab.value}
              role="tabpanel"
              id={`${id}-panel-${tab.value}`}
              aria-labelledby={`${id}-tab-${tab.value}`}
              aria-hidden={!selected}
              inert={!selected}
              tabIndex={selected ? 0 : -1}
              className="preview-panel"
              style={{ visibility: selected ? "visible" : "hidden" }}
              initial={false}
              animate={{ opacity: selected ? 1 : 0, y: selected || reducedMotion ? 0 : 4 }}
              transition={{ duration: reducedMotion ? 0 : 0.18, ease: "easeOut" }}
            >
              {tab.content}
              <p className="preview-panel__caption">{tab.caption}</p>
            </motion.div>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
