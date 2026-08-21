export default function Home() {
  return (
    <main className="landing-page">
      <section className="landing-hero" aria-labelledby="studio-title">
        <p className="eyebrow">TikTok Shop</p>
        <h1 id="studio-title">Estúdio de Criativos</h1>
        <p className="intro">
          Transforme um produto em um briefing pronto para gravar, conectando
          referências e uma direção clara em um fluxo simples.
        </p>
        <article className="flow-card" aria-label="Fluxo de criação">
          <span>01</span>
          <strong>Produto → Referências → Direção</strong>
          <p>Comece pelo que você vende e chegue a uma proposta criativa consistente.</p>
        </article>
      </section>
    </main>
  );
}
