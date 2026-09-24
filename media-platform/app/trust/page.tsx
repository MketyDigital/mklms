import Link from "next/link";

export const dynamic="force-dynamic";

export default function TrustPage(){
  const rows=[
    ["Storage architecture","Mkety Media uses managed, highly durable object-storage infrastructure selected by service tier. Standard storage is strongly consistent and designed for eleven-nines annual durability with redundant copies across storage hardware and data centres within a geographic region."],
    ["Replication & durability","Redundancy is provided by the underlying storage infrastructure. Standard plans do not promise customer-controlled multi-region replication. Regional or dedicated placement can be agreed for Enterprise accounts where available."],
    ["Backups & retention","Standard plans include infrastructure redundancy, not a separate point-in-time backup service. Enterprise customers can request retention/deletion-protection or separate backup/migration arrangements as part of their order."],
    ["Availability","The standard storage layer is backed by infrastructure with a 99.9% availability SLA. Mkety does not advertise a separate contractual customer SLA unless it is included in an Enterprise agreement."],
    ["Encryption","Media is transported over HTTPS/TLS and stored on encrypted infrastructure. Customer storage credentials are never exposed in the browser."],
    ["Public vs private files","Standard Mkety Media delivery URLs are public: anyone who has the URL can request the file. Do not use standard public buckets for secrets or access-controlled documents. Private/signed delivery can be discussed as an Enterprise requirement."],
    ["Bulk export","Every customer can export the full library inventory and permanent URLs as JSON/CSV, or download scripts for macOS/Linux and Windows. Enterprise customers can request assisted migrations."],
    ["Custom domains","Custom/Enterprise accounts can request a branded hostname such as media.example.com. Mkety provisions the hostname/TLS and the customer points a CNAME to the Mkety delivery target."],
    ["Data ownership","Customers retain ownership of the files they upload. Mkety stores and delivers those files to provide the service."],
    ["Deletion","Deleting a file removes the source object and requests cache invalidation. Standard delivery caching uses a bounded edge TTL; customers needing formal retention/deletion controls should use an Enterprise policy."],
    ["Usage protection","Plans are prepaid and hard-capped. Mkety does not silently create unbounded post-paid infrastructure debt. Customers can upgrade or buy prepaid extra capacity before or after reaching a limit."],
    ["Portability","Mkety is designed to avoid data lock-in: customer-visible URLs, export manifests and bulk-download scripts are available without needing support approval."],
    ["Enterprise controls","Custom pricing, exact limits, billing term, team size, regional/dedicated infrastructure eligibility, branded domains and retention requirements can be agreed per customer."],
    ["Security scanning","Mkety does not currently advertise automatic malware/content scanning as part of Standard storage. Customers with scanning, compliance or content-inspection requirements should specify them before Enterprise onboarding."],
    ["Data residency","Standard storage placement is managed by Mkety's infrastructure layer. A specific country/region residency commitment is only provided when explicitly agreed for an Enterprise deployment."],
  ];
  return <main className="wrap">
    <nav className="nav"><div className="brand">Mkety Media</div><div><Link href="/">Home</Link><Link href="/enterprise">Enterprise</Link><Link href="/login">Login</Link></div></nav>
    <section className="hero"><h1>Trust, portability and infrastructure</h1><p>Clear answers for teams evaluating Mkety Media for production workloads.</p></section>
    <section className="card"><h2>Procurement & technical FAQ</h2><table className="table"><tbody>{rows.map(([q,a])=><tr key={q}><th style={{textAlign:"left",verticalAlign:"top",width:"28%"}}>{q}</th><td>{a}</td></tr>)}</tbody></table></section>
    <section className="card" style={{marginTop:18}}><h2>What Standard does not promise</h2><p>Standard plans do not include a separate point-in-time backup product, customer-selected geographic replication, a Mkety contractual uptime SLA, or dedicated infrastructure. Those requirements should be discussed before purchase and documented in a custom/Enterprise order.</p></section>
    <section className="card" style={{marginTop:18}}><h2>Need procurement answers in writing?</h2><p>Enterprise customers can request a written architecture, retention, migration, regional-placement or SLA schedule for their order.</p><Link className="btn" href="/enterprise">Talk to Enterprise</Link></section>
  </main>;
}
