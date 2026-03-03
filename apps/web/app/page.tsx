const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getStores(): Promise<string[]> {
  const res = await fetch(`${API}/stores`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { stores: string[] };
  return data.stores;
}

export default async function Home() {
  const stores = await getStores();

  return (
    <main className="shell">
      <section className="hero">
        <p className="kicker">Cliparr</p>
        <h1>Automated coupon clipping across stores.</h1>
        <p className="sub">One dashboard. Scheduled runs. Plugin-powered store support.</p>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Supported Stores</h2>
          <ul>
            {stores.map((store) => (
              <li key={store}>{store}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Health</h2>
          <p>Scheduler and worker run continuously in containerized services.</p>
          <p>Daily jobs enqueue based on cron and process asynchronously.</p>
        </article>
      </section>
    </main>
  );
}
