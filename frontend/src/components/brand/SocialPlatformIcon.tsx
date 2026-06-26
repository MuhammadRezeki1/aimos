import type { SocialPlatform } from "@/lib/backendApi";

export function SocialPlatformIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="7" y="7" width="18" height="18" rx="6" />
        <circle cx="16" cy="16" r="4.2" />
        <circle cx="21.2" cy="10.9" r="1.4" />
      </svg>
    );
  }

  if (platform === "twitter") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M9 7h4.5l9.8 18H18.8L9 7Zm1.6 18 11-18h-2.4l-11 18h2.4Z" />
      </svg>
    );
  }

  if (platform === "facebook") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M18.2 27V17h3.1l.5-3.9h-3.6v-2.2c0-1.1.4-1.9 2-1.9h1.8V5.5c-.9-.1-1.9-.2-2.8-.2-3.6 0-6 2.2-6 6.2v1.6h-3.1V17h3.1v10h5Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M19.2 6c.5 3.5 2.5 5.5 5.8 5.9v4.1a9.1 9.1 0 0 1-5.6-1.8v6.6c0 4.1-2.8 7.2-7 7.2-3.5 0-6.4-2.4-6.4-6.1 0-4.5 4.2-7 8.3-5.9v4.4c-1.5-.8-3.8-.2-3.8 1.7 0 1.2 1 2 2.2 2 1.5 0 2.4-1 2.4-2.7V6h4.1Z" />
    </svg>
  );
}
