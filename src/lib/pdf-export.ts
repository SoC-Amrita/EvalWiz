import { toCanvas } from "html-to-image"
import jsPDF from "jspdf"
import { PALETTE_THEMES, isDarkPaletteTheme, type PaletteTheme } from "./palette-theme"

type PdfExportOptions = {
  orientation?: "portrait" | "landscape"
  margin?: number
  pixelRatio?: number
}

type CaptureOptions = {
  pixelRatio?: number
  backgroundColor?: string
  forceLightTheme?: boolean
  forcePaletteTheme?: PaletteTheme
  forceSerifFont?: boolean
}

export const captureElementAsImage = async (
  elementId: string,
  options: CaptureOptions = {}
) => {
  const element = document.getElementById(elementId)
  if (!element) throw new Error("Element not found")

  const width = element.scrollWidth
  const height = element.scrollHeight
  const html = document.documentElement
  const previousThemes = PALETTE_THEMES.filter((theme) => html.classList.contains(theme))
  const previousFont = html.dataset.font
  const hadSansFont = html.classList.contains("font-style-sans")
  const hadSerifFont = html.classList.contains("font-style-serif")
  const previousColorScheme = html.style.colorScheme
  const forcedPaletteTheme = options.forcePaletteTheme ?? (options.forceLightTheme ? "aurora" : null)

  try {
    if (forcedPaletteTheme) {
      html.classList.remove(...PALETTE_THEMES)
      html.classList.add(forcedPaletteTheme)
      html.style.colorScheme = isDarkPaletteTheme(forcedPaletteTheme) ? "dark" : "light"
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    }

    if (options.forceSerifFont) {
      html.classList.remove("font-style-sans", "font-style-serif")
      html.classList.add("font-style-serif")
      html.dataset.font = "serif"
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    }

    const canvas = await toCanvas(element, {
      pixelRatio: options.pixelRatio ?? 2.5,
      backgroundColor: options.backgroundColor ?? "#ffffff",
      width,
      height,
      style: {
        transform: "scale(1)",
        transformOrigin: "top left",
        margin: "0",
      },
    })

    return {
      imgData: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    }
  } finally {
    if (forcedPaletteTheme) {
      html.classList.remove(...PALETTE_THEMES)
      previousThemes.forEach((theme) => html.classList.add(theme))
      html.style.colorScheme = previousColorScheme
    }

    if (options.forceSerifFont) {
      html.classList.remove("font-style-sans", "font-style-serif")
      if (hadSansFont) html.classList.add("font-style-sans")
      if (hadSerifFont) html.classList.add("font-style-serif")

      if (previousFont) {
        html.dataset.font = previousFont
      } else {
        delete html.dataset.font
      }
    }
  }
}

export const downloadElementAsPDF = async (
  elementId: string,
  filename: string = "report.pdf",
  options: PdfExportOptions = {}
) => {
  try {
    const { imgData, width, height } = await captureElementAsImage(elementId, {
      pixelRatio: options.pixelRatio,
    })
    const pdfOrientation = options.orientation === "portrait" ? "p" : "l"
    const margin = options.margin ?? 24
    const pdf = new jsPDF({
      orientation: pdfOrientation,
      unit: "px",
      format: "a4",
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const printableWidth = pageWidth - margin * 2
    const printableHeight = pageHeight - margin * 2
    const renderedHeight = (height * printableWidth) / width

    let offsetY = 0
    let remainingHeight = renderedHeight

    pdf.addImage(imgData, "PNG", margin, margin + offsetY, printableWidth, renderedHeight)

    while (remainingHeight > printableHeight) {
      offsetY -= printableHeight
      remainingHeight -= printableHeight
      pdf.addPage()
      pdf.addImage(imgData, "PNG", margin, margin + offsetY, printableWidth, renderedHeight)
    }

    pdf.save(filename)
    return true
  } catch (error) {
    console.error("PDF generation failed:", error)
    throw error
  }
}
