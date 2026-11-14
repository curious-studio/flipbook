export interface BookPage {
  id: string
  dataUrl: string // data:image/... base64
  width: number
  height: number
  name?: string
}

export interface Book {
  id: string
  title: string
  pages: BookPage[]
  createdAt: number
}

export type ExportFormat = 'html' | 'pdf' | 'zip'