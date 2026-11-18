"use client";

import { useId, useState } from "react";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { faqItems } from "./faq-content";

type FaqItemProps = {
  question: string;
  answer: string;
  initiallyOpen: boolean;
};

function FaqItem({ question, answer, initiallyOpen }: FaqItemProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const id = useId();

  return (
    <div className="faq-item" data-open={open}>
      <h3>
        <button
          id={`${id}-question`}
          type="button"
          className="faq-question"
          aria-expanded={open}
          aria-controls={`${id}-answer`}
          onClick={() => setOpen(current => !current)}
        >
          <span>{question}</span>
          <span className="faq-toggle-icon" aria-hidden="true"><Plus className="faq-plus" size={19} strokeWidth={1.8} /><Minus className="faq-minus" size={19} strokeWidth={1.8} /></span>
        </button>
      </h3>
      <div className="faq-answer" id={`${id}-answer`} role="region" aria-labelledby={`${id}-question`} aria-hidden={!open} inert={!open}>
        <div><p>{answer}</p></div>
      </div>
    </div>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="faq-section section-anchor" aria-labelledby="faq-title">
      <div className="page-container faq-layout">
        <div className="faq-introduction">
          <div className="section-heading"><h2 id="faq-title">Before your<br className="faq-heading-break" /> first renewal.</h2><p>A few things worth knowing before you bring your agency’s renewals into RenewRelay.</p></div>
          <div className="faq-clarity-note">
            <span className="faq-clarity-note__icon" aria-hidden="true"><Check size={18} strokeWidth={2} /></span>
            <p>Client decision.<br />Agency action.<br /><strong>Clear record.</strong></p>
            <ArrowRight className="faq-clarity-note__arrow" size={24} strokeWidth={1.5} aria-hidden="true" />
          </div>
        </div>
        <div className="faq-list">{faqItems.map((item, index) => <FaqItem key={item.id} question={item.question} answer={item.answer} initiallyOpen={index === 0} />)}</div>
      </div>
    </section>
  );
}
