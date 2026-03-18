import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useState } from "react";

type SenderAvatarProps = {
  name: string | null;
  email: string;
  avatarUrl: string | null;
  className?: string;
  fallbackClassName?: string;
};

function getInitials(name: string | null, email: string): string {
  const source = name?.trim() || email.trim();
  const parts = source
    .split(/[\s@._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getFullDomain(email: string): string | null {
  const [, domain = ""] = email.trim().split("@");
  const normalized = domain.toLowerCase().trim();
  return normalized || null;
}

function getBaseDomain(email: string): string | null {
  const domain = getFullDomain(email);
  if (!domain) {
    return null;
  }

  const parts = domain.split(".").filter(Boolean);
  if (parts.length <= 2) {
    return domain;
  }

  const secondToLast = parts[parts.length - 2];
  const multipartPrefixes = new Set(["co", "com", "org", "net", "edu", "gov"]);

  if (multipartPrefixes.has(secondToLast) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}

function buildDomainImageCandidates(email: string): string[] {
  const fullDomain = getFullDomain(email);
  const baseDomain = getBaseDomain(email);
  const domains = Array.from(
    new Set(
      [fullDomain, baseDomain, baseDomain ? `www.${baseDomain}` : null].filter(Boolean),
    ),
  );

  const urls: string[] = [];

  for (const domain of domains) {
    urls.push(`https://logo.clearbit.com/${domain}`);
  }

  for (const domain of domains) {
    urls.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
  }

  const paths = ["/favicon.ico", "/apple-touch-icon.png", "/apple-touch-icon-precomposed.png"];

  for (const domain of domains) {
    for (const path of paths) {
      urls.push(`https://${domain}${path}`);
    }
  }

  return urls;
}

export function SenderAvatar({
  name,
  email,
  avatarUrl,
  className,
  fallbackClassName,
}: SenderAvatarProps) {
  const initials = getInitials(name, email);
  const imageCandidates = avatarUrl
    ? [avatarUrl, ...buildDomainImageCandidates(email)]
    : buildDomainImageCandidates(email);
  const resetKey = `${avatarUrl ?? ""}|${email.toLowerCase()}`;

  return (
    <Avatar
      className={cn(
        "size-9 bg-muted text-xs font-medium text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      <SenderAvatarContent
        key={resetKey}
        imageCandidates={imageCandidates}
        alt={name?.trim() || email}
        initials={initials}
        fallbackClassName={fallbackClassName}
      />
    </Avatar>
  );
}

function SenderAvatarContent({
  imageCandidates,
  alt,
  initials,
  fallbackClassName,
}: {
  imageCandidates: string[];
  alt: string;
  initials: string;
  fallbackClassName?: string;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const imageSrc = imageCandidates[imageIndex] ?? null;

  if (!imageSrc) {
    return (
      <AvatarFallback
        className={cn(
          "size-full select-none rounded-full bg-muted font-semibold text-muted-foreground",
          fallbackClassName,
        )}
      >
        {initials}
      </AvatarFallback>
    );
  }

  return (
    <img
      key={imageSrc}
      src={imageSrc}
      alt={alt}
      className="size-full rounded-full object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        setImageIndex((current) => current + 1);
      }}
    />
  );
}
