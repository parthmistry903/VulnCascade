import { describe, expect, it } from "vitest";
import { packageRiskScore, riskLabel, scanRiskScore } from "@/lib/risk";

describe("risk scoring", () => {
  it("labels risk thresholds", () => {
    expect(riskLabel(0)).toBe("Clean");
    expect(riskLabel(3.9)).toBe("Low");
    expect(riskLabel(6.9)).toBe("Medium");
    expect(riskLabel(8.9)).toBe("High");
    expect(riskLabel(9)).toBe("Critical");
  });

  it("weights package risk by blast radius and caps at 10", () => {
    expect(packageRiskScore(7.4, 2)).toBe(8.21);
    expect(packageRiskScore(9.8, 500)).toBe(10);
  });

  it("computes weighted scan risk", () => {
    expect(
      scanRiskScore([
        { riskScore: 8, blastRadiusSize: 2 },
        { riskScore: 4, blastRadiusSize: 1 },
        { riskScore: 0, blastRadiusSize: 0 }
      ])
    ).toBe(6.67);
  });
});
