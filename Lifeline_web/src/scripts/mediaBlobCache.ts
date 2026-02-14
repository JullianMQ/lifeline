type BlobCacheEntry = {
  fileId: number;
  userId: string;
  contentType: string;
  blob: Blob;
  createdAt: number;
};

const DB_NAME = "lifeline_media";
const DB_VERSION = 1;
const STORE_NAME = "mediaBlobs";

let dbPromise: Promise<IDBDatabase> | null = null;

const canUseIndexedDb = () => typeof indexedDB !== "undefined";

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "fileId" });
        store.createIndex("userId", "userId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
  return dbPromise;
};

const wrapRequest = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
});

export const getCachedBlob = async (fileId: number): Promise<BlobCacheEntry | null> => {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const result = await wrapRequest<BlobCacheEntry | undefined>(store.get(fileId));
    return result || null;
  } catch {
    return null;
  }
};

export const setCachedBlob = async (fileId: number, userId: string, blob: Blob, contentType: string) => {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const entry: BlobCacheEntry = {
      fileId,
      userId,
      blob,
      contentType,
      createdAt: Date.now(),
    };
    await wrapRequest(store.put(entry));
  } catch {
    // Ignore storage errors
  }
};

export const clearBlobCache = async () => {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await wrapRequest(store.clear());
  } catch {
    // Ignore storage errors
  }
};

export const clearBlobCacheForUser = async (userId: string) => {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("userId");
    const range = IDBKeyRange.only(userId);
    const cursorRequest = index.openCursor(range);
    await new Promise<void>((resolve) => {
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.delete();
        cursor.continue();
      };
      cursorRequest.onerror = () => resolve();
    });
  } catch {
    // Ignore storage errors
  }
};
