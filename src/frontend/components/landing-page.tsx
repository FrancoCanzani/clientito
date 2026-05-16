import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";

const atmosphereStyles = {
  image: {
    backgroundImage: 'url("/crystal-atmosphere-hero-v2.png")',
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
    filter: "saturate(1.02) contrast(1.08)",
    transform: "scale(1.02)",
  },
  veil: {
    background:
      "radial-gradient(circle at 54% 18%, rgba(255, 248, 237, 0.1), transparent 24%), linear-gradient(180deg, rgba(6, 10, 18, 0.16), rgba(6, 8, 14, 0.3))",
  },
  segmentation: {
    background:
      "linear-gradient(90deg, rgba(6, 10, 18, 0.68) 0%, rgba(6, 10, 18, 0.68) 9%, transparent 9%, transparent 18%, rgba(6, 10, 18, 0.34) 18%, rgba(6, 10, 18, 0.34) 22%, transparent 22%, transparent 36%, rgba(6, 10, 18, 0.22) 36%, rgba(6, 10, 18, 0.22) 39%, transparent 39%, transparent 61%, rgba(6, 10, 18, 0.22) 61%, rgba(6, 10, 18, 0.22) 64%, transparent 64%, transparent 78%, rgba(6, 10, 18, 0.34) 78%, rgba(6, 10, 18, 0.34) 82%, transparent 82%, transparent 91%, rgba(6, 10, 18, 0.68) 91%, rgba(6, 10, 18, 0.68) 100%)",
    mixBlendMode: "multiply",
  },
  beams: {
    background:
      "linear-gradient(102deg, transparent 26%, rgba(106, 153, 255, 0.06) 35%, rgba(180, 214, 255, 0.3) 43%, transparent 52%), linear-gradient(83deg, transparent 46%, rgba(255, 214, 162, 0.08) 52%, rgba(255, 240, 220, 0.4) 57%, transparent 64%), linear-gradient(76deg, transparent 58%, rgba(211, 187, 255, 0.08) 66%, rgba(205, 229, 255, 0.22) 72%, transparent 80%)",
    mixBlendMode: "screen",
  },
  mist: {
    background:
      "radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.16), transparent 26%), radial-gradient(circle at 50% 100%, rgba(0, 0, 0, 0.2), transparent 42%)",
    backdropFilter: "blur(0.8px)",
  },
} satisfies Record<string, CSSProperties>;

function BlueprintGeometry() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full text-[rgba(232,238,246,0.18)] mix-blend-screen"
      fill="none"
    >
      <g stroke="currentColor" strokeWidth="1" opacity="0.34">
        <path d="M720 90V810" />
        <path d="M260 450H1180" />
        <path d="M446 744 720 126 994 744" />
        <path d="M370 744H1070" />
        <circle cx="720" cy="450" r="266" />
        <circle cx="720" cy="450" r="198" />
      </g>

      <g stroke="currentColor" strokeWidth="1" strokeDasharray="2 10" opacity="0.28">
        <path d="M214 150h150" />
        <path d="M1076 150h150" />
        <path d="M214 750h150" />
        <path d="M1076 750h150" />
        <path d="M282 128v44" />
        <path d="M1144 128v44" />
        <path d="M282 728v44" />
        <path d="M1144 728v44" />
      </g>
    </svg>
  );
}

function GlassArch() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 520 720"
      className="absolute left-1/2 top-1/2 h-[min(76vh,44rem)] w-[min(52vw,32rem)] -translate-x-1/2 -translate-y-1/2 overflow-visible"
      fill="none"
    >
      <defs>
        <linearGradient id="archStroke" x1="92" y1="88" x2="426" y2="630">
          <stop stopColor="rgba(255,255,255,.18)" />
          <stop offset=".18" stopColor="rgba(150,185,255,.6)" />
          <stop offset=".42" stopColor="rgba(255,220,170,.48)" />
          <stop offset=".68" stopColor="rgba(171,224,208,.42)" />
          <stop offset="1" stopColor="rgba(222,192,235,.5)" />
        </linearGradient>
        <linearGradient id="archFill" x1="132" y1="120" x2="394" y2="640">
          <stop stopColor="rgba(255,255,255,.26)" />
          <stop offset=".42" stopColor="rgba(255,255,255,.1)" />
          <stop offset="1" stopColor="rgba(255,255,255,.03)" />
        </linearGradient>
        <filter id="archGlow" x="-30%" y="-20%" width="160%" height="150%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id="archSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>

      <path
        d="M104 638V330C104 197 172 96 260 54c88 42 156 143 156 276v308"
        stroke="url(#archStroke)"
        strokeWidth="26"
        opacity="0.28"
        filter="url(#archGlow)"
      />
      <path
        d="M116 638V336C116 213 178 117 260 76c82 41 144 137 144 260v302"
        fill="url(#archFill)"
        stroke="url(#archStroke)"
        strokeWidth="1.8"
        opacity="0.68"
        filter="url(#archSoft)"
      />
      <path
        d="M156 638V350C156 243 198 159 260 120c62 39 104 123 104 230v288"
        stroke="rgba(255,255,255,0.36)"
        strokeWidth="1.2"
        opacity="0.72"
      />
      <path d="M260 118V638" stroke="rgba(255,255,255,0.36)" strokeWidth="1.2" opacity="0.42" />
      <path d="M144 382H376" stroke="rgba(255,255,255,0.36)" strokeWidth="1.2" opacity="0.42" />
    </svg>
  );
}

export function LandingPage() {
  return (
    <main
      aria-label="Abstract crystal atmosphere"
      className="relative isolate min-h-screen overflow-hidden bg-[#f4efe9]"
    >
      <div className="absolute inset-0" style={atmosphereStyles.image} />
      <div className="absolute inset-0" style={atmosphereStyles.veil} />
      <div className="absolute inset-0" style={atmosphereStyles.segmentation} />
      <div className="absolute inset-0" style={atmosphereStyles.beams} />
      <div className="absolute inset-0" style={atmosphereStyles.mist} />
      <BlueprintGeometry />
      <GlassArch />

      <div className="relative z-10 flex min-h-screen flex-col justify-between px-6 py-6 text-[rgba(245,242,238,0.9)] sm:px-10 sm:py-8">
        <header className="flex items-center justify-center">
          <p
            className="font-serif text-[1.7rem] tracking-[-0.04em]"
            style={{ textShadow: "0 1px 18px rgba(255,255,255,0.16)" }}
          >
            Duomo
          </p>
        </header>

        <section className="mx-auto flex max-w-3xl flex-col items-center pb-8 text-center sm:pb-10">
          <p className="mb-5 text-[0.62rem] uppercase tracking-[0.5em] text-[rgba(235,232,228,0.62)]">
            Email, clarified
          </p>
          <h1
            className="font-serif text-[clamp(2rem,4.6vw,4.1rem)] font-normal leading-[0.96] tracking-[-0.055em] text-[rgba(249,247,244,0.92)]"
            style={{ textShadow: "0 1px 24px rgba(255,255,255,0.14)" }}
          >
            An attention firewall for Gmail.
          </h1>
          <p
            className="mt-6 max-w-2xl text-sm leading-7 text-[rgba(239,235,231,0.74)] sm:text-base"
            style={{ textShadow: "0 1px 18px rgba(0,0,0,0.18)" }}
          >
            Screen unknown senders, turn important messages into work, and keep
            your inbox private with a local-first email client built on top of
            Gmail.
          </p>
          <Link
            to="/login"
            className="mt-8 inline-flex h-11 items-center justify-center rounded-full border border-white/30 bg-white/15 px-6 text-sm font-medium text-white/95 shadow-[0_18px_48px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-[14px] transition duration-200 hover:-translate-y-px hover:border-white/40 hover:bg-white/20"
          >
            Get started
          </Link>
        </section>
      </div>
    </main>
  );
}
