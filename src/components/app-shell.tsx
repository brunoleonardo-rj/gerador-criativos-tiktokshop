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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-[#e6ded6] bg-white/85 backdrop-blur">
        <nav aria-label="Navegação principal" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 sm:px-6">
          <Link href="/" className="font-semibold tracking-tight">Nova geração</Link>
          <Link href="/configuracoes" className="text-[#514955] hover:text-[#6f52d9]">Configurações</Link>
          <button type="button" onClick={signOut} className="ml-auto rounded-md px-3 py-2 text-sm font-semibold text-[#514955] hover:bg-[#fff6f3] hover:text-[#201a22]">Sair</button>
        </nav>
      </header>
      {children}
    </div>
  );
}
