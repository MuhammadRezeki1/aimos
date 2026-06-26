"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { DUMMY_CREDENTIALS } from "@/constants/dummyCredentials";
import { saveSession, validateLogin } from "@/lib/auth";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("aimos123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!validateLogin({ username, password })) {
      setError("Invalid username or password. Use the temporary hardcoded credential.");
      return;
    }

    saveSession(username);
    router.replace("/");
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <div className="login-hint">
        <span className="form-icon form-icon-shield" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img">
            <path d="M12 3.2 19 6v5.4c0 4.5-2.8 7.9-7 9.4-4.2-1.5-7-4.9-7-9.4V6l7-2.8Z" />
            <path d="M12 8v7M8.8 11.5h6.4" />
          </svg>
        </span>
        Temporary credential: <strong>{DUMMY_CREDENTIALS.username}</strong> / <strong>{DUMMY_CREDENTIALS.password}</strong>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="field">
        <label htmlFor="username">Username</label>
        <div className="input-shell">
          <span className="form-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img">
              <path d="M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Z" />
              <path d="M4.8 20c.9-3.8 3.4-5.7 7.2-5.7s6.3 1.9 7.2 5.7" />
            </svg>
          </span>
          <input
            id="username"
            className="input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter username"
            autoComplete="username"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <div className="input-shell">
          <span className="form-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img">
              <path d="M7 10V8.1C7 5.4 9 3.5 12 3.5s5 1.9 5 4.6V10" />
              <path d="M6.5 10h11c.8 0 1.5.7 1.5 1.5V19c0 .8-.7 1.5-1.5 1.5h-11C5.7 20.5 5 19.8 5 19v-7.5c0-.8.7-1.5 1.5-1.5Z" />
            </svg>
          </span>
          <input
            id="password"
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" role="img">
                <path d="M2.8 12s3.3-5.2 9.2-5.2 9.2 5.2 9.2 5.2-3.3 5.2-9.2 5.2S2.8 12 2.8 12Z" />
                <path d="M12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z" />
                <path d="M4 4l16 16" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" role="img">
                <path d="M2.8 12s3.3-5.2 9.2-5.2 9.2 5.2 9.2 5.2-3.3 5.2-9.2 5.2S2.8 12 2.8 12Z" />
                <path d="M12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <button className="btn btn-primary" type="submit">
        Sign in <span aria-hidden="true">&rarr;</span>
      </button>

      <div className="secure-workspace">
        <span className="form-icon form-icon-shield" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img">
            <path d="M12 3.2 19 6v5.4c0 4.5-2.8 7.9-7 9.4-4.2-1.5-7-4.9-7-9.4V6l7-2.8Z" />
            <path d="M12 8v7M8.8 11.5h6.4" />
          </svg>
        </span>
        Secure workspace
      </div>
    </form>
  );
}
