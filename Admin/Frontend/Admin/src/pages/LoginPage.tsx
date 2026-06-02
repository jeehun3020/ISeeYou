import { useState } from "react";
import type { FormEvent } from "react";

import { ADMIN_AUTH_API, setAdminToken } from "../api/adminApi";
import "../css/LoginPage.css";

type Props = {
  onLoginSuccess: () => void;
};

export default function LoginPage({ onLoginSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${ADMIN_AUTH_API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error("관리자 아이디 또는 비밀번호가 올바르지 않습니다.");
      }

      const data = (await response.json()) as { access_token: string };
      setAdminToken(data.access_token);
      onLoginSuccess();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-card" aria-labelledby="admin-login-title">
        <div className="login-brand">
          <span className="login-brand-mark">I SEE YOU</span>
          <span className="login-brand-subtitle">Admin Console</span>
        </div>

        <div className="login-header">
          <p className="login-kicker">관리자 로그인</p>
          <h1 id="admin-login-title">분석 기록과 운영 상태를 확인합니다.</h1>
          <p>
            저장된 분석 요청, 모델 판정 결과, 처리 로그를 안전하게 검토하기 위한
            관리자 전용 화면입니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="admin-username">아이디</label>
            <input
              id="admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="관리자 아이디"
              autoComplete="username"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="admin-password">비밀번호</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              autoComplete="current-password"
              required
            />
          </div>

          {errorMessage ? <div className="login-error">{errorMessage}</div> : null}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "로그인 확인 중..." : "관리자 화면 열기"}
          </button>
        </form>
      </section>
    </div>
  );
}
