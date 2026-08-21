import { LoginForm } from "@/features/auth/login-form";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-sm space-y-6" aria-labelledby="login-title">
        <div>
          <p className="text-sm font-medium">TikTok Shop</p>
          <h1 id="login-title" className="text-3xl font-semibold">Estúdio de Criativos</h1>
          <p className="text-muted-foreground">Entre para acessar o espaço de trabalho.</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
