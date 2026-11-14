export interface BookPage {
  id: string
  dataUrl: string
  width: number
  height: number
  name?: string
}

export interface Book {
  id: string
  title: string
  pages: BookPage[]
  createdAt: number
  updatedAt?: number
}

export interface BookSummary {
  id: string
  title: string
  pageCount: number
  createdAt: number
  updatedAt: number
}

export type ExportFormat = 'html' | 'pdf' | 'pdf-single' | 'zip'
