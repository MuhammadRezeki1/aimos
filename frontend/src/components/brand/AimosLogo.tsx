import Image from "next/image";
import Link from "next/link";

export function AimosLogo() {
  return (
    <Link href="/" className="brand-logo" aria-label="AIMOS home">
      <Image
        className="auth-logo"
        src="/brand/login-card.png"
        alt="AIMOS logo"
        width={866}
        height={288}
        priority
      />
    </Link>
  );
}
