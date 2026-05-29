import { detectAnomalies, type AnomalyPoint } from "./rules.js";

const samplePoints: AnomalyPoint[] = [];
const events = detectAnomalies(samplePoints, { minConsecutive: 3, slippageBpDelta: 5, spreadBpDelta: 3 });

for (const event of events) {
  console.log(`[dry-run] ${event.message}`);
}

if (events.length === 0) {
  console.log("[dry-run] no execution quality anomalies");
}
