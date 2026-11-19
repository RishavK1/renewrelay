"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { requiresDecisionReopen } from "./action-policy";
import { verifyDecision } from "../../contracts/decisions";
import { AuthField, AuthNotice, AuthSuccessMark } from "../auth/auth-fields";
import { displayMoney } from "../renewals/money";
import { renewalDate } from "../renewals/renewal-views";
import { sessionResponse, type DecisionTerms, type PublicDecisionAction, type SessionResponse } from "./contracts";
import { useDecisionAction } from "./use-preview-action";

const choices = { approve: { title: "Approve renewal", detail: "Ask the team to proceed with the quoted renewal." }, cancel: { title: "Do not renew", detail: "Ask the team not to renew this service." }, question: { title: "Ask a question", detail: "Get clarification before making your decision." } };
export function ClientDecision({ terms, action, preview = false }: { terms: DecisionTerms; action: PublicDecisionAction; preview?: boolean }) {
  const [stage, setStage] = useState<"start" | "code" | "choose" | "review">("start");
  const [code, setCode] = useState("");
  const [choice, setChoice] = useState<SessionResponse["choice"]>("approve");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<SessionResponse["choice"] | null>(null);
  const [resendUntil, setResendUntil] = useState(0);
  const [resend, setResend] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const state = useDecisionAction(action, command => command.operation === "respond", command => command.operation);
  const terminal = !!state.failure && requiresDecisionReopen(state.failure.code);
  const locked = state.pending || !!state.frozen || terminal;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [stage, receipt, terminal]);
  useEffect(() => { if (!resendUntil) return; const sync = () => setResend(Math.max(0, Math.ceil((resendUntil - Date.now()) / 1000))); sync(); const timer = setInterval(sync, 1000); return () => clearInterval(timer); }, [resendUntil]);
  function limited(operation: string) { return state.remaining > 0 && state.limitedOperation === operation; }
  async function sendCode() {
    const result = await state.run({ operation: "start-code" });
    if (result?.status === "success" && result.kind === "code-started") { setStage("code"); setCode(""); setResendUntil(Date.now() + 60000); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault(); if (locked) return;
    const parsed = verifyDecision.shape.code.safeParse(code);
    if (!parsed.success) { setError("Enter the 6-digit code from your email."); return; }
    setError(""); const result = await state.run({ operation: "verify-code", code: parsed.data });
    if (result?.status === "success" && result.kind === "verified") { setCode(""); setStage("choose"); }
  }
  async function respond() {
    const parsed = sessionResponse.safeParse({ expectedVersion: terms.version, choice, ...(choice === "question" ? { question } : {}) });
    if (!parsed.success) { setError("Add a question between 1 and 1,000 characters."); setStage("choose"); return; }
    setError(""); const result = await state.run({ operation: "respond", input: parsed.data });
    if (result?.status === "success" && result.kind === "responded") { setReceipt(result.response.choice); setQuestion(""); }
    if (result?.status === "error" && result.code === "otp_required") { setCode(""); setStage("code"); }
  }
  const title = receipt ? receipt === "question" ? "Your question is recorded" : "Your instruction is recorded" : terms.decided ? "A decision is already recorded" : terminal ? "This request needs to be reopened" : stage === "start" || stage === "code" ? "Review your renewal" : stage === "review" ? "Confirm your response" : "What would you like to do?";
  return <div className="rr-client-decision"><header className="rr-client-decision__header"><span className="rr-client-decision__brand">RenewRelay</span>{preview && <span className="rr-client-decision__preview">UI preview</span>}</header><main id="main-content" className="rr-client-decision__main">
    <p className="rr-client-decision__issuer">Renewal request from {terms.issuer}</p><h1 ref={heading} tabIndex={-1}>{title}</h1>
    <section className="rr-client-decision__terms" aria-label="Requested renewal terms"><div className="rr-client-decision__service"><h2>{terms.service}</h2><strong>{displayMoney(terms.amountMinor, terms.currency)}</strong></div><p>{terms.term}</p><dl><div><dt>Respond by</dt><dd>{renewalDate(terms.respondBy)}</dd></div><div><dt>Service expiry</dt><dd>{renewalDate(terms.expiryOn)}</dd></div><div><dt>Provider notice date</dt><dd>{renewalDate(terms.noticeBy)}</dd></div></dl><small>Dates use {terms.timezone}. Request revision {terms.revision}.</small>{terms.note && <div className="rr-client-decision__message"><h3>Note from the team</h3><p>{terms.note}</p></div>}</section>
    <section className="rr-client-decision__action" aria-label="Respond to request" aria-busy={state.pending}>
      {receipt ? <><AuthSuccessMark /><h2>{receipt === "question" ? "The team can now review your question." : choices[receipt].title}</h2><p>{receipt === "question" ? "You can still make a final decision after getting clarification." : "Your team still needs to handle the provider action. This response does not renew or cancel the service automatically."}</p>{receipt === "question" && <button type="button" className="rr-decision__primary" onClick={() => { setReceipt(null); setStage("choose"); }}>Back to request</button>}</> : terms.decided ? <p>Contact the team that sent this request if you need to discuss the recorded decision.</p> : terminal ? <p>Open the latest request from your email. If it is still unavailable, contact the team that sent it.</p> : stage === "start" ? <><h2>Verify your email to respond</h2><p>We’ll send a code to the email address this request was issued to.</p><button className="rr-decision__primary" type="button" onClick={sendCode} disabled={locked || limited("start-code")}>{state.pending ? "Requesting code…" : limited("start-code") ? `Try again in ${state.remaining}s` : "Send verification code"}</button><button className="rr-decision__text" type="button" disabled={state.pending} onClick={() => { state.clearFailure(); setStage("code"); }}>I already have a code</button></> : stage === "code" ? <><h2>Enter your email code</h2><p>Use the latest code sent for this request. {preview ? "For this preview, enter any 6 digits. No email is sent." : "If it hasn’t arrived, check your spam folder."}</p><form onSubmit={verify} noValidate><AuthField id="decision-code" label="Verification code" value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} readOnly={locked} error={error} onChange={event => { setCode(event.target.value.replace(/\D/g, "")); setError(""); }} /><button className="rr-decision__primary" type="submit" disabled={locked || limited("verify-code")}>{state.pending ? "Verifying…" : limited("verify-code") ? `Try again in ${state.remaining}s` : "Verify and continue"}</button></form><button className="rr-decision__text" type="button" disabled={locked || resend > 0 || limited("start-code")} onClick={sendCode}>{resend > 0 ? `Request another code in ${resend}s` : limited("start-code") ? `Try again in ${state.remaining}s` : "Request another code"}</button></> : stage === "choose" ? <><fieldset disabled={locked}><legend>Your response</legend>{(Object.keys(choices) as SessionResponse["choice"][]).map(value => <label className="rr-client-decision__choice" key={value}><input type="radio" name="decision" value={value} checked={choice === value} onChange={() => { setChoice(value); setError(""); }} /><span><strong>{choices[value].title}</strong><small>{choices[value].detail}</small></span></label>)}</fieldset>{choice === "question" && <div className="rr-auth__field"><label htmlFor="client-question">Your question</label><textarea id="client-question" rows={4} maxLength={1000} value={question} readOnly={locked} onChange={event => { setQuestion(event.target.value); setError(""); }} aria-describedby={error ? "decision-question-error" : undefined} aria-invalid={error ? true : undefined} /></div>}{error && <p id="decision-question-error" className="rr-auth__field-error" role="alert">{error}</p>}<button className="rr-decision__primary" type="button" disabled={locked} onClick={() => { if (choice === "question" && !question.trim()) { setError("Add your question before continuing."); return; } setError(""); setStage("review"); }}>Review response</button></> : <><h2>{choices[choice].title}</h2>{choice === "question" ? <blockquote>{question}</blockquote> : <p>{choice === "approve" ? "You’re asking the team to proceed with the renewal at the quote and term shown above." : "You’re asking the team not to renew this service. The team must handle any provider cancellation separately."}</p>}<button className="rr-decision__primary" type="button" disabled={state.pending || terminal || limited("respond")} onClick={respond}>{state.pending ? "Recording…" : limited("respond") ? `Try again in ${state.remaining}s` : state.frozen ? "Retry original response" : choice === "question" ? "Send question" : "Confirm instruction"}</button><button className="rr-decision__text" type="button" disabled={locked} onClick={() => setStage("choose")}>Edit response</button></>}
      {state.failure && !receipt && <AuthNotice error>{state.failure.message}{state.frozen && <p>Your original response is held for retry. Its choice and terms stay unchanged.</p>}</AuthNotice>}
    </section><p className="rr-client-decision__footnote">Client instructions, provider actions and agency invoicing are recorded separately.</p>
  </main></div>;
}
