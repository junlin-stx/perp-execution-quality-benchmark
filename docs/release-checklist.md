# Release Checklist

This checklist tracks the evidence needed before calling the benchmark publicly released.

## Local Evidence Already Available

- Collector command: `npm run run:benchmark`
- One-shot collector command: `npm run run:benchmark -- --once`
- Static export command: `npm run export`
- Daily summary command: `npm run summary`
- Telegram dry-run command: `npm run anomaly:dry-run`
- Telegram send command: `npm run telegram:send-anomalies`
- Latest public files:
  - `public/index.html`
  - `public/methodology.html`
  - `public/data/latest.json`
  - `public/data/history-7d.json`
  - `public/data/daily-summary.json`
  - `public/data/anomalies.json`

## Required Before Public Launch

1. Create a public Git repository and push this repo.
   - Status: complete.
   - Evidence: `git remote -v` shows `https://github.com/junlin-stx/perp-execution-quality-benchmark.git`.
   - Evidence: public repository URL is `https://github.com/junlin-stx/perp-execution-quality-benchmark`.
   - Evidence: `gh repo view junlin-stx/perp-execution-quality-benchmark --json name,visibility,url,defaultBranchRef` returns `visibility=PUBLIC` and `defaultBranchRef=main`.
   - Evidence: the public repository includes `LICENSE`.

2. Deploy `public/` to a static host.
   - Status: complete.
   - Acceptable hosts: GitHub Pages, Cloudflare Pages, Vercel static, Netlify static, or an equivalent static host.
   - Evidence: public URL is `https://junlin-stx.github.io/perp-execution-quality-benchmark/`.
   - Evidence: public URL serves `index.html` with `Perp Execution Quality` and `7 Day History`.
   - Evidence: public URL serves `methodology.html` with the metric formulas and comparability limits.
   - Evidence: public URL serves `data/latest.json` with 12 targets.

3. Run the collector/export loop.
   - Status: complete for GitHub Actions Pages workflow.
   - Command: `npm run run:benchmark`
   - Evidence: `public/data/latest.json` updates every 5 minutes.
   - Evidence: `public/data/history-7d.json` grows over time.
   - Evidence: `data/benchmark.sqlite` is stored on persistent disk.
   - Evidence: workflow `Benchmark Pages` run `26623179905` completed successfully.
   - Evidence: workflow file `.github/workflows/benchmark-pages.yml` uses a 5 minute cron and `actions/cache` for `data/benchmark.sqlite`.

4. Create the Telegram anomaly channel.
   - Evidence: `TELEGRAM_CHAT_ID` points to the public channel.
   - Evidence: the bot has permission to post.
   - Evidence: `npm run telegram:send-anomalies` exits successfully.
   - Evidence: workflow `Benchmark Pages` run `26623363630` completed the `Send Telegram anomalies` step successfully with the current repository configuration.

5. Publish the first daily summary after at least one UTC day of data.
   - Command: `npm run summary`
   - Evidence: `public/data/daily-summary.json` contains the generated summary.
   - Evidence: the summary text is posted publicly.

## Public Methodology Checks

Before launch, verify the methodology page states:

- Metric formulas for spread, 10bp depth, and 100,000 USD taker slippage.
- Data sources for Hyperliquid, Aevo, StandX, Aster, and edgeX.
- 30 to 60 second collection cadence.
- 5 minute static export cadence.
- Hyperliquid 20-level public-book limitation.
- StandX SOL is not replaced with another StandX market.
- No alpha, liquidation, whale, vault, paid, login, or custom-alert scope.

Command:

```bash
```

## Current External-State Gaps

- No Telegram bot token or channel id is configured in this workspace.

## Deployment Note

See `docs/deployment.md`. The benchmark needs persistent storage for `data/benchmark.sqlite`; a disposable scheduled CI job without restored storage is not enough for a credible 7 day history.
