"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Activity, BookOpen, FileText } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

const TopBar = () => {
  return (
    <div className="flex justify-between items-center px-3 sm:px-6 py-3 sm:py-4 border-b">
      <div className="flex items-center gap-2 sm:gap-4">
        <Image
          src="/logo/Verbio-logo-trans.svg"
          alt="Verbio Logo"
          width={180}
          height={32}
          className="h-6 sm:h-8 w-auto dark:hidden"
          priority
        />
        <Image
          src="/logo/Verbio-logo-trans-dark.svg"
          alt="Verbio Logo"
          width={180}
          height={32}
          className="h-6 sm:h-8 w-auto hidden dark:block"
          priority
        />
      </div>
      <div className="flex gap-1 sm:gap-3">
        <Button variant="ghost" size="sm" className="px-2 sm:px-3">
          <Link href="/events" className="flex items-center gap-1 sm:gap-2">
            <Activity className="w-4 h-4" />
            <span className="hidden md:inline">Events</span>
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="px-2 sm:px-3">
          <Link href="/recordings" className="flex items-center gap-1 sm:gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden md:inline">Recordings</span>
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="px-2 sm:px-3 hidden sm:flex">
          <Link
            href="https://platform.openai.com/docs/guides/realtime"
            className="flex items-center gap-1 sm:gap-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden md:inline">Documentation</span>
          </Link>
        </Button>
        <ThemeToggle />
      </div>
    </div>
  );
};

export default TopBar;
