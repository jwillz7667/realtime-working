"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X, Activity, Home, PhoneCall, FileText, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: PhoneCall },
  { href: "/events", label: "Events", icon: Activity },
  { href: "/recordings", label: "Recordings", icon: FileText },
] as const;

const TopBar = () => {
  const [open, setOpen] = useState(false);

  const handleNavigate = () => {
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 sm:px-6 py-3">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={handleNavigate}>
          <Image
            src="/logo/Verbio-logo-trans.svg"
            alt="Verbio Logo"
            width={150}
            height={32}
            className="h-7 w-auto dark:hidden"
            priority
          />
          <Image
            src="/logo/Verbio-logo-trans-dark.svg"
            alt="Verbio Logo"
            width={150}
            height={32}
            className="hidden h-7 w-auto dark:block"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-4 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
          <Link
            href="https://platform.openai.com/docs/guides/realtime"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <BookOpen className="h-4 w-4" />
            Docs
          </Link>
          <div className="flex items-center gap-3 pl-3">
            <ThemeToggle />
            <Button asChild size="sm" className="h-9 px-4">
              <Link href="/signup">Invite teammate</Link>
            </Button>
          </div>
        </nav>

        <div className="flex items-center gap-3 lg:hidden">
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
        <div className="border-t border-foreground/10 bg-background/95 shadow-lg shadow-black/10 lg:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 sm:px-6 py-6">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="inline-flex items-center gap-3 rounded-xl border border-foreground/10 px-4 py-3 text-base font-medium text-foreground/80 transition hover:border-primary/40 hover:text-foreground"
                onClick={handleNavigate}
              >
                <link.icon className="h-5 w-5" />
                {link.label}
              </Link>
            ))}
            <Link
              href="https://platform.openai.com/docs/guides/realtime"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-xl border border-foreground/10 px-4 py-3 text-base font-medium text-foreground/80 transition hover:border-primary/40 hover:text-foreground"
              onClick={handleNavigate}
            >
              <BookOpen className="h-5 w-5" />
              Realtime Docs
            </Link>
            <Button asChild size="lg" className="h-11">
              <Link href="/signup" onClick={handleNavigate}>
                Invite teammate
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};

export default TopBar;
