import AppKit
import Foundation

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let iconset = root.appendingPathComponent("apps/desktop/build/icon.iconset", isDirectory: true)
let output = root.appendingPathComponent("apps/desktop/build/icon.icns")

try? FileManager.default.removeItem(at: iconset)
try? FileManager.default.removeItem(at: output)
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)

let sizes: [(String, Int)] = [
  ("icon_16x16.png", 16),
  ("icon_16x16@2x.png", 32),
  ("icon_32x32.png", 32),
  ("icon_32x32@2x.png", 64),
  ("icon_128x128.png", 128),
  ("icon_128x128@2x.png", 256),
  ("icon_256x256.png", 256),
  ("icon_256x256@2x.png", 512),
  ("icon_512x512.png", 512),
  ("icon_512x512@2x.png", 1024)
]

func drawIcon(size: Int) -> NSImage {
  let image = NSImage(size: NSSize(width: size, height: size))
  image.lockFocus()
  defer { image.unlockFocus() }

  let rect = NSRect(x: 0, y: 0, width: size, height: size)
  NSColor(calibratedRed: 0.95, green: 0.97, blue: 0.96, alpha: 1).setFill()
  rect.fill()

  let inset = CGFloat(size) * 0.12
  let roundedRect = NSRect(x: inset, y: inset, width: CGFloat(size) - inset * 2, height: CGFloat(size) - inset * 2)
  let bodyPath = NSBezierPath(roundedRect: roundedRect, xRadius: CGFloat(size) * 0.12, yRadius: CGFloat(size) * 0.12)
  NSColor(calibratedRed: 0.07, green: 0.28, blue: 0.29, alpha: 1).setFill()
  bodyPath.fill()

  let topBand = NSRect(
    x: roundedRect.minX,
    y: roundedRect.maxY - CGFloat(size) * 0.18,
    width: roundedRect.width,
    height: CGFloat(size) * 0.18
  )
  let topPath = NSBezierPath(roundedRect: topBand, xRadius: CGFloat(size) * 0.10, yRadius: CGFloat(size) * 0.10)
  NSColor(calibratedRed: 0.94, green: 0.68, blue: 0.18, alpha: 1).setFill()
  topPath.fill()

  let sheetRect = NSRect(
    x: CGFloat(size) * 0.28,
    y: CGFloat(size) * 0.24,
    width: CGFloat(size) * 0.44,
    height: CGFloat(size) * 0.47
  )
  let sheetPath = NSBezierPath(roundedRect: sheetRect, xRadius: CGFloat(size) * 0.035, yRadius: CGFloat(size) * 0.035)
  NSColor(calibratedRed: 0.99, green: 0.99, blue: 0.96, alpha: 1).setFill()
  sheetPath.fill()

  NSColor(calibratedRed: 0.07, green: 0.28, blue: 0.29, alpha: 0.28).setStroke()
  for index in 0..<4 {
    let y = sheetRect.maxY - CGFloat(index + 1) * sheetRect.height / 5
    let line = NSBezierPath()
    line.lineWidth = max(1, CGFloat(size) * 0.009)
    line.move(to: NSPoint(x: sheetRect.minX + CGFloat(size) * 0.055, y: y))
    line.line(to: NSPoint(x: sheetRect.maxX - CGFloat(size) * 0.055, y: y))
    line.stroke()
  }

  NSColor(calibratedRed: 0.94, green: 0.68, blue: 0.18, alpha: 1).setFill()
  let playPath = NSBezierPath()
  playPath.move(to: NSPoint(x: CGFloat(size) * 0.45, y: CGFloat(size) * 0.40))
  playPath.line(to: NSPoint(x: CGFloat(size) * 0.45, y: CGFloat(size) * 0.55))
  playPath.line(to: NSPoint(x: CGFloat(size) * 0.58, y: CGFloat(size) * 0.475))
  playPath.close()
  playPath.fill()

  return image
}

for (name, size) in sizes {
  let image = drawIcon(size: size)
  guard let tiff = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        let png = bitmap.representation(using: .png, properties: [:]) else {
    throw NSError(domain: "RosterIcon", code: 1, userInfo: [NSLocalizedDescriptionKey: "无法生成图标 \(name)"])
  }
  try png.write(to: iconset.appendingPathComponent(name))
}
