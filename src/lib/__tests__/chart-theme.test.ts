import { describe, it, expect } from "vitest"
import { getSectionColor, getCorrelationColor, getHeatColor, CHART_SERIES_COLORS, CHART_THEME } from "@/lib/chart-theme"

describe("getSectionColor", () => {
  it("returns the first color for index 0", () => {
    expect(getSectionColor(0)).toBe(CHART_SERIES_COLORS[0])
  })

  it("returns the second color for index 1", () => {
    expect(getSectionColor(1)).toBe(CHART_SERIES_COLORS[1])
  })

  it("wraps around when index exceeds the color array length", () => {
    const len = CHART_SERIES_COLORS.length
    expect(getSectionColor(len)).toBe(CHART_SERIES_COLORS[0])
    expect(getSectionColor(len + 1)).toBe(CHART_SERIES_COLORS[1])
  })

  it("handles large indices via modulo", () => {
    const len = CHART_SERIES_COLORS.length
    expect(getSectionColor(100)).toBe(CHART_SERIES_COLORS[100 % len])
  })
})

describe("getCorrelationColor", () => {
  it("returns strong-pos color for value >= 0.8", () => {
    expect(getCorrelationColor(1.0)).toBe("var(--correlation-strong-pos)")
    expect(getCorrelationColor(0.8)).toBe("var(--correlation-strong-pos)")
  })

  it("returns pos color for value >= 0.6 and < 0.8", () => {
    expect(getCorrelationColor(0.7)).toBe("var(--correlation-pos)")
    expect(getCorrelationColor(0.6)).toBe("var(--correlation-pos)")
  })

  it("returns soft-pos color for value >= 0.4 and < 0.6", () => {
    expect(getCorrelationColor(0.5)).toBe("var(--correlation-soft-pos)")
  })

  it("returns faint-pos color for value >= 0.2 and < 0.4", () => {
    expect(getCorrelationColor(0.3)).toBe("var(--correlation-faint-pos)")
  })

  it("returns neutral color for value >= 0 and < 0.2", () => {
    expect(getCorrelationColor(0.1)).toBe("var(--correlation-neutral)")
    expect(getCorrelationColor(0)).toBe("var(--correlation-neutral)")
  })

  it("returns faint-neg color for value >= -0.2 and < 0", () => {
    expect(getCorrelationColor(-0.1)).toBe("var(--correlation-faint-neg)")
  })

  it("returns soft-neg color for value >= -0.4 and < -0.2", () => {
    expect(getCorrelationColor(-0.3)).toBe("var(--correlation-soft-neg)")
  })

  it("returns neg color for value >= -0.6 and < -0.4", () => {
    expect(getCorrelationColor(-0.5)).toBe("var(--correlation-neg)")
  })

  it("returns strong-neg color for value < -0.6", () => {
    expect(getCorrelationColor(-0.7)).toBe("var(--correlation-strong-neg)")
    expect(getCorrelationColor(-1.0)).toBe("var(--correlation-strong-neg)")
  })
})

describe("getHeatColor", () => {
  it("returns heatEmpty color for null value", () => {
    expect(getHeatColor(null)).toBe(CHART_THEME.heatEmpty)
  })

  it("returns heatHot color for value >= 80", () => {
    expect(getHeatColor(80)).toBe(CHART_THEME.heatHot)
    expect(getHeatColor(100)).toBe(CHART_THEME.heatHot)
  })

  it("returns heatHigh color for value >= 65 and < 80", () => {
    expect(getHeatColor(65)).toBe(CHART_THEME.heatHigh)
    expect(getHeatColor(79)).toBe(CHART_THEME.heatHigh)
  })

  it("returns heatMid color for value >= 50 and < 65", () => {
    expect(getHeatColor(50)).toBe(CHART_THEME.heatMid)
    expect(getHeatColor(64)).toBe(CHART_THEME.heatMid)
  })

  it("returns heatLow color for value >= 35 and < 50", () => {
    expect(getHeatColor(35)).toBe(CHART_THEME.heatLow)
    expect(getHeatColor(49)).toBe(CHART_THEME.heatLow)
  })

  it("returns destructive color for value < 35", () => {
    expect(getHeatColor(34)).toBe("var(--destructive)")
    expect(getHeatColor(0)).toBe("var(--destructive)")
  })
})
