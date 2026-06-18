import { AppShell } from "@/components/app-shell";

type RouteLoadingProps = {
  roomSlug?: string;
  title?: string;
};

export function RouteLoading({ roomSlug, title = "Loading" }: RouteLoadingProps) {
  return (
    <AppShell roomName="Gam3bling" roomSlug={roomSlug}>
      <section className="hero-card loading-hero" aria-busy="true" aria-labelledby="route-loading-title">
        <p className="eyebrow">Gam3bling</p>
        <h1 id="route-loading-title">{title}</h1>
        <div className="loading-lines" aria-hidden="true">
          <span />
          <span />
        </div>
      </section>

      <section className="section-stack loading-stack" aria-hidden="true">
        <div className="loading-heading">
          <span />
          <span />
        </div>
        <div className="loading-card" />
        <div className="loading-card compact" />
        <div className="loading-card compact" />
      </section>
    </AppShell>
  );
}
