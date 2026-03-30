import { beforeEach, describe, expect, it, vi } from "vitest"

const toCanvasMock = vi.fn()
const addImageMock = vi.fn()
const addPageMock = vi.fn()
const saveMock = vi.fn()
const jsPdfConstructorMock = vi.fn()

class MockJsPDF {
  internal = {
    pageSize: {
      getWidth: () => 400,
      getHeight: () => 300,
    },
  }

  constructor(options: unknown) {
    jsPdfConstructorMock(options)
  }

  addImage = addImageMock
  addPage = addPageMock
  save = saveMock
}

vi.mock("html-to-image", () => ({
  toCanvas: toCanvasMock,
}))

vi.mock("jspdf", () => ({
  default: MockJsPDF,
}))

function createClassList(initial: string[]) {
  const classes = new Set(initial)

  return {
    add: (...tokens: string[]) => {
      for (const token of tokens) classes.add(token)
    },
    remove: (...tokens: string[]) => {
      for (const token of tokens) classes.delete(token)
    },
    contains: (token: string) => classes.has(token),
  }
}

describe("pdf-export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("captures an element while temporarily forcing light theme and serif font", async () => {
    const element = {
      scrollWidth: 800,
      scrollHeight: 1200,
    }
    const html = {
      classList: createClassList(["dark", "neon", "font-style-sans"]),
      dataset: { font: "sans" },
      style: { colorScheme: "dark" },
    }
    const canvas = {
      width: 1600,
      height: 2400,
      toDataURL: vi.fn(() => "data:image/png;base64,preview"),
    }

    vi.stubGlobal("document", {
      getElementById: vi.fn(() => element),
      documentElement: html,
    })
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    toCanvasMock.mockResolvedValue(canvas)

    const { captureElementAsImage } = await import("@/lib/pdf-export")

    const result = await captureElementAsImage("report", {
      forceLightTheme: true,
      forceSerifFont: true,
      pixelRatio: 3,
    })

    expect(toCanvasMock).toHaveBeenCalledWith(element, {
      pixelRatio: 3,
      backgroundColor: "#ffffff",
      width: 800,
      height: 1200,
      style: {
        transform: "scale(1)",
        transformOrigin: "top left",
        margin: "0",
      },
    })
    expect(result).toEqual({
      imgData: "data:image/png;base64,preview",
      width: 1600,
      height: 2400,
    })
    expect(html.classList.contains("dark")).toBe(true)
    expect(html.classList.contains("neon")).toBe(true)
    expect(html.classList.contains("font-style-sans")).toBe(true)
    expect(html.classList.contains("classic")).toBe(false)
    expect(html.classList.contains("font-style-serif")).toBe(false)
    expect(html.dataset.font).toBe("sans")
    expect(html.style.colorScheme).toBe("dark")
  })

  it("creates a paginated PDF from the captured image", async () => {
    const pdfModule = await import("@/lib/pdf-export")
    vi.spyOn(pdfModule, "captureElementAsImage").mockResolvedValue({
      imgData: "data:image/png;base64,report",
      width: 1000,
      height: 2000,
    })

    await expect(
      pdfModule.downloadElementAsPDF("report", "summary.pdf", {
        orientation: "portrait",
        margin: 20,
      })
    ).resolves.toBe(true)

    expect(jsPdfConstructorMock).toHaveBeenCalledWith({
      orientation: "p",
      unit: "px",
      format: "a4",
    })
    expect(addImageMock).toHaveBeenCalledTimes(3)
    expect(addPageMock).toHaveBeenCalledTimes(2)
    expect(saveMock).toHaveBeenCalledWith("summary.pdf")
  })
})
