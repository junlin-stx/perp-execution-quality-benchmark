# Changelog

## 0.2.0 - 2026-06-08

- Added generated `public/data/health.json` with freshness counts and per venue/market status.
- Added Data Health, Venue / Market Drilldown, and Public Anomaly Feed sections to the static public page.
- Exposed SOL on the public page so not-listed states remain visible instead of hidden behind exported JSON.
- Added insufficient-depth counts to 7 day history rollups.
- Updated daily summary text into copyable market notes with reference-only and insufficient-depth caveats.
- Added anomaly event baseline and observed-value fields for newly generated events.
- Added public data usage documentation and refreshed release/deployment checklist language.

## 0.1.0 - 2026-06-02

- Initial public static benchmark with collector, SQLite persistence, methodology, latest comparison, 7 day history, daily summaries, anomaly JSON export, Telegram anomaly sender, and R2 publishing support.
