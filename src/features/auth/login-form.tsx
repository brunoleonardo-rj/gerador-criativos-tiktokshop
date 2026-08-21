"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FAILURE_MESSAGE = "Credenciais inválidas ou acesso temporariamente bloqueado";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        setError(FAILURE_MESSAGE);
        return;
      }
      const next = searchParams.get("next");
      router.replace(next?.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError(FAILURE_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="w-full max-w-sm space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="username">Usuário</Label>
        <Input id="username" name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <Button className="w-full" type="submit" disabled={submitting}>
        {submitting ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
