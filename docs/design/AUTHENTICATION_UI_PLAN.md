# Authentication UI plan

18 November 2026. Proposed design and implementation sequence, following the
user's request to plan UI first. No authentication integration, runtime changes,
provider calls, deployment or push is authorized by this document.

## Direction and research

Use a focused RenewRelay authentication shell: Snow form surface, quiet Ink brand
panel, local Manrope and Sky accents. It should feel like entering the product
from the completed homepage, with fewer distractions and one clear primary task.

Sources reviewed on this date:

- [Mobbin login](https://mobbin.com/login): concise welcome, email-first entry,
  simple hierarchy. Its Google/email-link methods are not our backend contract.
- [Mobbin login documentation](https://help.mobbin.com/en/articles/691072):
  explains its multiple account-dependent methods. Borrow clarity, not methods.
- [shadcn authentication blocks](https://ui.shadcn.com/blocks/authentication):
  login-02 supplies the preferred two-column composition. Adapt the structure
  to our tokens, wider form and original brand panel; no unrelated stock photo.
- [Aceternity signup form](https://ui.aceternity.com/components/signup-form):
  useful input/label composition, but its demo fields and social buttons do not
  describe RenewRelay. Avoid cursor-following input glow and decorative motion.
- [W3C accessible authentication guidance](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html):
  support password managers and full paste; do not make people transcribe codes.

These are source/document reviews, not a rendered comparison or accessibility
certification. No paid block is required. Any actual source adoption must retain
its license/provenance; no new package is installed during planning.

## Layout and visual decisions

- At 1024px and above: 56% form column, 44% Ink panel; outer inset 20px,
  panel radius 28px, at least 32px between content and edges. Form max-width
  420px. Brand link at top left; form vertically balanced in the remaining space.
- Below 1024px: one Snow column, decorative panel hidden; max-width 440px,
  24px gutters (20px on narrow phones). Natural scrolling and min-height:100svh;
  no fixed-height form or keyboard-obscured submit action.
- Heading 36px desktop / 30px mobile, weight 650–700, line-height 1.15.
  Body/input text 16px, labels 14px, supporting text 14px with comfortable leading.
- Inputs 48px high, white, border #D8DFE5, 12px radius. Primary action 52px,
  shared Ink pill with Snow text and existing hover #102C48; cursor:pointer.
  Inline links use text emphasis/underline rather than circular hover fills.
- Visible focus uses an Ink outline separated by a Sky/white offset. Errors use
  text plus a semantic error border; success is stated in words, not color alone.
- Keep ordinary forms unboxed. Group recovery codes in one deliberate bordered
  surface. Lucide only for functional show/hide, copy and navigation controls.
- Aside copy: “A clearer way to manage client renewals.” Supporting line:
  “Keep renewal dates, client responses and your team’s next steps together.”
  Original tonal calendar-to-record composition with a small “Illustration” label,
  no fake customer endorsements or live-looking activity. Oversized low-contrast
  RenewRelay lettering anchors the lower panel. No recurring three-icon row.
- Motion: single 180–220ms opacity entrance, 150ms focus/hover feedback; state
  changes keep the form anchored and announce the result. No floating cards,
  looping carousel, parallax, WebGL, shaking errors or automatic form submission.
  Reduced motion removes entrances/transforms.
- No marketing sticky navbar or full footer. Keep brand/back navigation and the
  contextual login/signup link. Legal links require real approved destinations;
  do not copy Mobbin's legal sentence or invent consent/checkbox requirements.

## Screens, copy and states

| Route / view | Content and primary action | Required alternate states |
|---|---|---|
| /signup | “Create your account”; full name, email, password; “Create account”; link “Already have an account? Log in” | Required/invalid fields, password length, submitting, server rejection, rate limit, network retry; signup is not workspace creation |
| /login | “Welcome back”; “Log in to your RenewRelay account.”; email, password, “Forgot password?”, “Log in”; create-account link | Invalid credentials, email verification required, submitting, authenticator challenge, expired session, network/server/rate-limit states |
| /check-email | “Check your email”; submitted address, “Open the verification link to continue.”; “Resend verification email” | Sending/sent, retry limit, delivery-request failure; use another address returns to signup; no unsupported change-email API |
| /verify-email | “Email verified”; “Your email is verified. You can now log in.”; “Continue to log in” | Invalid/expired link with resend entry; loading during future callback resolution; never assume verification creates a session |
| /forgot-password | “Reset your password”; email; “Send reset link” | Neutral completion: “If an account exists for this email, you’ll receive a reset link.”; retry/network/rate-limit states |
| /reset-password | “Choose a new password”; new password, confirm password; “Save password” | Mismatch, length, invalid/expired/used link, pending, failure, success; “Password updated. Log in with your new password.” |
| /two-factor | “Verify it’s you”; “Enter the 6-digit code from your authenticator app.”; code; “Verify and continue” | Incorrect code, expired challenge, rate limit; “Use a recovery code” switches view; “Back to log in” restarts challenge |
| recovery-code variant | “Use a recovery code”; one text input; “Verify and continue”; return to authenticator | Invalid/already-used code, expired challenge, pending/network; no numeric-only formatting |
| /setup-authenticator | “Add an authenticator”; password confirmation, then locally generated QR + manual setup key, then 6-digit confirmation | Fresh-login requirement, invalid code, incomplete setup, pending/retry; setup becomes active only after successful verification |
| save-recovery-codes step | “Save your recovery codes”; single-use explanation, copy/download actions, explicit acknowledgement; “Continue” | Copy/download failure with selectable text fallback; keep codes in memory, never analytics/storage; expose actual codes only in the future app-origin integration |

For code entry, prefer one real input with six visual character positions,
inputMode=numeric and autocomplete=one-time-code. Full-code paste must work.
No six independently managed inputs, automatic submission, “resend authenticator
code”, email-code login or trusted-device checkbox.

Full name is one field, matching the backend's `name`. Email uses appropriate
autocomplete; login password uses current-password; signup/reset use new-password.
Show/hide has an accessible name and does not submit. Signup/reset passwords are
12–128 characters, matching runtime minimum and installed Better Auth maximum;
do not trim, silently truncate or invent uppercase/symbol rules. Confirm password
is UI validation only. Do not enforce signup's minimum on the login field before
the server has evaluated the credentials.

Validate on submit and revalidate affected fields after correction; associate
errors with inputs, focus the first invalid field, announce form-level results.
Disable duplicate submission while pending; preserve non-secret input on failure.
Keep password-manager and paste support. Reserve at least 44px touch targets.
Long emails and translated/zoomed text must wrap without horizontal overflow.

## Backend evidence and future integration contract

Inspected sources (not executed): apps/web/server/runtime.ts;
apps/web/app/api/auth/[...all]/route.ts; docs/BATCH4_API.md;
packages/domain/context.ts; packages/domain/workspaces.ts;
apps/web/server/http.ts; installed Better Auth sign-in, sign-up, email-verification,
password and two-factor modules. Existing test source was consulted for payloads;
no tests were run and behavior is not newly certified.

| UI operation | Existing backend support / constraint |
|---|---|
| Create account | POST /api/auth/sign-up/email with name, email, password and a validated app-origin callbackURL; verification is required and sent at signup |
| Log in | POST /api/auth/sign-in/email with email/password; inspect twoFactorRedirect before declaring success; challenge cookie is not a completed authenticated session |
| Resend verification | POST /api/auth/send-verification-email with email and validated callbackURL; verification link reaches GET /api/auth/verify-email; auto-sign-in after verification is not enabled |
| Password reset | POST /api/auth/request-password-reset with email/redirectTo; email link reaches GET /api/auth/reset-password/:token; app callback receives token or INVALID_TOKEN; POST /api/auth/reset-password with token/newPassword; reset revokes existing sessions |
| Authenticator challenge | POST /api/auth/two-factor/verify-totp with code and pending cookie; server records verified MFA after success |
| Recovery challenge | POST /api/auth/two-factor/verify-backup-code; backup codes are single-use; server records recovery |
| Enrollment | POST /api/auth/two-factor/enable with password returns totpURI/backupCodes; verify-totp completes activation; locally render QR, retain codes only in memory through the next step |
| Later security settings | get-totp-uri and generate-backup-codes are exposed; rotation/settings changes require a recent session (10 minutes) and verified MFA when already enabled; reauthentication must use the existing sign-in/challenge flow, not an invented password-verification endpoint |
| Session / logout | GET /api/auth/get-session; POST /api/auth/sign-out; host-scoped cookies, no localStorage bearer-token design |

No social providers, magic-link login, staff email-OTP MFA, SMS, passkeys, SSO,
trusted-device bypass or disable-MFA endpoint are configured/exposed for this V1.
Do not show those choices based on a component demo. Private client decision
verification is a separate scoped flow; it must not be mixed into staff login.

Future adapter must normalize Better Auth responses and custom
{error:{code,message,requestId}} responses, honor Retry-After and never claim
success after an unconfirmed request. No arbitrary fixed resend countdown or
promised token lifetime in copy. Callback/return destinations must be allowlisted
app routes, not unchecked external query URLs. Cookie credentials, Origin checks,
no-store handling and replacement cookies must remain intact when wiring.

## Post-authentication handoff

1. Verify real session and verified email. A query parameter saying “verified” is
   not authentication evidence. Completed email verification leads to login.
2. Finish a pending authenticator/recovery challenge if the sign-in response asks.
3. Resolve workspace access. Owners/admins require server-verified MFA; creating
   a workspace also requires it. Members without enabled MFA may continue without
   enrollment. MFA-enabled accounts must complete their challenge each sign-in.
4. Handle actual mfa_required responses: listWorkspaces itself can reject an
   account with an owner/admin membership before returning a list. Do not depend
   on fetching roles first or using client-side role guesses to bypass that gate.
5. An existing single workspace opens its product entry; multiple workspaces get
   a selector. No memberships leads to separate workspace onboarding (name and
   timezone). Its create call starts the 14-day trial; signup does not.
6. Preserve invitation context through signup, verification and login on the
   application origin. Accept is POST /api/v1/invites/accept with token, using
   existing write/idempotency conventions. Wrong email and unknown tokens are
   deliberately indistinguishable 404s; show “This invitation isn’t available
   for this account” with switch-account option, not an invented exact diagnosis.
   Expired/revoked invites use invite_unavailable; already_member, seat_limit and
   workspace access restrictions have distinct truthful outcomes. Do not invent
   a public invitation-preview API or reveal workspace metadata before access.
7. Subscription/read-only/removed-access outcomes are product access states, not
   bad-password errors. Authentication success must not imply billing eligibility.

## UI-first implementation boundary and sequence

Proposed reusable presentation modules: packages/ui/auth with AuthShell,
AuthField, PasswordField, CodeField, AuthNotice, LoginForm, SignupForm,
VerificationView, PasswordResetViews, TwoFactorViews and EnrollmentViews.
This is a planned folder, not an installed package or implemented inventory.
Components receive typed actions/results through props, with routing and backend
responses owned by adapters. They must not import server/runtime or initialize
Better Auth. Token/cookie handling stays outside presentation components.

For this UI phase only, mount local preview routes in apps/marketing under an
isolated (auth-preview) route group, using synthetic in-memory scenarios. No
real email-link tokens, invite tokens, sessions, QR secrets, credentials or
private records may enter this public marketing preview. No API fetches,
email sends, database calls, persistent credentials or simulated real sessions.
Preview outcomes must be visibly identified as previews, not “email sent” or
“account created” claims about a real operation. Use development-only scenario
controls to review failure/success states without putting technical controls in
the final product UI. Do not expose previews as deployed authentication.

Future integration mounts these same shared views in apps/web on the intended
app.renewrelay.getvout.com origin, alongside its existing auth APIs. Preview
wrappers are temporary; shared views need not be relocated. Marketing CTA links
eventually point to that app origin. Real auth cookies and callback tokens must
never be handled on the marketing origin. No domain/deployment changes now.

Build order when authorized:

1. Shared shell/fields plus login and signup, with all field/pending/error states.
2. Verification, forgot/reset-password and expired-link views.
3. Authenticator challenge, recovery and enrollment/code-save views.
4. Workspace/invitation handoff UI as a separate onboarding task.
5. Backend wiring later, explicitly scoped; revalidate the installed contract then.

User reviews locally. No tests, browser checks, build/type checks or live auth
requests were performed for this plan. All screen-level UI-01–UI-20 checks remain
NOT REVIEWED until actual screens and evidence exist. No production-readiness
signoff is implied. Legal destinations, live email delivery, callback origins and
integrated session/MFA behavior remain later implementation/review work.
