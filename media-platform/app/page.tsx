import Link from "next/link";
import { getPublicPlans } from "../src/lib/plans-db";
import { BILLING_TERMS, termPrice } from "../src/config/terms";

function gb(bytes: number) {
  return Math.round(Number(bytes) / 1024 ** 3);
}

export default async function Home() {
  const plans = await getPublicPlans();

  return (
    <main className="wrap">
      <nav className="nav">
        <div className="brand">Mkety Media</div>
        <div>
          <Link href="/login">Login</Link>
          <Link className="btn" href="/signup">Get started</Link>
        </div>
      </nav>

      <section className="hero">
        <h1>Upload once. Get fast links. Keep your media simple.</h1>
        <p>Managed image, video and file storage with cached delivery, straightforward limits and one clean dashboard.</p>
      </section>

      <section>
        <h2>Plans</h2>
        <p className="muted">Monthly, 3-month, 6-month and yearly billing. Longer terms receive a small discount.</p>
        <div className="grid plans">
          {plans.map((plan: any) => (
            <article className="card" key={plan.code}>
              <h3>{plan.name}</h3>
              <div className="price">
                {"$"}{Number(plan.monthly_usd).toFixed(0)}
                <span className="muted" style={{fontSize:14}}>/mo</span>
              </div>
              <ul className="features">
                <li>{gb(plan.storage_bytes)} GB storage</li>
                <li>{gb(plan.delivery_bytes)} GB delivery</li>
                <li>{Number(plan.delivery_requests).toLocaleString()} delivery requests</li>
                <li>{plan.logical_buckets} buckets</li>
                <li>{plan.team_seats} team seat{Number(plan.team_seats) === 1 ? "" : "s"}</li>
                <li>Images, video and files</li>
                <li>Cached Mkety delivery links</li>
                <li>Usage and limit dashboard</li>
                <li>Secure direct uploads</li>
                <li>Preview, rename, move and delete</li>
                <li>Payment and renewal controls</li>
                {plan.dedicated_storage_eligible && <li>Regional or dedicated infrastructure eligibility</li>}
              </ul>

              <Link className="btn" href={"/signup?plan=" + plan.code}>
                Choose {plan.name}
              </Link>

              <div style={{marginTop:14}} className="muted">
                {BILLING_TERMS.filter((term) => term.months > 1).map((term) => (
                  <div key={term.months}>
                    {term.label}: {"$"}{termPrice(Number(plan.monthly_usd), term.months).toFixed(2)} ({term.discountPercent}% off)
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Need custom limits?</h2>
        <p>Enterprise accounts can use any exact limits, billing terms, regional placement or dedicated infrastructure while keeping the same simple Mkety Media dashboard.</p>
      </section>
    </main>
  );
}
