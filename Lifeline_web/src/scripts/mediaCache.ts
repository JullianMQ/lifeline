import type { MediaFile, MediaType } from "../components/MediaModal";

type CacheEntry = {
  files: MediaFile[];
  cachedAt: number;
};

const MEDIA_CACHE_PREFIX = "lifeline.mediaCache";
const BYPASS_PREFIX = "lifeline.mediaCacheBypass";

const buildKey = (userId: string, mediaType: MediaType) => `${userId}::${mediaType}`;
const buildStorageKey = (userId: string, mediaType: MediaType) => `${MEDIA_CACHE_PREFIX}.${buildKey(userId, mediaType)}`;
const buildBypassKey = (userId: string) => `${BYPASS_PREFIX}.${userId}`;

const readCacheEntry = (userId: string, mediaType: MediaType): CacheEntry | null => {
  try {
    const raw = localStorage.getItem(buildStorageKey(userId, mediaType));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || !Array.isArray(parsed.files)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCacheEntry = (userId: string, mediaType: MediaType, entry: CacheEntry) => {
  try {
    localStorage.setItem(buildStorageKey(userId, mediaType), JSON.stringify(entry));
  } catch {
    // Ignore storage errors (quota, disabled, etc.)
  }
};

const readBypassUntil = (userId: string): number | null => {
  try {
    const raw = localStorage.getItem(buildBypassKey(userId));
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

const writeBypassUntil = (userId: string, until: number) => {
  try {
    localStorage.setItem(buildBypassKey(userId), String(until));
  } catch {
    // Ignore storage errors
  }
};

export const getCachedMedia = (userId: string, mediaType: MediaType): MediaFile[] | null => {
  const bypassUntil = readBypassUntil(userId);
  if (bypassUntil && Date.now() < bypassUntil) {
    return null;
  }

  const entry = readCacheEntry(userId, mediaType);
  return entry?.files ?? null;
};

export const isMediaCacheBypassActive = (userId: string): boolean => {
  const bypassUntil = readBypassUntil(userId);
  return Boolean(bypassUntil && Date.now() < bypassUntil);
};

export const setCachedMedia = (userId: string, mediaType: MediaType, files: MediaFile[]) => {
  if (!Array.isArray(files) || files.length === 0) {
    return;
  }
  writeCacheEntry(userId, mediaType, {
    files,
    cachedAt: Date.now(),
  });
};

export const clearMediaCache = () => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(`${MEDIA_CACHE_PREFIX}.`) || key.startsWith(`${BYPASS_PREFIX}.`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch {
    // Ignore storage errors
  }
};

export const clearMediaCacheForUser = (userId: string) => {
  try {
    const prefix = `${MEDIA_CACHE_PREFIX}.${userId}::`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });
    localStorage.removeItem(buildBypassKey(userId));
  } catch {
    // Ignore storage errors
  }
};

export const bypassMediaCacheForUser = (userId: string, minutes = 10) => {
  const durationMs = minutes * 60 * 1000;
  writeBypassUntil(userId, Date.now() + durationMs);
};

export const handleSosMediaCache = (userId: string, minutes = 10) => {
  clearMediaCacheForUser(userId);
  bypassMediaCacheForUser(userId, minutes);
};
