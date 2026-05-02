import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  prepareReceiptImageForAnalysis,
  rotateReceiptImageForAnalysis,
} from './receipt-image-preparation'

describe('prepareReceiptImageForAnalysis', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('re-encodes JPEGs through an orientation-aware bitmap before OCR parsing', async () => {
    const imageBitmap = createImageBitmapStub({ width: 1200, height: 800 })
    const createImageBitmapMock = vi.fn().mockResolvedValue(imageBitmap)
    vi.stubGlobal('createImageBitmap', createImageBitmapMock)
    const { canvas, drawImage } = stubCanvas(
      new Blob(['normalized'], { type: 'image/jpeg' }),
    )
    const file = new File(['receipt'], 'receipt.jpeg', {
      type: 'image/jpeg',
      lastModified: 123,
    })

    const preparedFile = await prepareReceiptImageForAnalysis(file)

    expect(createImageBitmapMock).toHaveBeenCalledWith(file, {
      imageOrientation: 'from-image',
    })
    expect(canvas.width).toBe(1200)
    expect(canvas.height).toBe(800)
    expect(drawImage).toHaveBeenCalledWith(imageBitmap, 0, 0, 1200, 800)
    expect(imageBitmap.close).toHaveBeenCalled()
    expect(preparedFile).not.toBe(file)
    expect(preparedFile.name).toBe('receipt.jpg')
    expect(preparedFile.type).toBe('image/jpeg')
    expect(preparedFile.lastModified).toBe(123)
    await expect(preparedFile.text()).resolves.toBe('normalized')
  })

  it('keeps unsupported image types when no resize or conversion is needed', async () => {
    const imageBitmap = createImageBitmapStub({ width: 400, height: 300 })
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(imageBitmap))
    stubCanvas(new Blob(['unused'], { type: 'image/gif' }))
    const file = new File(['receipt'], 'receipt.gif', { type: 'image/gif' })

    await expect(prepareReceiptImageForAnalysis(file)).resolves.toBe(file)
    expect(imageBitmap.close).toHaveBeenCalled()
  })

  it('falls back to the original image when browser image preparation is unavailable', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })

    await expect(prepareReceiptImageForAnalysis(file)).resolves.toBe(file)
  })

  it('mechanically rotates an image before retrying OCR parsing', async () => {
    const imageBitmap = createImageBitmapStub({ width: 300, height: 500 })
    const createImageBitmapMock = vi.fn().mockResolvedValue(imageBitmap)
    vi.stubGlobal('createImageBitmap', createImageBitmapMock)
    const { canvas, drawImage, rotate, translate } = stubCanvas(
      new Blob(['rotated'], { type: 'image/jpeg' }),
    )
    const file = new File(['prepared'], 'receipt.jpg', {
      type: 'image/jpeg',
      lastModified: 123,
    })

    const rotatedFile = await rotateReceiptImageForAnalysis(file, 90)

    expect(createImageBitmapMock).toHaveBeenCalledWith(file, {
      imageOrientation: 'none',
    })
    expect(canvas.width).toBe(500)
    expect(canvas.height).toBe(300)
    expect(translate).toHaveBeenCalledWith(500, 0)
    expect(rotate).toHaveBeenCalledWith(Math.PI / 2)
    expect(drawImage).toHaveBeenCalledWith(imageBitmap, 0, 0)
    expect(rotatedFile.name).toBe('receipt.jpg')
    expect(rotatedFile.type).toBe('image/jpeg')
    expect(rotatedFile.lastModified).toBe(123)
    await expect(rotatedFile.text()).resolves.toBe('rotated')
  })
})

function createImageBitmapStub({
  width,
  height,
}: {
  width: number
  height: number
}) {
  return {
    width,
    height,
    close: vi.fn(),
  } as unknown as ImageBitmap
}

function stubCanvas(blob: Blob) {
  const originalCreateElement = document.createElement.bind(document)
  const drawImage = vi.fn()
  const rotate = vi.fn()
  const translate = vi.fn()
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage, rotate, translate })),
    toBlob: vi.fn(
      (callback: BlobCallback, _type?: string, _quality?: number) => {
        callback(blob)
      },
    ),
  } as unknown as HTMLCanvasElement

  vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
    if (tagName === 'canvas') {
      return canvas
    }

    return originalCreateElement(tagName)
  })

  return { canvas, drawImage, rotate, translate }
}
