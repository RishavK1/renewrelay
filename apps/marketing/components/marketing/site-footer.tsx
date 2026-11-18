import { ArrowUp, ArrowUpRight } from "lucide-react";

const footerGroups = [
  { title: "Product", links: [
    { label: "Overview", href: "#product" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
  ] },
  { title: "Explore", links: [
    { label: "Agency control", href: "#agency-control" },
    { label: "Questions & answers", href: "#faq" },
  ] },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-container footer-content">
        <div className="footer-top">
          <div className="footer-brand">
            <a className="footer-wordmark" href="#hero">RenewRelay</a>
            <p>A clearer process for your agency’s client renewals.</p>
          </div>
          {footerGroups.map(group => (
            <nav className="footer-group" aria-label={`Footer ${group.title.toLowerCase()}`} key={group.title}>
              <h2>{group.title}</h2>
              <ul>{group.links.map(link => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul>
            </nav>
          ))}
          <nav className="footer-group" aria-label="Footer company">
            <h2>Company</h2>
            <ul><li><a href="https://getvout.com" target="_blank" rel="noopener noreferrer">GetVout <ArrowUpRight size={15} aria-hidden="true" /></a></li><li><a href="#hero">Back to top <ArrowUp size={15} aria-hidden="true" /></a></li></ul>
          </nav>
        </div>
        <div className="footer-meta"><p>© {new Date().getUTCFullYear()} RenewRelay.</p><p>A product by <a href="https://getvout.com" target="_blank" rel="noopener noreferrer">GetVout</a></p></div>
      </div>
      <div className="footer-signature" aria-hidden="true">
        <svg viewBox="0 0 1200 214" fill="currentColor" focusable="false">
          <text x="0" y="184" textLength="1200" lengthAdjust="spacingAndGlyphs">RenewRelay</text>
        </svg>
      </div>
    </footer>
  );
}
