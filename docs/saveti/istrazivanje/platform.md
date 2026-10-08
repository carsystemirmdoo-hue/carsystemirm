# Platform research: scheduled publishing (Next.js 15.5 App Router on Vercel)

Researched 2026-10-08. Sources: official vercel.com/docs, nextjs.org/docs/15 (version 15.5.27 docs), developers.google.com/search, schema.org, ogp.me. One GitHub discussion is cited and marked as non-official.

Legend: [OFFICIAL] = stated in official docs. [INFERENCE] = my reading, not stated outright. [UNCERTAIN] = conflicting or thin sources, verify before relying on it.

---

## Sources opened

| # | URL | Last updated (as shown) |
|---|-----|-------------------------|
| 1 | https://vercel.com/docs/cron-jobs | 2026-09-16 |
| 2 | https://vercel.com/docs/cron-jobs/manage-cron-jobs | 2026-08-11 |
| 3 | https://vercel.com/docs/cron-jobs/usage-and-pricing | 2026-07-15 |
| 4 | https://vercel.com/docs/cron-jobs/quickstart | 2026-08-11 |
| 5 | https://vercel.com/docs/functions/limitations | 2026-08-24 |
| 6 | https://vercel.com/docs/incremental-static-regeneration | 2026-08-28 |
| 7 | https://vercel.com/docs/incremental-static-regeneration/limits-and-pricing | 2026-08-11 |
| 8 | https://vercel.com/docs/plans/hobby | 2026-09-14 |
| 9 | https://vercel.com/docs/limits | 2026-09-16 |
| 10 | https://vercel.com/docs/pricing/regional-pricing/fra1 | 2026-09-14 |
| 11 | https://vercel.com/pricing | not shown |
| 12 | https://vercel.com/docs/environment-variables | 2026-09-17 |
| 13 | https://nextjs.org/docs/15/app/guides/incremental-static-regeneration | 2025-09-23 (docs v15.5.27) |
| 14 | https://nextjs.org/docs/15/app/api-reference/file-conventions/route-segment-config | 2025-07-21 |
| 15 | https://nextjs.org/docs/15/app/api-reference/file-conventions/route | 2025-10-10 |
| 16 | https://nextjs.org/docs/15/app/api-reference/file-conventions/metadata/sitemap | 2025-06-16 |
| 17 | https://nextjs.org/docs/15/app/api-reference/functions/revalidatePath | 2025-09-23 |
| 18 | https://nextjs.org/docs/15/app/api-reference/functions/not-found | 2025-06-16 |
| 19 | https://nextjs.org/docs/app/guides/how-revalidation-works (v16.4 docs, background only) | 2026-06-01 |
| 20 | https://github.com/vercel/next.js/discussions/79497 (NOT official docs) | n/a |
| 21 | https://developers.google.com/search/docs/fundamentals/creating-helpful-content | 2026-10-05 |
| 22 | https://developers.google.com/search/docs/essentials/spam-policies | 2026-08-28 |
| 23 | https://developers.google.com/search/docs/fundamentals/using-gen-ai-content | 2026-10-01 |
| 24 | https://developers.google.com/search/docs/appearance/structured-data/faqpage | see D4 |
| 25 | https://developers.google.com/search/docs/appearance/structured-data/article | 2026-09-08 |
| 26 | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap | 2026-07-08 |
| 27 | https://developers.google.com/search/docs/appearance/publication-dates | not captured |
| 28 | https://developers.google.com/search/docs/specialty/international/localized-versions | 2026-09-21 |
| 29 | https://schema.org/inLanguage | n/a |
| 30 | https://ogp.me/ | n/a |

---

## A. Vercel Cron Jobs

### Plan limits [OFFICIAL, src 3, 2]

| Plan | Cron jobs per project | Minimum interval | Precision |
|------|----------------------|------------------|-----------|
| Hobby | 100 | once per day | per hour (±59 min) |
| Pro | 100 | once per minute | per minute |
| Enterprise | 100 | once per minute | per minute |

- Hobby: an expression that runs more than once a day "will fail deployment". Example error text: "Hobby accounts are limited to daily cron jobs."
- Hobby timing: `0 1 * * *` "will trigger anywhere between 1:00 am and 1:59 am". Vercel uses the spread to balance load.
- Pro/Enterprise: `5 8 * * *` fires between 08:05:00 and 08:05:59.
- Disabled cron jobs still count toward the limit.

### Timezone and syntax [OFFICIAL, src 1]
- "The timezone is always UTC." Serbia is UTC+1 (CET) / UTC+2 (CEST), so schedules have to be converted, and the conversion shifts with daylight saving time.
- Month and weekday names (`MON`, `JAN`) are not supported. You cannot set day-of-month and day-of-week in the same expression; one of them must be `*`.

### How a cron job is invoked [OFFICIAL, src 1, 4]
- Vercel sends an HTTP **GET** to the **production** deployment URL at the configured `path`.
- User agent: `vercel-cron/1.0`. The `x-vercel-cron-schedule` header carries the expression that triggered the run.
- Preview deployments: "Vercel invokes cron jobs only for production deployments", not previews (src 4).
- Cron jobs are configured in `vercel.json` under `crons: [{ path, schedule }]`. Changing a schedule requires a redeploy.
- Cron jobs do not follow redirects; a 3xx counts as the final response. Responses that are redirects or cached do not appear in logs.
- A path that does not exist returns a 404, but the cron job still executes.
- An Instant Rollback also rolls back the cron definitions.
- Local runs: call the endpoint yourself. Cron scheduling has "no support for `vercel dev`, `next dev`".

### Securing with CRON_SECRET [OFFICIAL, src 2]
- Add a project env var named `CRON_SECRET`. Use a random value of at least 16 characters.
- Vercel sends it automatically as `Authorization: Bearer <CRON_SECRET>`.
- Pattern from the docs: `if (!cronSecret || authHeader !== \`Bearer ${cronSecret}\`) return 401`. This also fails closed when the variable is missing.
- [INFERENCE] The env var only reaches new deployments (see C). Set it before the production deploy that ships the cron job.

### Failure, retries, idempotency [OFFICIAL, src 2]
- "Vercel will not retry an invocation if a cron job fails."
- Delivery is "best effort". Transient network errors can skip a run entirely, with no runtime log. Vercel can also "invoke the same scheduled run more than once".
- Recommendations: make each run **idempotent** and **reconciliation-based**, so it processes all outstanding work since the last successful run. Track processed IDs, check state before changing it, and store timestamps or versions.
- Concurrency: if a run takes longer than the interval, a second instance can start. Use a lock (the docs mention Redis distributed locks), shorter runs, `maxDuration`, or a longer interval.
- A new deployment does not interrupt a cron job that is already running.
- [INFERENCE] For scheduled publishing: the query should be "publish every item with `publishAt <= now()` that is still unpublished". A missed Hobby run then catches up the next day, and a duplicate run does nothing. On Hobby, publishing can be up to about 24 hours late, plus the ±59 min window. That only works if the page itself does not depend on the cron (see B, "cron-free gating").

### Max duration [OFFICIAL, src 2, 5]
- Cron jobs have the same limits as Vercel Functions. With Fluid compute (Node.js):
  - Hobby: 300 s default and maximum.
  - Pro/Enterprise: 300 s default, 800 s maximum, and 1800 s extended maximum (beta).

### Cost [OFFICIAL, src 3, 11]
- "Cron jobs are included in all plans." The function invocation a cron job triggers is billed under normal Functions usage. There is no separate cron fee.
- Hobby is restricted to "non-commercial, personal use only" (src 8, fair-use). **Plan-dependent:** a commercial company site normally needs Pro. This matches the open "Vercel plan before pilot launch" decision in project memory.

---

## B. Next.js 15 ISR on Vercel

### Time-based revalidation [OFFICIAL, src 13, 14, 6]
- `export const revalidate = N` (seconds; must be statically analyzable, e.g. `600`, not `60*10`). Not available with `runtime = 'edge'`.
- Stale-while-revalidate: once N seconds have passed, the **next request still gets the cached (stale) page**. That request triggers regeneration in the background, and requests after it get the new page. Nothing regenerates without a request.
- The lowest `revalidate` across the layouts and page of a route sets the frequency for the whole route. A `fetch` with `revalidate: 0` or `no-store` makes the route dynamic.
- On an error during regeneration, Next.js keeps serving the last good version and retries on a later request (src 13). On Vercel, a failed revalidation serves stale content and retries after a **30 s TTL** (src 6).
- Vercel treats these statuses as successful revalidations: 200, 301, 302, 307, 308, **404, 410** (src 6). Any other status counts as a failure and keeps the stale content.
- The Vercel ISR cache is **per deployment**. "each new deployment uses its own ISR cache". Entries persist until revalidated or unaccessed for 31 days. Purges propagate globally within about 300 ms.
- In `next dev`, pages are always rendered on demand. To test ISR locally, run `next build && next start`, optionally with `NEXT_PRIVATE_DEBUG_CACHE=1`.
- The docs recommend a high revalidate value (for example 1 h) plus on-demand revalidation when you need precision.

### `dynamicParams` and `notFound()` [OFFICIAL in part, rest UNCERTAIN]
- `dynamicParams = true` (default): params missing from `generateStaticParams` are rendered on demand. With `false` they return 404 (src 14).
- `notFound()` renders `not-found` and injects `<meta name="robots" content="noindex">` (src 18). The v15 docs **say nothing explicit** about how long a 404 from `notFound()` stays in the ISR cache.
- [INFERENCE from src 6] Vercel counts 404 as a valid revalidation result. A 404 rendered by an ISR route is therefore stored like any other result, served until the route's `revalidate` window passes, and then refreshed on the next request (stale-while-revalidate). So a slug that 404s before its publish time could keep returning 404 for up to `revalidate` seconds after publishing, plus one extra request.
- [UNCERTAIN, non-official src 20] A GitHub discussion (#79497, Next 15 era) reports that a 404 from `notFound()` was cached and **stayed 404 even after the revalidate window**, until redeploy or on-demand revalidation. A possible fix (PR #79512) landed in canary. It is unclear whether 15.5.x behaves correctly. **Test on a real Vercel deployment.**
- Recommended safeguards for scheduled articles:
  1. When the cron publishes an article, call `revalidatePath('/blog/<slug>')`, plus the index, sitemap and any listing pages. This clears a cached 404.
  2. Keep `revalidate` short enough (for example 300–3600 s) that a missed on-demand call still self-heals.
  3. Optional "cron-free gating": the page checks `publishAt <= now` itself, so time-based revalidation alone publishes the article within `revalidate` seconds of the first request after publish time, even on Hobby. The cron then only adds speed.

### `revalidatePath` / `revalidateTag` from a Route Handler [OFFICIAL, src 17, 13]
- Both can be called from Route Handlers and Server Functions, but not from Client Components or Middleware.
- In a Route Handler, the call **marks** the path, and "revalidation is done on the next visit". There is no eager regeneration in the App Router.
- `revalidatePath('/blog/[slug]', 'page')` invalidates every URL matching that page. A pattern with a dynamic segment requires `type`. For one URL, pass the concrete path and omit `type`. Paths are case-sensitive and limited to 1024 characters.
- `revalidatePath('/', 'layout')` invalidates everything.
- `revalidateTag('tag')` invalidates data tagged through `fetch(..., { next: { tags } })` or `unstable_cache(..., { tags })`. That is the database-friendly route in v15. (Note: in v16 `revalidateTag` takes a second profile argument. The v15 signature takes one argument.)
- Middleware does not run for on-demand ISR requests, so revalidate the real path, not a rewritten one (src 13).
- On Vercel, on-demand revalidation applies to the domain and deployment where it is triggered (src 6).

### `app/sitemap.ts` [OFFICIAL, src 16, 15]
- `sitemap.js` "is a special Route Handler that is cached by default" unless it uses a Dynamic API or dynamic config. Route Handlers accept the same segment config, so `export const revalidate = N` (or `dynamic = 'force-dynamic'`) applies. [INFERENCE: the sitemap docs do not show `revalidate` directly; this follows from the route-segment-config docs.] You can also call `revalidatePath('/sitemap.xml')` from the publish cron.
- Supports `lastModified`, `alternates.languages`, and `generateSitemaps` for splitting (50,000 URLs per file).

### Route Handler caching defaults in v15 [OFFICIAL, src 15, 14]
- v15.0.0-RC: "The default caching for `GET` handlers was changed from static to dynamic". GET is not cached unless you opt in, for example with `export const dynamic = 'force-static'` or `export const revalidate = N`.
- `dynamic` values:
  - `'auto'` (default)
  - `'force-dynamic'`: render on every request
  - `'error'`: force static and error on Dynamic APIs
  - `'force-static'`: force static; cookies, headers and searchParams return empty values; revalidation still works
- The cron route itself should stay dynamic (default GET), and adding `export const dynamic = 'force-dynamic'` makes that explicit. [INFERENCE] A cached cron response would also not show up in the cron logs (src 2).

### Vercel ISR pricing on Hobby [OFFICIAL with one UNCERTAIN point]
- ISR is "available on all plans" (src 6). Usage counts function invocations, ISR writes, ISR reads, and Fast Origin Transfer. Reads and writes are counted in 8 KB units. CDN cache reads are free (src 7).
- An unchanged revalidation result causes **no ISR write** (src 7). Avoid `new Date()` or `Math.random()` in the output.
- Hobby included amounts: **vercel.com/pricing (src 11) lists ISR Reads "1M / month" and ISR Writes "200k / month"** for Hobby. [UNCERTAIN] The docs page /docs/plans/hobby (src 8) does **not** list ISR reads or writes in its included-usage table. That table does list 1M function invocations, 4 CPU-hrs Active CPU, 360 GB-hrs memory, 10 GB Fast Origin Transfer and 1M CDN requests. When Hobby limits are exceeded, the feature usually pauses for up to 30 days.
- Pro prices for fra1 (src 10): ISR Writes $5.20 per 1M units, ISR Reads $0.52 per 1M units. The pricing page shows "starting at" $4 and $0.40 per 1M (the cheapest region).
- [INFERENCE] 200 articles with hourly revalidate generate very little usage. Most writes are skipped when content is unchanged.

---

## C. Vercel environment variables [OFFICIAL, src 12]
- "Any change you make to environment variables are not applied to previous deployments, they only apply to new deployments." **A redeploy is required.**
- Production variables apply to the "next Production Deployment", and Preview variables to the next Preview deployment.
- Total size limit is 64 KB per deployment. Edge runtime allows 5 KB per variable.

---

## D. Google Search Central guidance for a 200-article editorial program

### D1. Helpful, reliable, people-first content [OFFICIAL, src 21, updated 2026-10-05]
- Self-assessment covers content quality (original information, analysis, completeness, more than a rewrite of other sources), expertise and trust (clear sourcing, author background), and a people-first purpose.
- "Who / How / Why":
  - **Who:** show bylines with author background. Do not invent author profiles or use AI-generated headshots presented as real people.
  - **How:** explain the process, including automation or AI use, when readers might reasonably wonder about it.
  - **Why:** the main purpose is helping people, not ranking.
- Warning signs of search-engine-first content include mass-producing content on many topics, heavy automation without oversight, summarizing others without adding value, writing about trends outside your expertise, and **changing dates to look fresh** without real changes.

### D2. Scaled content abuse [OFFICIAL, src 22, updated 2026-08-28]
- Defined as producing many pages mainly to manipulate rankings, without value for users, "no matter how it's created".
- Examples include using generative AI to create many pages without adding value, scraped or transformed feeds, content stitched from several sources, and keyword pages with little meaning.
- [INFERENCE] A 200-article plan is fine if each article is unique, reviewed by an expert, specific to the product range, and useful. It is a risk if the articles are templated variants with only light changes.

### D3. AI-generated content [OFFICIAL, src 23, updated 2026-10-01]
- AI use is allowed. Focus on accuracy, quality and relevance, and fact-check before publishing.
- Also review titles, meta descriptions, structured data and alt text.
- Consider telling readers how the content was made.
- AI images in e-commerce should carry IPTC `DigitalSourceType` = `TrainedAlgorithmicMedia`.
- The page restates that generating many pages without added value may violate scaled content abuse.

### D4. FAQPage rich results [OFFICIAL, src 24 plus Google search snippets; partly UNCERTAIN]
- August/September 2023: restricted to "well-known, authoritative government and health websites".
- **Current state (2026):** the docs fetch and Google's search index both report that FAQ rich results are **no longer shown in Google Search at all**. Deprecation notice in May 2026, with display ending around **2026-05-07**, and documentation removed in **June 2026**.
- [UNCERTAIN] The exact dates came through a page summarizer and search snippets, not a verbatim changelog read. The conclusion (no FAQ rich result for this site under either the 2023 rule or the 2026 removal) holds either way.
- FAQPage markup is still valid schema.org. It brings no Google rich-result benefit. Visible on-page FAQ text is still fine for users.

### D5. Article structured data [OFFICIAL, src 25, updated 2026-09-08]
- No properties are required. Recommended: `author` (Person or Organization), `author.name` (name only, no titles), `author.url` or `sameAs` (a page that uniquely identifies the author), `datePublished`, `dateModified`, `headline`, and `image` (several images, 16x9, 4x3 and 1x1).
- List each author separately.
- Use ISO 8601 dates **with timezone**. Without a timezone, Google assumes Googlebot's timezone. Use `+01:00` or `+02:00` for Serbia, matching daylight saving time.

### D6. Byline dates [OFFICIAL, src 27]
- Show a visible, labelled date ("Published", "Last updated").
- Mirror it in `datePublished`/`dateModified`, and make the visible and structured values match, including timezone.
- Use the real publish or update dates, not dates of events in the content, and no future dates.
- Remove other dates on the page that confuse Google.
- [INFERENCE] For scheduled publishing, `datePublished` = the actual `publishAt` time, not the time the draft was created. A cron that runs late should store the real go-live time, or the planned time if the page gate makes the article visible exactly then. Never show a future date.

### D7. Sitemaps `lastmod` [OFFICIAL, src 26, updated 2026-07-08]
- `lastmod` = the last **significant** update (main content, structured data or links; a copyright year change does not count).
- Google uses it only if it is "consistently and verifiably" accurate.
- `priority` and `changefreq` are ignored.
- Limits are 50 MB or 50,000 URLs per file. Submit through Search Console or a `Sitemap:` line in robots.txt (ping is deprecated).
- [INFERENCE] Do not set `lastModified: new Date()` for every entry. Use the article's `dateModified`.

### D8. hreflang [OFFICIAL, src 28, updated 2026-09-21]
- Use it only when **multiple language or regional versions** of a page exist. A Serbian-Latin-only site needs no hreflang.
- Format: ISO 639-1 language, optional ISO 15924 script (the docs give `zh-Hant` and `zh-Hans`), optional ISO 3166-1 region. `x-default` is the fallback.
- Google does **not** use hreflang or the `lang` attribute to detect page language. It uses its own algorithms.

---

## E. Language codes for Serbian Latin

- **schema.org `inLanguage`** [OFFICIAL, src 29]: "use one of the language codes from the IETF BCP 47 standard." The BCP 47 tag for Serbian in Latin script is **`sr-Latn`**, or **`sr-Latn-RS`** with the region. [INFERENCE: standard BCP 47 / IANA subtag usage. Plain `sr` carries no script.] The same value fits `<html lang="sr-Latn">`.
- **Open Graph `og:locale`** [OFFICIAL, src 30]: format `language_TERRITORY`, default `en_US`. So **`sr_RS`**. OGP defines no script subtag. [INFERENCE] `sr_RS` is the conventional value. Facebook's locale list has no Serbian Latin variant.
- **Google on Latin vs Cyrillic Serbian** [UNCERTAIN, nothing found]: no Google Search Central page addresses Serbian Latin vs Cyrillic. The only general statements are that Google detects language algorithmically (src 28) and that hreflang accepts an ISO 15924 script subtag, so `sr-Latn` / `sr-Cyrl` are valid **if** both versions ever exist. A Google ML Kit page lists Serbian under Cyrillic, but that is a different product and not Search guidance.
