"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <nav aria-label="Navegação principal" className="mx-auto flex max-w-6xl items-center gap-5 px-6 py-4">
          <Link href="/" className="font-semibold">Nova geração</Link>
          <Link href="/configuracoes">Configurações</Link>
          <button type="button" onClick={signOut} className="ml-auto">Sair</button>
        </nav>
      </header>
      {children}
    </div>
  );
}
