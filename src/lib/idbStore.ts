import { openDB } from 'idb'
import type { Book, BookSummary } from '../types'

function summary(book: Book): BookSummary {
  return { id: book.id, title: book.title, pageCount: book.pages.length, createdAt: book.createdAt, updatedAt: book.updatedAt ?? book.createdAt }
}

const connection = openDB('flipbook-db', 2, {
  async upgrade(d, oldVersion, _newVersion, transaction) {
    if (oldVersion < 1) d.createObjectStore('books', { keyPath: 'id' })
    if (oldVersion < 2) {
      const metadata = d.createObjectStore('metadata', { keyPath: 'id' })
      let cursor = await transaction.objectStore('books').openCursor()
      while (cursor) {
        await metadata.put(summary(cursor.value as Book))
        cursor = await cursor.continue()
      }
    }
  },
})

export async function saveBook(book: Book): Promise<void> {
  const d = await connection
  const tx = d.transaction(['books', 'metadata'], 'readwrite')
  await tx.objectStore('books').put(book)
  await tx.objectStore('metadata').put(summary(book))
  await tx.done
}

export async function listBooks(): Promise<BookSummary[]> {
  const d = await connection
  const all = await d.getAll('metadata') as BookSummary[]
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getBook(id: string): Promise<Book | undefined> {
  return (await connection).get('books', id) as Promise<Book | undefined>
}

export async function deleteBook(id: string): Promise<void> {
  const tx = (await connection).transaction(['books', 'metadata'], 'readwrite')
  await tx.objectStore('books').delete(id)
  await tx.objectStore('metadata').delete(id)
  await tx.done
}
