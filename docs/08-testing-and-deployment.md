# 8. Testing and Deployment Plan

## 8.1 Test strategy overview

| Layer | Scope | Tools (suggested) | Runs |
|---|---|---|---|
| Unit | Prompt builder, style presets, scoring functions (colour distance, style overlap, budget), price/currency maths, category mapping, URL builder | Vitest/Jest | Every commit |
| Connector tests | Each `ShopConnector` against **recorded fixtures** (sample feed/API responses); normalisation edge cases (missing price, HTML in descriptions, bad URLs) | Vitest + fixtures | Every commit |
| Integration | API + Postgres (+pgvector) + Redis + storage emulator; provider and vision model **mocked** | Testcontainers / docker compose | Every PR |
| Contract | `RenderProvider` and vision adapters vs provider API schemas; webhook signature checks | Schema validation, mock servers | Every PR; nightly against real sandbox |
| End-to-end | Upload → generate → compare → download → shop this look → click-out | Playwright | Every PR (mocked AI), nightly (real AI, small sample) |
| AI quality evals | Render quality, layout preservation, detection, matching quality | Eval scripts plus human review | On prompt/model/parameter changes and weekly |
| Performance/load | API throughput, queue behaviour, matching latency | k6 | Before release |
| Security | Auth scoping, upload validation, SSRF in feed fetch, secrets scanning, dependency audit | CI scanners, manual review | Every PR + pre-release |
| Accessibility/UX | Slider keyboard use, contrast, mobile layouts | axe, manual | Before release |

## 8.2 Feature-specific test plans

### 3D-style generation
- Upload validation: wrong type, oversize, tiny image, corrupt file, EXIF removal, moderation rejection.
- Pipeline: status transitions (`queued → … → completed`), retries, fallback provider switch, failure refunds quota, idempotency key prevents double charge.
- Quality gate: synthetic cases (identical image → pass; unrelated image → fail).
- Variations: second style on the same room reuses depth/edge maps, creates a separate design, does not overwrite the first.
- Download: correct format, signed URL expiry, watermark on free tier, authorisation (another user's design → 404).
- Compare: original and render share aspect ratio; slider usable on touch devices.
- **Evaluation set (30 to 50 rooms)** scored per [AI guide §5.8](05-ai-integration-guide.md#58-evaluation-before-committing-to-a-provider). Store scores per prompt/model version; block releases that regress layout pass rate by more than 3 points or render-look rating by more than 0.3.
- Wording check: the redesign image is not described as an editable 3D model of the room, and the disclaimer is shown. The 3D layout view says "real sizes, simplified shapes" until a GLB exists, and a photo-textured preview is not called a photo-real model.
- Reference products: the render request contains the room photo plus at most `maxReferenceImages` product photos (each within the provider's size limit), and the prompt names every chosen product (covered by `tests/cloudflare.test.ts` and `tests/furnish.test.ts`).

### Furnishing and 3D layout view
- Furnishing: one product per slot, never out of stock, fits the room, mostly tagged with the chosen style; with a budget the total stays within it (or is flagged), and main pieces are never dropped (`tests/furnish.test.ts`).
- End to end with the demo provider: a design run stores its products, renders them, marks them as visible, and the prompt names each one.
- Default layout for every room type keeps all floor items inside the room; clamping, rotation normalisation and attachment rules (`tests/scene-layout.test.ts`).
- Manual/browser checks: the 3D view renders on desktop and mobile; orbit and zoom; selecting, dragging (stops at walls), rotating and keyboard nudging; layout and room size persist after reload; swapping a product updates the scene; WebGL-unavailable fallback message.

### Shop integration
- Connector fixtures for each type; pagination, auth failure, rate-limit (429) handling, timeout and partial failures.
- Idempotent re-sync, change detection by `content_hash`, deactivation of missing products, `shop_sync_runs` accuracy.
- Category mapping coverage report; unmapped products excluded from recommendations.
- SSRF protection: feed URLs resolved and blocked for private IP ranges; size and time limits on downloads.
- Link integrity: scheduled job checks product URLs (HTTP status) and images; broken ones flagged/hidden.
- Redirect: `/r/{id}` logs click and 302s to the correct URL with affiliate parameters; open redirect not possible (URL always from DB).
- Filters: category and budget filters return correct subsets (boundary values, currency conversion).
- Adding a shop test: an internal test shop added using only config and a fixture, with no core code change, demonstrates extensibility.

### Product matching
- Unit tests for each score component with known inputs/outputs (e.g. identical colours → 1.0; far colours → ~0).
- Property tests: matches always share the item's (compatible) category; never include inactive or out-of-stock products; never exceed the user's hard max price.
- Golden tests: fixed item crops + fixed mini catalogue → expected top-3 product IDs (guards against regressions when weights change).
- Offline relevance set: precision@5 ≥ 0.6 for MVP; coverage ≥ 80% of detected categories with ≥ 3 matches.
- Edge cases: no budget, budget too low for any product, only one shop having a category, unknown availability, missing colour/style data, empty catalogue for a category (UI shows "no matches yet" state).
- Detection: sample designs with annotated items; track precision and recall by category.

## 8.3 Test data
- Room photo corpus (licensed or self-shot, with consent) covering room types, light levels, clutter and angles.
- Mini catalogue fixture of about 200 products across categories, colours and styles, including deliberately messy entries.
- Recorded provider responses for deterministic tests; a small number of real calls in nightly runs with a spending cap.

## 8.4 Environments

| Environment | Purpose | Data | AI provider |
|---|---|---|---|
| Local | Development via docker compose (Postgres+pgvector, Redis, MinIO) | Fixtures | Mock provider returning a stored sample render |
| CI | Automated tests | Ephemeral DB | Mocks |
| Staging | Pre-release verification, partner shop feeds in test mode | Anonymised/test accounts | Real provider with a low spending limit |
| Production | Live | Real | Real, with quotas and alerts |

Configuration via environment variables (12-factor): database URL, Redis URL, storage bucket and credentials, `RENDER_PROVIDER`, provider API keys, vision/embedding model keys, per-shop secrets, FX rates source, feature flags.

## 8.5 Deployment architecture (MVP)

- **Web/API:** containerised Next.js app on a managed container or serverless platform with autoscaling.
- **Worker:** separate container(s) running the BullMQ workers (render pipeline, ingestion). Scale on queue depth.
- **Database:** managed PostgreSQL with `pgvector`, automated backups and point-in-time recovery.
- **Redis:** managed Redis for the queue.
- **Object storage:** private bucket with signed URLs and lifecycle rules; CDN for resized images.
- **Scheduler:** cron-triggered jobs for shop syncs, link checks, data purge.
- **Secrets:** managed secret store, injected at runtime.
- **GPU hosting:** none for the MVP (hosted AI APIs).

## 8.6 CI/CD

1. PR: lint, typecheck, unit + connector + integration tests, security scans, migration check against ephemeral DB.
2. Merge to main: build images, deploy to staging, run E2E smoke tests.
3. Nightly: real-provider smoke test (small sample), eval set on schedule, link checker.
4. Release: manual approval, then deploy to production with a rolling/blue-green strategy; run smoke tests; database migrations are backward compatible (expand → migrate → contract).
5. Rollback: redeploy previous image; feature flags to disable features independently (`ai_render`, `shop_matching`, per-shop `is_enabled`).

## 8.7 Monitoring and alerting

Metrics:
- Rendering: queue depth, success/failure rate, p50/p95 latency per stage, provider error rate, quality-gate fail rate, cost per design.
- Catalogue: last successful sync per shop, products added/updated/deactivated, broken link rate, unmapped category count.
- Matching: coverage per category, match latency, click-through rate.
- Product: signups, designs per user, downloads, click-outs, save rate.
- Platform: HTTP error rate, DB CPU/connections, storage growth.

Alerts: failure rate > 10% over 15 min, queue age > 5 min, provider spend > daily cap, shop sync failed 2 times consecutively, p95 API latency breach.

Logging: structured logs with request IDs and `design_id`; no image bytes or personal data in logs; error tracking (e.g. Sentry-type tool).

## 8.8 Security and compliance checklist
- Per-user authorisation on every room/design/file; signed, expiring URLs.
- Upload scanning and content-type verification; image decompression limits.
- Input sanitisation for user prompts (prompt injection into the template).
- Rate limiting and quota enforcement; bot protection on redirects.
- Secrets never in the client or repository; secret scanning in CI.
- Privacy policy and consent: AI sub-processors listed, data retention and deletion workflow, account deletion removes photos/renders from storage.
- Affiliate disclosure and AI-generated content labelling.
- Respect shop terms: honour takedown requests within agreed times (disable shop flag).

## 8.9 Release checklist (MVP)
- [ ] Evaluation set thresholds met (layout ≥ 90%, render-look ≥ 4/5, p95 latency < 90 s).
- [ ] All pilot shops syncing; 20-product manual spot check per shop passed.
- [ ] Every product link and image validated.
- [ ] UI copy reviewed: "3D-style render", disclaimers present, no claim of editable 3D model or guaranteed fit.
- [ ] Quotas, spending caps and alerts configured.
- [ ] Backups and restore tested; rollback rehearsed.
- [ ] Privacy policy, terms and shop disclosures published.
- [ ] Load test passed at 3x expected launch traffic.
