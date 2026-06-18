"use client";

import { type ReactNode, useState } from "react";

type TabKey = "predictions" | "compare" | "lineups" | "stats";

type MatchDetailTabsProps = {
  compare: ReactNode;
  predictions: ReactNode;
  lineups: ReactNode;
  stats: ReactNode;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "predictions", label: "Predictions" },
  { key: "compare", label: "Compare" },
  { key: "lineups", label: "Lineups" },
  { key: "stats", label: "Stats" }
];

export function MatchDetailTabs({ compare, lineups, predictions, stats }: MatchDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("predictions");

  return (
    <div className="match-detail-tabs">
      <div className="match-tab-list" aria-label="Match details">
        {TABS.map((tab) => (
          <button
            className={activeTab === tab.key ? "match-tab active" : "match-tab"}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={activeTab === "predictions" ? "match-tab-panel active" : "match-tab-panel"}>
        {predictions}
      </div>
      <div className={activeTab === "compare" ? "match-tab-panel active" : "match-tab-panel"}>
        {compare}
      </div>
      <div className={activeTab === "lineups" ? "match-tab-panel active" : "match-tab-panel"}>
        {lineups}
      </div>
      <div className={activeTab === "stats" ? "match-tab-panel active" : "match-tab-panel"}>
        {stats}
      </div>
    </div>
  );
}
