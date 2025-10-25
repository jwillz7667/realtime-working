import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import LandingNav from "@/components/landing-nav";

const features = [
  {
    icon: Sparkles,
    title: "Realtime AI Voice",
    description:
      "Blend ultra-low latency speech with contextual memory so every conversation feels human.",
  },
  {
    icon: Waves,
    title: "Twilio Native",
    description:
      "Orchestrate inbound and outbound calls directly from Twilio while streaming updates live.",
  },
  {
    icon: ShieldCheck,
    title: "Production Ready",
    description:
      "Role-based access, audit-grade logging, and secure prompt management included by default.",
  },
] as const;

const stats = [
  { label: "Avg. response latency", value: "280 ms" },
  { label: "On-call resolution rate", value: "92%" },
  { label: "Deployment time", value: "< 10 min" },
] as const;

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <section id="overview" className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute inset-y-0 right-0 h-full w-1/2 bg-gradient-to-l from-black/70 via-black/30 to-transparent" />
        </div>
        <div className="mx-auto flex w-full max-w-6xl items-center gap-12 px-6 py-20 sm:py-24 lg:py-28">
          <div className="relative z-10 flex-1 space-y-8">
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-px w-10 bg-muted-foreground/40" />
              Voice Intelligence Reimagined
            </div>
            <div className="space-y-6">
              <Image
                src="/logo/Verbio-logo-trans.svg"
                alt="Verbio"
                width={220}
                height={40}
                className="h-10 w-auto dark:hidden"
                priority
              />
              <Image
                src="/logo/Verbio-logo-trans-dark.svg"
                alt="Verbio"
                width={220}
                height={40}
                className="hidden h-10 w-auto dark:block"
                priority
              />
              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Launch a next-gen realtime call assistant in minutes.
              </h1>
              <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
                Verbio Call Assistant fuses OpenAI’s Realtime API with Twilio enterprise telephony,
                delivering a fully programmable voice agent that feels natural, stays on brand, and
                closes loops instantly.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="h-12 px-8 text-base">
                <Link href="/signup" className="flex items-center gap-2">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base border-foreground/20"
                asChild
              >
                <Link href="/dashboard">Launch dashboard</Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-foreground/10 bg-background/60 p-4">
                  <div className="text-2xl font-semibold">{stat.value}</div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative hidden flex-1 lg:flex">
            <div className="relative ml-auto h-[520px] w-[440px] rounded-3xl border border-foreground/10 bg-gradient-to-br from-white to-black/10 p-6 shadow-2xl shadow-black/20 dark:from-zinc-900 dark:to-black/40">
              <div className="rounded-2xl border border-foreground/10 bg-background/80 p-6 backdrop-blur">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Live Transcript</p>
                    <h3 className="text-lg font-semibold">“Thanks for calling Verbio”</h3>
                  </div>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="rounded-lg border border-foreground/10 bg-background/80 p-3">
                      <p className="font-medium text-foreground">Assistant</p>
                      <p>Hi Alex, I can confirm your reservation and send the recap via SMS—does that work?</p>
                    </div>
                    <div className="rounded-lg border border-foreground/10 bg-background/80 p-3">
                      <p className="font-medium text-foreground">Customer</p>
                      <p>Perfect. Can you also add late checkout if it’s available?</p>
                    </div>
                    <div className="rounded-lg border border-foreground/10 bg-background/80 p-3">
                      <p className="font-medium text-foreground">Assistant</p>
                      <p>Already requested. You’ll receive confirmation in under a minute.</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-foreground/10 bg-foreground text-background p-4">
                    <div className="text-xs uppercase tracking-[0.3em]">Session Update</div>
                    <div className="mt-2 text-sm opacity-90">
                      <p>• Sent CRM follow-up via webhook</p>
                      <p>• Triggered SMS summary via Twilio</p>
                      <p>• Logged call outcome in Supabase</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/10" />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-20">
        <div className="max-w-3xl space-y-4">
          <h2 className="text-3xl font-semibold sm:text-4xl">Engineered for teams shipping voice AI now.</h2>
          <p className="text-base text-muted-foreground sm:text-lg">
            Every module is ready to customize—auth, prompt management, event logging, and a realtime dashboard
            tuned for operational clarity.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-background/70 p-6 transition hover:border-foreground/30"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground/10 bg-muted">
                <feature.icon className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
              <Link
                href="/dashboard"
                className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-foreground/80 transition group-hover:text-foreground"
              >
                Explore live console
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section
        id="get-started"
        className="border-y bg-black text-white dark:bg-black dark:text-white"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold sm:text-3xl">Ready to orchestrate your first AI-powered call?</h3>
            <p className="text-sm text-white/70">
              Deploy locally, stream events securely through the websocket relay, and confirm recordings end-to-end.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="h-11 px-6 text-base">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="lg" className="h-11 px-6 text-base bg-white text-black hover:bg-white/90">
              <Link href="/signup">Create account</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
