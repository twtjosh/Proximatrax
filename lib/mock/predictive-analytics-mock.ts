
export type ProfitOutlookStatus = "profit" | "break_even" | "loss";

export type MockProjectProfitOutlook = {
  id: string;
  title: string;
  contractValue: number;
  estimatedCost: number;
  predictedProfit: number;
  marginPct: number;
  status: ProfitOutlookStatus;
  confidencePct: number;
};

export type MarketVerdict = "good_deal" | "fair" | "above_market";

export type MockClientMarketInsight = {
  projectTitle: string;
  contractValue: number;
  floorAreaSqm: number;
  location: string;
  projectType: string;
  marketLow: number;
  marketMid: number;
  marketHigh: number;
  verdict: MarketVerdict;
  verdictLabel: string;
  summary: string;
  confidencePct: number;
  sources: Array<{ title: string; url: string }>;
};

export const MOCK_PROJECT_PROFIT_OUTLOOK: MockProjectProfitOutlook[] = [
  {
    id: "mock-1",
    title: "BGC Luxury Residence",
    contractValue: 2_100_000,
    estimatedCost: 1_680_000,
    predictedProfit: 420_000,
    marginPct: 20,
    status: "profit",
    confidencePct: 87,
  },
  {
    id: "mock-2",
    title: "Ortigas Office Interior",
    contractValue: 980_000,
    estimatedCost: 1_050_000,
    predictedProfit: -70_000,
    marginPct: -7.1,
    status: "loss",
    confidencePct: 82,
  },
  {
    id: "mock-3",
    title: "Makati Retail Fit-out",
    contractValue: 1_450_000,
    estimatedCost: 1_218_000,
    predictedProfit: 232_000,
    marginPct: 16,
    status: "profit",
    confidencePct: 79,
  },
  {
    id: "mock-4",
    title: "Quezon City Condo Renovation",
    contractValue: 650_000,
    estimatedCost: 638_000,
    predictedProfit: 12_000,
    marginPct: 1.8,
    status: "break_even",
    confidencePct: 74,
  },
  {
    id: "mock-5",
    title: "Alabang Showroom",
    contractValue: 1_820_000,
    estimatedCost: 1_910_000,
    predictedProfit: -90_000,
    marginPct: -4.9,
    status: "loss",
    confidencePct: 85,
  },
];

export const MOCK_PORTFOLIO_SUMMARY = {
  profitableCount: MOCK_PROJECT_PROFIT_OUTLOOK.filter((p) => p.status === "profit").length,
  atRiskCount: MOCK_PROJECT_PROFIT_OUTLOOK.filter((p) => p.status === "loss").length,
  breakEvenCount: MOCK_PROJECT_PROFIT_OUTLOOK.filter((p) => p.status === "break_even").length,
  totalPredictedProfit: MOCK_PROJECT_PROFIT_OUTLOOK.reduce(
    (sum, p) => sum + p.predictedProfit,
    0
  ),
};

export const MOCK_CLIENT_MARKET_INSIGHT: MockClientMarketInsight = {
  projectTitle: "Your project",
  contractValue: 980_000,
  floorAreaSqm: 85,
  location: "Ortigas, Metro Manila",
  projectType: "Commercial office interior",
  marketLow: 850_000,
  marketMid: 950_000,
  marketHigh: 1_100_000,
  verdict: "fair",
  verdictLabel: "Fair · within market range",
  summary:
    "Your quoted price aligns with typical commercial fit-out ranges for Ortigas. It sits near the market midpoint for similar scope and finish tier.",
  confidencePct: 81,
  sources: [
    {
      title: "Philippines interior construction cost guide (2025)",
      url: "https://example.com/market-ref-1",
    },
    {
      title: "Metro Manila office fit-out benchmarks",
      url: "https://example.com/market-ref-2",
    },
  ],
};

export function getMockClientMarketInsight(projectTitle?: string): MockClientMarketInsight {
  return {
    ...MOCK_CLIENT_MARKET_INSIGHT,
    projectTitle: projectTitle?.trim() || MOCK_CLIENT_MARKET_INSIGHT.projectTitle,
  };
}

export function formatPhp(amount: number, compact = false): string {
  if (compact && Math.abs(amount) >= 1_000_000) {
    return `₱ ${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (compact && Math.abs(amount) >= 1_000) {
    return `₱ ${(amount / 1_000).toFixed(0)}k`;
  }
  return `₱ ${amount.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
