import { NextRequest, NextResponse } from "next/server";

interface ProjectionInput {
  monthlyAmount: number;
  stepUpPct: number;
  years: number;
  expectedReturn: number; // annual % e.g. 12
}

interface YearlyDataPoint {
  year: number;
  invested: number;
  value: number;
  gain: number;
}

function projectSIP(input: ProjectionInput): YearlyDataPoint[] {
  const { stepUpPct, years, expectedReturn } = input;
  const monthlyRate = expectedReturn / 100 / 12;
  const points: YearlyDataPoint[] = [];

  let totalValue = 0;
  let totalInvested = 0;
  let currentMonthly = input.monthlyAmount;

  for (let y = 1; y <= years; y++) {
    // Each year: 12 months of SIP at current monthly amount
    for (let m = 0; m < 12; m++) {
      totalValue = (totalValue + currentMonthly) * (1 + monthlyRate);
      totalInvested += currentMonthly;
    }
    points.push({
      year: y,
      invested: Math.round(totalInvested),
      value: Math.round(totalValue),
      gain: Math.round(totalValue - totalInvested),
    });
    // Step up at start of each new year
    currentMonthly = Math.round(currentMonthly * (1 + stepUpPct / 100));
  }

  return points;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ProjectionInput;
    const { monthlyAmount, stepUpPct, years, expectedReturn } = body;

    if (!monthlyAmount || !years) {
      return NextResponse.json({ error: "monthlyAmount and years are required" }, { status: 400 });
    }

    const data = projectSIP({
      monthlyAmount,
      stepUpPct: stepUpPct ?? 0,
      years: Math.min(years, 40),
      expectedReturn: expectedReturn ?? 12,
    });

    const final = data[data.length - 1];
    return NextResponse.json({
      data,
      summary: {
        totalInvested: final.invested,
        finalValue: final.value,
        totalGain: final.gain,
        xReturn: (final.value / final.invested).toFixed(2),
      },
    });
  } catch (err) {
    console.error("[project POST]", err);
    return NextResponse.json({ error: "Projection failed" }, { status: 500 });
  }
}
