"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff, ArrowLeft, Check } from "lucide-react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; trailing?: ReactNode };

export function AuthField({ label, error, hint, trailing, id, ...input }: FieldProps) {
  const description = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="rr-auth__field">
      <div className="rr-auth__label-row"><label htmlFor={id}>{label}</label>{trailing}</div>
      <input {...input} id={id} aria-invalid={error ? true : undefined} aria-describedby={description} />
      {hint && <p className="rr-auth__hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="rr-auth__field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

export function PasswordField({ label = "Password", error, hint, id = "password", trailing, showToggleLabel = true, ...input }: FieldProps & { showToggleLabel?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="rr-auth__field">
      <div className="rr-auth__label-row"><label htmlFor={id}>{label}</label>{trailing}</div>
      <div className="rr-auth__password" data-show-label={showToggleLabel}>
        <input {...input} id={id} type={visible ? "text" : "password"} aria-invalid={error ? true : undefined} aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined} />
        <button type="button" onClick={() => setVisible(previous => !previous)} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-controls={id} aria-pressed={visible}>
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          {showToggleLabel && <span aria-hidden="true">{visible ? "Hide" : "Show"}</span>}
        </button>
      </div>
      {hint && <p className="rr-auth__hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="rr-auth__field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

export function AuthNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className="rr-auth__notice" data-error={error} role={error ? "alert" : "status"}>{children}</div>;
}

export function AuthHeading({ title, children }: { title: string; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [title]);
  return <div className="rr-auth__heading"><h1 ref={heading} tabIndex={-1}>{title}</h1><p>{children}</p></div>;
}

export function AuthBack({ href = "/login", children = "Back to log in" }: { href?: string; children?: ReactNode }) {
  return <a className="rr-auth__back" href={href}><ArrowLeft size={16} aria-hidden="true" />{children}</a>;
}

export function AuthSuccessMark() {
  return <span className="rr-auth__success-mark" aria-hidden="true"><Check size={28} strokeWidth={1.7} /></span>;
}
