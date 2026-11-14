import fontCss from '../fonts.css?raw'

let embedded: Promise<string> | undefined

/** Embed the same self-hosted fonts and license in standalone HTML exports. */
export function loadEmbeddedFonts(): Promise<string> {
  if (!embedded) {
    embedded = embed().catch((error) => { embedded = undefined; throw error })
  }
  return embedded
}

async function embed(): Promise<string> {
  const paths = [...new Set([...fontCss.matchAll(/url\((\/fonts\/[^)]+)\)/g)].map((match) => match[1]))]
  const fonts = await Promise.all(paths.map(async (path) => {
    const response = await fetch(`${import.meta.env.BASE_URL}${path.slice(1)}`)
    if (!response.ok) throw new Error('Could not load the fonts for the offline viewer. Please retry.')
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (String.fromCharCode(...bytes.slice(0, 4)) !== 'wOF2') throw new Error('The font file could not be loaded.')
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Could not embed the viewer font.'))
      reader.readAsDataURL(new Blob([bytes], { type: 'font/woff2' }))
    })
    return [path, dataUrl] as const
  }))
  const response = await fetch(`${import.meta.env.BASE_URL}fonts/OFL.txt`)
  if (!response.ok) throw new Error('Could not load the font license for export.')
  const license = (await response.text()).replace(/\*\//g, '* /').replace(/</g, '&lt;')
  let css = fontCss
  for (const [path, url] of fonts) css = css.replaceAll(path, url)
  return `/* Fira Sans — SIL Open Font License\n${license}\n*/\n${css}`
}
