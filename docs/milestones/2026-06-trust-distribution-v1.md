# Trust & Distribution v1

## 一句话目标

把 Perp Execution Quality Benchmark 从“已经能展示排名的静态页面”推进到“交易者愿意引用、质疑、转发的可信数据源”。

这个 milestone 不追求做成交易终端，也不追求堆更多市场指标。它只解决一个问题：当 trader 看到这套 benchmark 时，能不能快速判断数据是否新鲜、方法是否可信、异常是否值得讨论，并且方便把结果转发给别人。

## 背景

当前项目已经具备基础能力：

- 公共 order book collector
- SQLite 持久化
- 静态站点导出
- `latest.json`、`history-7d.json`、`daily-summary.json`、`anomalies.json`
- methodology 页面
- Telegram anomaly sender
- R2 数据发布路径

下一阶段的瓶颈不是“有没有更多图”，而是“别人为什么相信这张表，以及为什么要转发它”。

## 本阶段范围

### 1. Data Health

在公开页面或公开 JSON 中明确展示数据健康度：

- latest generated time
- latest sample age
- expected target count
- valid sample count
- failed count
- not listed count
- unavailable/insufficient-depth count
- per venue/market 的最近状态

目标是让读者在页面上直接看到“数据新不新、缺不缺、哪里坏了”。

### 2. Venue/Market Drilldown

为单个 market + venue 增加可追溯视图，至少覆盖：

- 24h 或 7d 的 spread 趋势
- 3bp / 5bp / 10bp depth 趋势
- 100k / 1m estimated taker slippage 趋势
- 样本数、缺失样本、insufficient-depth 状态

目标是从“横截面排名”升级到“稳定性解释”。

### 3. Public Anomaly Feed

把 anomaly 从 Telegram-only 扩展为公开可访问页面或数据视图：

- anomaly metric
- venue
- market
- start/end time
- baseline
- observed value
- 简短解释
- dedupe key 或可追溯 id

目标是让异常事件能被网页引用，而不是只停留在一次性消息里。

### 4. Daily Market Note

把 daily summary 改成更适合 Telegram/X/群聊传播的短文案：

- 先说当天结论
- 再说主要 venue 差异
- 明确 reference-only venue
- 明确 not listed / insufficient-depth
- 不输出交易建议

目标是让 summary 可以直接被复制转发。

### 5. Public Data Usage

补充公开数据使用说明：

- 每个 JSON 文件的用途
- 字段含义
- freshness 语义
- ranking 语义
- reference venue 语义
- CSV/API 是否提供；如果提供，说明路径和字段

目标是让 quant/trader 可以引用数据，而不是只能看页面。

## 明确非目标

本 milestone 不做：

- login、付费订阅、个人 watchlist
- 自定义 alert 条件
- liquidation heatmap
- whale tracking
- vault dashboard
- funding/OI 综合交易面板
- order-flow terminal
- WebSocket 实时前端
- 交易信号、做多做空建议、alpha 文案
- 为某个 venue 写营销型解释

这些都可能有价值，但会把当前阶段从“可信 benchmark”拉向“交易产品”。本阶段先不做。

## 产品原则

- 可信度优先于视觉复杂度。
- 可审计性优先于黑盒综合分数。
- 公开静态输出优先于后端交互功能。
- 缺失、失败、not listed、insufficient depth 必须公开显示，不能静默过滤。
- Spread 是 top-of-book 参考信号；depth 和 estimated taker slippage 才是主要可比指标。
- Hyperliquid 和 Aster 保持 reference-only 语义，除非 methodology 明确变更。
- StandX `SOL-USD` 在公开 symbol 数据支持前继续显示为 `N/A: not listed`。

## 验收标准

### 功能验收

完成时应满足：

- 页面或公开 JSON 能展示 data health。
- 用户能从首页进入某个 venue/market 的历史解释视图，或通过清晰链接拿到对应数据。
- `public/data/anomalies.json` 的内容能在公开页面中被阅读和引用。
- daily summary 文案可以直接复制到 Telegram/X，不包含交易建议。
- README 或专门文档说明 public data 文件、核心字段和使用方式。
- methodology 明确解释新增展示项，不制造新的排名歧义。

### 数据验收

完成时应满足：

- `latest.json`、`history-7d.json`、`daily-summary.json`、`anomalies.json` 仍可被静态页面 lazy load。
- refresh 失败时页面保留 last good data。
- 7d history 来自持久 SQLite，而不是一次性 CI 快照。
- not listed、failed、insufficient depth 状态在数据和页面上语义一致。

### 工程验收

完成时必须通过：

```bash
npm test
npm run typecheck
git diff --check
npm run export
```

如果改动影响 collector、exchange adapters、summary、anomaly、public JSON shape，额外运行：

```bash
npm run run:benchmark -- --once
npm run anomaly:dry-run
```

如果本地环境允许 preview，额外检查：

```bash
python3 -m http.server 4174 --directory public
```

并打开：

- `http://127.0.0.1:4174/index.html`
- `http://127.0.0.1:4174/methodology.html`
- `http://127.0.0.1:4174/data/latest.json`
- `http://127.0.0.1:4174/data/history-7d.json`
- `http://127.0.0.1:4174/data/daily-summary.json`
- `http://127.0.0.1:4174/data/anomalies.json`

## 发布验收证据

合并或发布前，在 PR/变更说明中记录：

- 本次新增或修改的 public data 文件
- 本次新增或修改的页面
- `npm test` 结果
- `npm run typecheck` 结果
- `npm run export` 结果
- 如果运行了 live one-shot，记录 collected / failed / not_listed 数字
- 如果做了 preview，记录本地 URL 和关键页面检查结果

## 成功信号

这个 milestone 成功，不是因为页面更“丰富”，而是因为：

- trader 可以独立判断数据健康度
- 异常事件可以被链接和讨论
- daily note 可以被自然转发
- methodology 能解释为什么某个 venue 排名好/差
- 外部反馈集中在数据和方法本身，而不是“你这个表从哪里来的”

## Kill Criteria

如果出现以下情况，应暂停扩功能，先修正基础可信度：

- 7d history 无法证明来自持久数据
- 页面展示和 public JSON 字段语义不一致
- anomaly message 无法追溯到公开数据
- summary 开始像交易建议
- 新功能需要私有 API、账号态、或不可审计的数据源
