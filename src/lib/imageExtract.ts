export async function extractImages(
  files: File[],
  onProgress?: (p: { current: number; total: number }) => void
): Promise<{ dataUrl: string; width: number; height: number; name: string }[]> {
  const out: { dataUrl: string; width: number; height: number; name: string }[] = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const dataUrl = await readFileAsDataUrl(f)
    const dims = await getImageDimensions(dataUrl)
    out.push({ dataUrl, width: dims.width, height: dims.height, name: f.name })
    onProgress?.({ current: i + 1, total: files.length })
  }
  return out
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error("This image could not be decoded. Try a PNG, JPEG, or WebP file."))
    img.src = src
  })
}