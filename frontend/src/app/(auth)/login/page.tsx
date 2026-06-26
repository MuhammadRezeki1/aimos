import Image from "next/image";
import { LoginForm } from "../../../components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-bg" aria-hidden="true">
        <span className="auth-bg-ring auth-bg-ring-1" />
        <span className="auth-bg-ring auth-bg-ring-2" />
        <span className="auth-bg-ring auth-bg-ring-3" />
        <span className="auth-bg-triangle" />
        <span className="auth-bg-circle" />
        <span className="auth-bg-glow" />
      </div>

      <section className="auth-panel" aria-label="AIMOS login">
        <Image
          className="auth-card-logo"
          src="/brand/login-card.png"
          alt="AIMOS Intelligence Monitor"
          width={866}
          height={288}
          priority
        />
        <div className="auth-content">
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in to AIMOS</h1>
          <p className="auth-subtitle">
            Monitor social data, summarize conversations, and analyze public signals from one clean dashboard.
          </p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
