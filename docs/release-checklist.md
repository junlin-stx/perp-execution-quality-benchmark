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
   - Evidence: `git remote -v` shows the public remote.
   - Evidence: public repository URL opens without authentication.

2. Deploy `public/` to a static host.
   - Acceptable hosts: GitHub Pages, Cloudflare Pages, Vercel static, Netlify static, or an equivalent static host.
   - Evidence: public URL serves `index.html`.
   - Evidence: public URL serves `methodology.html`.
   - Evidence: public URL serves `data/latest.json`.

3. Run the collector/export loop.
   - Command: `npm run run:benchmark`
   - Evidence: `public/data/latest.json` updates every 5 minutes.
   - Evidence: `public/data/history-7d.json` grows over time.

4. Create the Telegram anomaly channel.
   - Evidence: `TELEGRAM_CHAT_ID` points to the public channel.
   - Evidence: the bot has permission to post.
   - Evidence: `npm run telegram:send-anomalies` exits successfully.

5. Publish the first daily summary after at least one UTC day of data.
   - Command: `npm run summary`
   - Evidence: `public/data/daily-summary.json` contains the generated summary.
   - Evidence: the summary text is posted publicly.

## Public Methodology Checks

Before launch, verify the methodology page states:

- Metric formulas for spread, 10bp depth, and 100,000 USD taker slippage.
- Data sources for Hyperliquid, Binance Perps, Aevo, and StandX.
- 30 to 60 second collection cadence.
- 5 minute static export cadence.
- Binance RPI public-book limitation.
- Hyperliquid 20-level public-book limitation.
- StandX SOL is not replaced with another StandX market.
- No alpha, liquidation, whale, vault, paid, login, or custom-alert scope.

Command:

```bash
rg -n "RPI|20 levels|StandX SOL|100,000 USD|10bp|30 to 60 seconds|liquidation|whale|vault" public/methodology.html
```

## Current External-State Gaps

- No git remote is configured yet.
- No public static deployment URL is configured yet.
- No Telegram bot token or channel id is configured in this workspace.

