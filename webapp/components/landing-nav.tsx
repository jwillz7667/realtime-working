"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

type NavLink = {
  href: string;
  label: string;
  external?: boolean;
};

const navLinks: NavLink[] = [
  { href: "#overview", label: "Overview" },
  { href: "#features", label: "Features" },
  { href: "/dashboard", label: "Live Console" },
  {
    href: "https://platform.openai.com/docs/guides/realtime",
    label: "Realtime Docs",
    external: true,
  },
] as const;

export default function LandingNav() {
  const [open, setOpen] = useState(false);

  const handleNavigate = () => {
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="#overview" className="flex items-center gap-3" onClick={handleNavigate}>
          <Image
            src="/logo/Verbio-logo-trans.svg"
            alt="Verbio"
            width={160}
            height={32}
            className="h-8 w-auto dark:hidden"
            priority
          />
          <Image
            src="/logo/Verbio-logo-trans-dark.svg"
            alt="Verbio"
            width={160}
            height={32}
            className="hidden h-8 w-auto dark:block"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-foreground transition hover:text-primary">
              Log in
            </Link>
            <Button asChild size="sm" className="h-9 px-4">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </nav>

        <div className="flex items-center gap-3 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Toggle navigation"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/20"
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-foreground/10 bg-background/95 shadow-lg shadow-black/10 md:hidden">
          <div className="flex flex-col gap-4 px-6 py-6">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="text-base font-medium text-foreground/80 transition hover:text-foreground"
                onClick={handleNavigate}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 border-t border-foreground/10 pt-4">
              <Link
                href="/login"
                className="text-base font-medium text-foreground/80 transition hover:text-foreground"
                onClick={handleNavigate}
              >
                Log in
              </Link>
              <Button asChild size="lg" className="h-11">
                <Link href="/signup" onClick={handleNavigate}>
                  Get started
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
