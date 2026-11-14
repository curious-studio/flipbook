import { openDB } from 'idb'
import type { Book } from '../types'

const DB_NAME = 'flipbook-db'
const STORE = 'books'

async function db() {
  return openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: 'id' })
      }
    },
  })
}

export async function saveBook(book: Book): Promise<void> {
  const d = await db()
  await d.put(STORE, book)
}

export async function listBooks(): Promise<Book[]> {
  const d = await db()
  const all = await d.getAll(STORE)
  return (all as Book[]).sort((a, b) => b.createdAt - a.createdAt)
}

export async function getBook(id: string): Promise<Book | undefined> {
  const d = await db()
  return d.get(STORE, id) as Promise<Book | undefined>
}

export async function deleteBook(id: string): Promise<void> {
  const d = await db()
  await d.delete(STORE, id)
}