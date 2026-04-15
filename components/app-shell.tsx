import Link from "next/link";

type AppShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({
  eyebrow,
  title,
  description,
  actions,
  children,
}: AppShellProps) {
  return (
    <main className="shell">
      <nav className="shell-nav" aria-label="Primary">
        <div className="brand-lockup">
          <div className="brand-badge" aria-hidden="true">
            H
          </div>
          <div className="brand-copy">
            <span className="brand-title">Hired</span>
            <span className="brand-subtitle">Human-reviewed application operating system</span>
          </div>
        </div>

        <div className="nav-links">
          <Link className="nav-link" href="/">
            Dashboard
          </Link>
          <Link className="nav-link" href="/sweep">
            Sweep
          </Link>
          <Link className="nav-link" href="/vault">
            Vault
          </Link>
          <Link className="nav-link" href="/jobs/new">
            New Job
          </Link>
          <Link className="nav-link" href="/settings">
            Settings
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        {actions ? <div className="hero-actions">{actions}</div> : null}
      </section>

      {children}
    </main>
  );
}
