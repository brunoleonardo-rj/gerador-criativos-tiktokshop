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
      <header className="sticky top-0 z-40 border-b border-[#e8e1dc] bg-white/90 backdrop-blur-xl">
        <nav aria-label="Navegação principal" className="mx-auto flex min-h-[4.5rem] max-w-[96rem] flex-wrap items-center gap-x-6 gap-y-2 px-4 sm:px-6">
          <Link href="/" className="mr-auto text-[1.05rem] font-extrabold tracking-[-0.025em] text-[#201a22]">Nova geração</Link>
          <Link href="/resultado" className="text-sm font-semibold text-[#514955] transition-colors hover:text-[#6f52d9]">Resultados</Link>
          <Link href="/configuracoes" className="text-sm font-semibold text-[#514955] transition-colors hover:text-[#6f52d9]">Configurações</Link>
          <button type="button" onClick={signOut} className="rounded-full border border-[#ded6d0] px-4 py-2 text-sm font-semibold text-[#514955] transition-colors hover:border-[#b9ace4] hover:bg-[#fbf9ff] hover:text-[#4f3c90]">Sair</button>
        </nav>
      </header>
      {children}
    </div>
  );
}
