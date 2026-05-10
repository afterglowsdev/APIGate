/** Minimal type declarations for @netlify/blobs — dynamic import, only used in Netlify runtime */
declare module '@netlify/blobs' {
  interface BlobStore {
    get(key: string, options?: { type?: 'text' | 'json' }): Promise<string | object | null>
    set(key: string, value: string): Promise<void>
    delete(key: string): Promise<void>
    list(options?: { prefix?: string }): Promise<{ blobs: { key: string }[] }>
  }
  export function getStore(name: string): BlobStore
}
