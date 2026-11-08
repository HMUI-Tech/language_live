export const EVENTS = [
  "page_open",
  "learning_started",
  "cards_open",
  "talk_open",
  "articles_open",
  "english_open",
];
export function validEvent(value) {
  return typeof value === "string" && EVENTS.includes(value);
}
export function isOwner(user, email) {
  return Boolean(
    user && email && user.email.toLowerCase() === email.toLowerCase(),
  );
}
export function allowedRequest(request) {
  return (
    request.headers.get("origin") === new URL(request.url).origin &&
    request.headers.get("content-type")?.split(";")[0].trim() ===
      "application/json"
  );
}
export function isBot(request) {
  return /bot|crawler|spider|preview|facebookexternalhit|linkedinbot|headless/i.test(
    request.headers.get("user-agent") || "",
  );
}
export async function usageRpc(vars, name, extra = {}) {
  if (
    !vars.SUPABASE_URL ||
    !vars.SUPABASE_PUBLISHABLE_KEY ||
    !vars.USAGE_SERVER_KEY ||
    !vars.USAGE_SITE
  )
    throw Error("Analytics unavailable");
  const response = await fetch(vars.SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: vars.SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      site_name: vars.USAGE_SITE,
      server_key: vars.USAGE_SERVER_KEY,
      ...extra,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw Error("Analytics unavailable");
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function dashboard(data) {
  const rows = data.rows || [],
    today = data.today;
  const days = Array.from({ length: 30 }, (_, i) =>
    new Date(Date.parse(today + "T12:00:00Z") - i * 86400000)
      .toISOString()
      .slice(0, 10),
  );
  const sum = (site, event, period) =>
    rows
      .filter(
        (r) =>
          r.site === site && r.event === event && r.day >= days[period - 1],
      )
      .reduce((a, r) => a + Number(r.hits), 0);
  const cards = ["deutsch-live", "italian-live"]
    .map(
      (site) =>
        `<section class="panel">
<h2>${site === "deutsch-live" ? "Deutsch Live" : "Italian Live"}</h2>
<div class="metrics">${[
          [1, "Today"],
          [7, "Last 7 days"],
          [30, "Last 30 days"],
        ]
          .map(
            ([n, label]) =>
              `<div>
<h3>${label}</h3>
<strong>${sum(site, "page_open", n).toLocaleString("en-GB")}</strong>
<p>page opens</p>
<strong>${sum(site, "learning_started", n).toLocaleString("en-GB")}</strong>
<p>learning starts</p>
</div>`,
          )
          .join("")}</div>
</section>`,
    )
    .join("");
  const dayRows = days
    .map((day) => {
      const counts = (site, event) =>
        rows
          .filter((r) => r.day === day && r.site === site && r.event === event)
          .reduce((a, r) => a + Number(r.hits), 0);
      return `<tr>
<th>${esc(day)}</th>
<td>${counts("deutsch-live", "page_open")}</td>
<td>${counts("deutsch-live", "learning_started")}</td>
<td>${counts("italian-live", "page_open")}</td>
<td>${counts("italian-live", "learning_started")}</td>
</tr>`;
    })
    .join("");
  const features = ["cards_open", "talk_open", "articles_open", "english_open"]
    .map(
      (event) =>
        `<tr>
<th>${esc(event.replace("_open", "").replace("english", "word bridges"))}</th>
<td>${sum("deutsch-live", event, 30)}</td>
<td>${sum("italian-live", event, 30)}</td>
</tr>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Owner analytics · Language Live</title>
<style>body{margin:0;background:#101713;color:#edf1e9;font:16px system-ui,sans-serif}main{max-width:1050px;margin:auto;padding:28px 20px}a{color:#f4d243}h1{font-size:clamp(28px,5vw,42px)}h2{margin-top:0}.panel{background:#1b241e;border:1px solid #37443a;border-radius:16px;padding:22px;margin:20px 0}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.metrics strong{font-size:32px}.metrics p{margin:3px 0 18px;color:#b4c3b7}.note{color:#b4c3b7;line-height:1.6}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-variant-numeric:tabular-nums}th,td{padding:12px 10px;border-bottom:1px solid #37443a}caption{text-align:left;font-size:24px;font-weight:700;margin:12px 0}button{font:inherit;padding:8px 12px}@media(max-width:550px){.metrics{grid-template-columns:1fr}.metrics>div{border-top:1px solid #37443a;padding-top:8px}}</style>
</head>
<body>
<main>
<a href="/learn">← Back to learning</a>
<p class="note">PRIVATE OWNER DASHBOARD · BOTH WEBSITES</p>
<h1>Language Live analytics</h1>
<p class="note">Daily aggregate counters · Europe/Berlin · starts with the analytics launch on 5 November 2026. Refresh this page for new totals.</p>${cards}<section class="panel note">
<b>What the numbers mean</b>
<p>Page opens count visible loads of the learning and login pages. Refreshes and another device can count again. Learning starts count at most once per open learning page when someone starts a flashcard session or submits a dialogue answer. Feature opens count at most once per feature per page load.</p>
<p>These are not unique people or completed lessons. Known bots and link previews are filtered, but counts can include unrecognised bots, your own tests and repeated visits. Blockers, network failures and Do Not Track / Global Privacy Control can reduce counts. No visitor IDs, IP addresses, email addresses, recordings, full URLs or individual event histories are stored in these analytics tables. Hosting still processes normal request metadata.</p>
<p>Only daily site/event totals are retained for up to 180 days. No historical traffic has been imported.</p>
</section>
<section class="panel scroll">
<table>
<caption>Daily activity · last 30 days</caption>
<thead>
<tr>
<th>Date</th>
<th>German opens</th>
<th>German learning starts</th>
<th>Italian opens</th>
<th>Italian learning starts</th>
</tr>
</thead>
<tbody>${dayRows}</tbody>
</table>
</section>
<section class="panel scroll">
<table>
<caption>Feature opens · last 30 days</caption>
<thead>
<tr>
<th>Feature</th>
<th>Deutsch Live</th>
<th>Italian Live</th>
</tr>
</thead>
<tbody>${features}</tbody>
</table>
</section>
<p class="note">Owner access uses your verified ChatGPT sign-in. Learners’ accounts and progress are not shown here.</p>
</main>
</body>
</html>`;
}
