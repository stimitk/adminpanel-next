"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { demoEnabled } from "../lib/demo-config";
import { usePathname } from "next/navigation";
import { adminNavigation, teacherNavigation } from "../lib/navigation";
import { portal } from "../lib/portal";
import { useAuth } from "./auth";
const paths: Record<string, string[]> = {
  dashboard: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"],
  grid: ["M3 3h18v18H3z", "M3 9h18M3 15h18M9 3v18M15 3v18"],
  trophy: [
    "M8 3h8v7a4 4 0 0 1-8 0V3Z",
    "M8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 14v6M8 21h8",
  ],
  plus: ["M12 5v14M5 12h14"],
  tag: ["M3 3h8l10 10-8 8L3 11V3Z", "M7 7h.01"],
  question: [
    "M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01",
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  ],
  chart: ["M4 3v17h17", "M8 16v-4M13 16V8M18 16V5"],
  upload: ["M12 16V3M7 8l5-5 5 5", "M4 16v5h16v-5"],
  building: ["M5 21V3h14v18M3 21h18M9 7h1M14 7h1M9 11h1M14 11h1M10 21v-5h4v5"],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M20 21v-2a4 4 0 0 0-3-4",
    "M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 3a4 4 0 0 1 0 8",
  ],
  file: ["M14 2H5v20h14V7l-5-5Z", "M14 2v5h5M8 12h8M8 16h8"],
  gift: [
    "M3 8h18v4H3zM5 12v9h14v-9M12 8v13",
    "M12 8H8a3 3 0 1 1 3-3l1 3ZM12 8h4a3 3 0 1 0-3-3l-1 3Z",
  ],
  image: ["M3 3h18v18H3z", "M3 16l6-6 5 5 3-3 4 4M16 7h.01"],
  alert: ["M12 3 2 21h20L12 3ZM12 9v5M12 17h.01"],
  help: [
    "M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01",
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  ],
  mail: ["M3 5h18v14H3zM3 5l9 8 9-8"],
  coin: [
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    "M15 8H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H9M12 6v12",
  ],
  settings: ["M4 7h16M4 17h16M8 4v6M16 14v6"],
  menu: ["M3 6h18M3 12h18M3 18h18"],
  logout: ["M9 4H4v16h5M14 8l4 4-4 4M8 12h10"],
};
export function Icon({ name }: { name: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(paths[name] || paths.file).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { profile, logout } = useAuth();
  const sections =
    portal.kind === "teacher" ? teacherNavigation : adminNavigation;
  return (
    <div className="portal-wrapper">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="portal-navigation"
        className={`portal-sidebar ${open ? "is-open" : ""}`}
      >
        <Link
          className="brand"
          href="/dashboard"
          onClick={() => setOpen(false)}
        >
          <img
            src="/brand/logo.png"
            alt={`kGamify ${portal.title}`}
            width="220"
            height="78"
          />
        </Link>
        <nav aria-label="Main navigation">
          {sections.map((section) => (
            <section className="nav-section" key={section.title}>
              <h2>{section.title}</h2>
              <ul>
                {section.items.map(([href, label, icon]) => (
                  <li key={`${href}-${label}`}>
                    <Link
                      href={href}
                      className={pathname === href ? "active" : ""}
                      aria-current={pathname === href ? "page" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <Icon name={icon} />
                      <span>{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
        <button className="logout" onClick={logout}>
          <Icon name="logout" /> Logout
        </button>
      </aside>
      <div className="portal-main">
        <header className="portal-header">
          <div className="header-title">
            <button
              className="menu-button secondary"
              aria-label="Toggle navigation"
              aria-controls="portal-navigation"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <Icon name="menu" />
            </button>
            <span>{portal.title}</span>
          </div>
          <Link className="profile-link" href="/account">
            <span className="avatar">
              {(profile?.name || profile?.username || "K")
                .slice(0, 1)
                .toUpperCase()}
            </span>
            <span>{profile?.name || profile?.username || "Account"}</span>
          </Link>
        </header>
        <main id="main-content" className="portal-content">
          {demoEnabled && profile?.email?.endsWith("@kgamify.test") && (
            <div className="notice notice-info" role="status">
              Demo mode · Sample data only. Changes reset when you reload.
            </div>
          )}
          {children}
        </main>
        <footer>kGamify · {portal.title}</footer>
      </div>
    </div>
  );
}
