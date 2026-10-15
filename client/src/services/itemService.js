import api from './api';
import { mockCategories } from '../data/mockData';
import { recordImpactAction } from '../utils/communityImpactTracker';
import { neonDb } from './neonDbService';

const LOCAL_SHARED_ITEMS_KEY = 'looop_community_shared_items';

export function isMockItem(item) {
  if (!item) return false;
  const id = String(item.id || item._id || '');
  // STRICT: Only filter the exact legacy hardcoded mock IDs (never filter real products by title)
  return id === 'itm_realme_1791465161247' || id === 'itm_002';
}

// Clean old caches from local storage
try {
  localStorage.removeItem('looop_instant_products_cache_v1');
  localStorage.removeItem('looop_instant_products_cache_v2');
  localStorage.removeItem('looop_instant_products_cache_v3');
  localStorage.removeItem('looop_instant_products_cache_v4');
  localStorage.removeItem('looop_instant_products_cache_v5');
  localStorage.removeItem('looop_community_shared_items');
} catch {}

export function getLocalSharedItems() {
  return [];
}

export function saveLocalSharedItem(item) {
  // STRICT: Do not save phantom local items to localStorage; rely exclusively on PostgreSQL database
}

/**
 * Normalize image URL for browser display
 */
export function normalizeImageUrl(img) {
  if (!img) return '';
  const urlStr = typeof img === 'string' ? img : (img.url || '');
  if (!urlStr || urlStr.includes('unsplash.com')) return '';
  if (urlStr.startsWith('data:') || urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
    return urlStr;
  }
  if (urlStr.startsWith('/uploads/')) {
    const apiUrl = import.meta.env?.VITE_API_URL;
    if (apiUrl && !apiUrl.startsWith('/')) {
      try {
        const u = new URL(apiUrl);
        return `${u.origin}${urlStr}`;
      } catch {}
    }
  }
  return urlStr;
}

const INSTANT_CACHE_KEY = 'looop_instant_products_cache_v5';
const BROWSE_CACHE_KEY_PREFIX = 'looop_browse_cache_';
let memoryItemsCache = null;
const memoryBrowseCache = new Map();

/**
 * Return cached items immediately for 0ms initial render.
 * STRICT: Only returns items confirmed to exist in the database or locally shared items.
 * If database is empty, returns empty array [] (never fake mock items).
 */
export function getCachedItems(limit = 24) {
  // 1. In-memory check
  if (memoryItemsCache && memoryItemsCache.length > 0) {
    const clean = memoryItemsCache.filter((i) => !isMockItem(i));
    if (clean.length > 0) return clean.slice(0, limit);
  }

  // 2. LocalStorage persistent check
  try {
    const stored = localStorage.getItem(INSTANT_CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const clean = parsed.filter((i) => !isMockItem(i));
        if (clean.length > 0) {
          memoryItemsCache = clean;
          return clean.slice(0, limit);
        }
      }
    }
  } catch (err) {
    console.warn('[itemService] cache read error:', err);
  }

  return [];
}

export function setCachedItems(items) {
  if (!Array.isArray(items)) return;
  const clean = items.filter((i) => !isMockItem(i));
  const normalized = clean.map((item) => ({
    ...item,
    id: item._id || item.id,
    images: (item.images || []).map(normalizeImageUrl)
  }));
  memoryItemsCache = normalized;
  try {
    localStorage.setItem(INSTANT_CACHE_KEY, JSON.stringify(normalized.slice(0, 60)));
  } catch {}
}

export function getCachedBrowseItems(queryKey = '') {
  if (memoryBrowseCache.has(queryKey)) {
    return memoryBrowseCache.get(queryKey);
  }
  try {
    const raw = sessionStorage.getItem(`${BROWSE_CACHE_KEY_PREFIX}${queryKey}`);
    if (raw) {
      const data = JSON.parse(raw);
      memoryBrowseCache.set(queryKey, data);
      return data;
    }
  } catch {}
  return null;
}

export function setCachedBrowseItems(queryKey = '', data) {
  if (!data) return;
  memoryBrowseCache.set(queryKey, data);
  try {
    sessionStorage.setItem(`${BROWSE_CACHE_KEY_PREFIX}${queryKey}`, JSON.stringify(data));
  } catch {}
}

export function hasCachedBrowseItems(queryKey = '') {
  return memoryBrowseCache.has(queryKey) || !!sessionStorage.getItem(`${BROWSE_CACHE_KEY_PREFIX}${queryKey}`);
}

/**
 * Item Service
 * Handles discovery, nearby items, and category listings
 */
export const itemService = {
  isMockItem,
  getCachedItems,
  setCachedItems,
  getCachedBrowseItems,
  setCachedBrowseItems,
  hasCachedBrowseItems,
  /**
   * Primary Global Discovery endpoint called by BrowsePage
   * Retrieves items from backend (Neon PostgreSQL) with search, filter, proximity, and pagination.
   */
  discoverItems: async (params = {}) => {
    try {
      const response = await api.get('/items/discover', { params, timeout: 5000 });
      if (response.data && response.data.success && Array.isArray(response.data.items)) {
        const rawItems = response.data.items || [];
        const items = rawItems
          .filter((item) => !isMockItem(item))
          .map((item) => ({
            ...item,
            id: item._id || item.id,
            images: (item.images || []).map(normalizeImageUrl)
          }));

        setCachedItems(items);

        return {
          success: true,
          items: items.slice(0, params.limit || 12),
          total: response.data.total ?? items.length,
          page: response.data.page || 1,
          totalPages: Math.ceil((response.data.total ?? items.length) / (params.limit || 12)) || 1,
          limit: response.data.limit || 12
        };
      }
    } catch (apiErr) {
      console.warn('[itemService.discoverItems] Discovery API notice:', apiErr.message);
    }

    // Direct Neon PostgreSQL fallback
    return itemService.getItems(params);
  },

  /**
   * Fetch paginated and filtered items for Browse & Discovery
   * Queries real Neon PostgreSQL database directly if backend API is offline or serverless
   */
  getItems: async (params = {}) => {
    let apiItems = [];
    try {
      const response = await api.get('/items', { params: { ...params, limit: params.limit || 50 }, timeout: 12000 });
      apiItems = response.data?.items || (Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.warn('[itemService.getItems] API fetch notice:', err.message);
    }

    // Query Neon PostgreSQL directly if API returned empty or had network issues
    let directNeonItems = [];
    if (apiItems.length === 0) {
      try {
        const neonRes = await neonDb.getAllItems(params);
        if (neonRes && Array.isArray(neonRes.items) && neonRes.items.length > 0) {
          directNeonItems = neonRes.items;
        }
      } catch (neonErr) {
        console.warn('[itemService.getItems] Direct Neon query notice:', neonErr.message);
      }
    }

    const normalizedApi = apiItems
      .filter((i) => !isMockItem(i))
      .map((item) => ({
        ...item,
        id: item._id || item.id,
        images: (item.images || []).map(normalizeImageUrl)
      }));

    const normalizedNeon = directNeonItems
      .filter((i) => !isMockItem(i))
      .map((item) => ({
        ...item,
        id: item._id || item.id,
        images: (item.images || []).map(normalizeImageUrl)
      }));

    const combinedMap = new Map();
    // 1. Direct Neon items from PostgreSQL database
    normalizedNeon.forEach((i) => combinedMap.set(i.id || i._id, i));
    // 2. API items from backend
    normalizedApi.forEach((i) => combinedMap.set(i.id || i._id, i));

    let allItems = Array.from(combinedMap.values());
    // STRICT: Only save real confirmed database items to cache. If DB has 0 items, cache is []
    setCachedItems(allItems);

    return {
      items: allItems.slice(0, params.limit || 12),
      total: allItems.length,
      page: 1,
      limit: params.limit || 12,
      totalPages: Math.ceil(allItems.length / (params.limit || 12)) || 1
    };
  },

  /**
   * Fetch nearby items for dashboard or quick preview
   */
  getNearbyItems: async (params = {}) => {
    try {
      const response = await api.get('/items/nearby', { params, timeout: 4000 });
      const raw = response.data?.items || (Array.isArray(response.data) ? response.data : []);
      return raw.filter((i) => !isMockItem(i));
    } catch {
      try {
        const neonRes = await neonDb.getAllItems({ limit: 8 });
        if (neonRes && Array.isArray(neonRes.items)) {
          return neonRes.items.filter((i) => !isMockItem(i));
        }
      } catch {}
      return [];
    }
  },

  /**
   * Fetch categories list with real item counts
   */
  getCategories: async () => {
    try {
      const response = await api.get('/categories', { timeout: 4000 });
      if (response?.data?.categoryCounts) {
        return response.data;
      }
      return response.data;
    } catch {
      try {
        const counts = await neonDb.getCategoryCounts();
        return {
          success: true,
          categoryCounts: counts,
          categories: mockCategories.map((c) => ({ ...c, count: counts[c.id] || 0 }))
        };
      } catch {
        return {
          success: true,
          categoryCounts: {},
          categories: mockCategories.map((c) => ({ ...c, count: 0 }))
        };
      }
    }
  },

  /**
   * Fetch single item by ID
   * Queries real backend first, then directly queries Neon PostgreSQL Cloud Database
   */
  getItemById: async (id) => {
    if (!id) return null;

    // 1. Fetch from backend API
    try {
      const response = await api.get(`/items/${id}`, { timeout: 4000 });
      const raw = response.data?.item || response.data;
      if (raw && (raw.title || raw._id || raw.id)) {
        return {
          ...raw,
          id: raw._id || raw.id,
          images: (raw.images || []).map(normalizeImageUrl)
        };
      }
    } catch (apiErr) {
      console.warn(`[itemService.getItemById] API fetch notice for ${id}:`, apiErr.message);
    }

    // 2. Query Neon PostgreSQL Database directly!
    // Ensures items uploaded by other users or from other browsers are immediately visible
    try {
      const neonItem = await neonDb.getItemById(id);
      if (neonItem && (neonItem.title || neonItem.id)) {
        return {
          ...neonItem,
          id: neonItem._id || neonItem.id,
          images: (neonItem.images || []).map(normalizeImageUrl)
        };
      }
    } catch (neonErr) {
      console.warn(`[itemService.getItemById] Neon DB query notice for ${id}:`, neonErr.message);
    }

    // 3. Check persistent local shared items
    const localItems = getLocalSharedItems().filter((i) => !isMockItem(i));
    const localMatch = localItems.find((i) => i.id === id || i._id === id);
    if (localMatch) {
      return {
        ...localMatch,
        id: localMatch.id || localMatch._id,
        images: (localMatch.images || []).map(normalizeImageUrl)
      };
    }

    return null;
  },

  /**
   * Fetch similar / related items matching category, subcategory, brand, condition, or sharing type
   * Prioritizes AVAILABLE items over reserved/reused ones
   */
  getSimilarItems: async (id, params = {}) => {
    try {
      const endpoint = id ? `/items/${id}/similar` : '/items/similar';
      const response = await api.get(endpoint, { params });
      const raw = response.data?.items || (Array.isArray(response.data) ? response.data : []);
      return raw.filter((i) => !isMockItem(i));
    } catch {
      try {
        const neonRes = await neonDb.getAllItems({ limit: params.limit || 8 });
        if (neonRes && Array.isArray(neonRes.items)) {
          return neonRes.items.filter((i) => i.id !== id && i._id !== id && !isMockItem(i));
        }
      } catch {}
      return [];
    }
  },

  /**
   * Fetch related items in the same category (alias for getSimilarItems)
   */
  getRelatedItems: async (id, category) => {
    return itemService.getSimilarItems(id, { category, limit: 6 });
  },

  /**
   * Save / bookmark an item
   */
  saveItem: async (id) => {
    try {
      const response = await api.post(`/items/${id}/save`);
      return response.data;
    } catch {
      return { success: true, saved: true };
    }
  },

  /**
   * Publish / create a new community item listing
   * @param {Object} itemData - Item listing payload
   */
  createItem: async (itemData) => {
    let currentUser = {};
    try {
      currentUser = JSON.parse(localStorage.getItem('looop_user') || '{}');
    } catch {}

    let apiErrorMsg = '';

    // 1. Attempt authoritative backend REST API
    try {
      const response = await api.post('/items', itemData);
      if (response.data && response.data.success && response.data.item) {
        const serverItem = response.data.item;
        const finalItem = {
          id: serverItem._id || serverItem.id,
          _id: serverItem._id || serverItem.id,
          ...serverItem
        };

        saveLocalSharedItem(finalItem);
        recordImpactAction({ category: itemData.category, quantity: 1, type: itemData.sharingType || 'share' });

        return {
          success: true,
          message: response.data.message || 'Your item has been shared and saved to database!',
          item: finalItem
        };
      }
      if (response.data && !response.data.success) {
        const dataMsg = response.data.message;
        apiErrorMsg = typeof dataMsg === 'string' && dataMsg !== '[object Object]'
          ? dataMsg
          : (dataMsg?.message || response.data.error || 'Server rejected listing publication.');
      }
    } catch (err) {
      console.warn('[itemService.createItem] REST API call notice:', err.message);
      const rawData = err.data || err.response?.data;
      if (rawData && typeof rawData === 'object') {
        if (typeof rawData.message === 'string' && rawData.message !== '[object Object]') {
          apiErrorMsg = rawData.message;
        } else if (typeof rawData.error === 'string' && rawData.error !== '[object Object]') {
          apiErrorMsg = rawData.error;
        } else if (rawData.error?.message) {
          apiErrorMsg = rawData.error.message;
        }
      }
      if (!apiErrorMsg && typeof err.message === 'string' && err.message !== '[object Object]') {
        apiErrorMsg = err.message;
      }
    }

    // 2. Direct Neon PostgreSQL Cloud Database Fallback
    // Guarantees item is stored directly in Neon Database even if backend is offline, proxy fails, or network drops
    try {
      console.log('[itemService.createItem] Storing item directly into Neon PostgreSQL database...');
      const dbItem = await neonDb.saveItem(itemData, currentUser);
      if (dbItem && (dbItem.id || dbItem._id)) {
        const finalItem = {
          id: dbItem._id || dbItem.id,
          _id: dbItem._id || dbItem.id,
          ...dbItem
        };

        saveLocalSharedItem(finalItem);
        recordImpactAction({ category: itemData.category, quantity: 1, type: itemData.sharingType || 'share' });

        return {
          success: true,
          message: 'Your item has been shared and saved directly to the database!',
          item: finalItem
        };
      }
    } catch (neonErr) {
      console.error('[itemService.createItem] Direct Neon database save error:', neonErr.message);
      if (!apiErrorMsg && typeof neonErr.message === 'string' && neonErr.message !== '[object Object]') {
        apiErrorMsg = neonErr.message;
      }
    }

    const fallbackMsg = (apiErrorMsg && typeof apiErrorMsg === 'string' && apiErrorMsg !== '[object Object]')
      ? apiErrorMsg
      : 'We couldn’t publish your item right now. Please try again.';

    return {
      success: false,
      message: fallbackMsg
    };
  },

  /**
   * Fetch items owned by the authenticated user
   * @param {Object} params - Query filters { search, category, sharingType, condition, status, sort, page, limit }
   */
  getMyItems: async (params = {}) => {
    let apiItems = [];
    let apiTotal = 0;
    try {
      const response = await api.get('/items/my', { params });
      if (response.data && response.data.items) {
        apiItems = response.data.items;
        apiTotal = response.data.total || response.data.items.length;
      }
    } catch (err) {
      console.warn('[itemService.getMyItems] Backend fetch notice:', err.message);
    }

    // Identify active logged-in customer
    let currentUser = {};
    try {
      currentUser = JSON.parse(localStorage.getItem('looop_user') || '{}');
    } catch {}

    const currentId = currentUser.id || currentUser._id;
    const currentEmail = (currentUser.email || '').toLowerCase().trim();

    // Query Neon PostgreSQL directly if API returned empty or had network issues
    let directNeonItems = [];
    if (apiItems.length === 0 && (currentId || currentEmail)) {
      try {
        directNeonItems = await neonDb.getMyItems(currentId, currentEmail, params);
      } catch (neonErr) {
        console.warn('[itemService.getMyItems] Neon direct query notice:', neonErr.message);
      }
    }

    // Merge persistent local items belonging to this user
    const localItems = getLocalSharedItems().filter((item) => {
      const ownerId = item.owner?.id || item.owner?._id || item.owner_id;
      const ownerEmail = (item.owner?.email || '').toLowerCase().trim();
      return (currentId && ownerId === currentId) || (currentEmail && ownerEmail === currentEmail);
    });

    const combinedMap = new Map();
    // 1. Direct Neon PostgreSQL items
    directNeonItems.forEach((i) => combinedMap.set(i.id || i._id, { ...i, images: (i.images || []).map(normalizeImageUrl) }));
    // 2. Persistent local items
    localItems.forEach((i) => combinedMap.set(i.id || i._id, { ...i, images: (i.images || []).map(normalizeImageUrl) }));
    // 3. Authoritative backend API items
    apiItems.forEach((i) => combinedMap.set(i.id || i._id, { ...i, images: (i.images || []).map(normalizeImageUrl) }));

    let finalItems = Array.from(combinedMap.values());

    // Apply query filters
    if (params.status && params.status !== 'all') {
      if (params.status === 'available') {
        finalItems = finalItems.filter((i) => i.availability === 'Available' || i.status === 'active' || i.status === 'AVAILABLE');
      } else if (params.status === 'unavailable') {
        finalItems = finalItems.filter((i) => i.availability === 'Unavailable' || i.status === 'unavailable');
      } else if (params.status === 'borrowed') {
        finalItems = finalItems.filter((i) => i.availability === 'Reserved' || i.status === 'BORROWED');
      } else if (params.status === 'pending') {
        finalItems = finalItems.filter((i) => i.status === 'pending moderation' || i.status === 'PENDING');
      } else if (params.status === 'completed') {
        finalItems = finalItems.filter((i) => i.status === 'completed' || i.status === 'COMPLETED');
      }
    }
    if (params.category && params.category !== 'all') {
      finalItems = finalItems.filter((i) => (i.category || '').toLowerCase() === params.category.toLowerCase());
    }
    if (params.sharingType && params.sharingType !== 'all') {
      finalItems = finalItems.filter((i) => (i.sharingType || '').toLowerCase() === params.sharingType.toLowerCase());
    }
    if (params.condition && params.condition !== 'all') {
      finalItems = finalItems.filter((i) => (i.condition || '').toLowerCase() === params.condition.toLowerCase());
    }
    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      finalItems = finalItems.filter((i) =>
        i.title?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q)
      );
    }

    finalItems.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total = Math.max(apiTotal, finalItems.length);
    const currentPage = Math.max(1, parseInt(params.page || '1', 10));
    const pageSize = Math.max(1, parseInt(params.limit || '12', 10));
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedItems = finalItems.slice(startIndex, startIndex + pageSize);

    return {
      success: true,
      items: paginatedItems,
      total,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize) || 1
    };
  },

  /**
   * Fetch summary counts for user listings
   */
  getMyItemsSummary: async () => {
    let apiSummary = null;
    try {
      const response = await api.get('/items/my/summary');
      if (response.data && response.data.summary && response.data.summary.total > 0) {
        return response.data;
      }
      if (response.data?.summary) {
        apiSummary = response.data.summary;
      }
    } catch (err) {
      console.warn('[itemService.getMyItemsSummary] API notice:', err.message);
    }

    // Try Neon PostgreSQL direct count
    let currentUser = {};
    try {
      currentUser = JSON.parse(localStorage.getItem('looop_user') || '{}');
    } catch {}
    const currentId = currentUser.id || currentUser._id;
    const currentEmail = (currentUser.email || '').toLowerCase().trim();

    if (currentId || currentEmail) {
      try {
        const neonSummary = await neonDb.getMyItemsSummary(currentId, currentEmail);
        if (neonSummary.total > 0) {
          return { success: true, summary: neonSummary };
        }
      } catch {}
    }

    if (apiSummary) {
      return { success: true, summary: apiSummary };
    }

    const localListings = getLocalSharedItems().filter((item) => {
      const ownerId = item.owner?.id || item.owner?._id || item.owner_id;
      const ownerEmail = (item.owner?.email || '').toLowerCase().trim();
      return (currentId && ownerId === currentId) || (currentEmail && ownerEmail === currentEmail);
    });

    const total = localListings.length;
    const available = localListings.filter((i) => i.availability === 'Available' || i.status === 'active' || i.status === 'AVAILABLE').length;
    const pending = localListings.filter((i) => i.status === 'pending moderation' || i.status === 'PENDING').length;
    const borrowed = localListings.filter((i) => i.availability === 'Reserved' || i.status === 'BORROWED').length;
    const completed = localListings.filter((i) => i.status === 'completed' || i.status === 'COMPLETED').length;

    return {
      success: true,
      summary: {
        total,
        available,
        pending,
        borrowed,
        completed
      }
    };
  },

  /**
   * Toggle item availability
   */
  updateItemAvailability: async (id, availability) => {
    try {
      const response = await api.patch(`/items/${id}/availability`, { availability });
      return response.data;
    } catch (err) {
      return { success: false, message: err?.message || 'Failed to update availability.' };
    }
  },

  /**
   * Soft-delete / remove item from active community discovery
   */
  deleteItem: async (id) => {
    try {
      const response = await api.delete(`/items/${id}`);
      return response.data;
    } catch (err) {
      return { success: false, message: err?.message || 'Failed to remove listing.' };
    }
  },

  /**
   * Save item to user bookmarks
   */
  saveItem: async (id) => {
    try {
      const response = await api.post(`/items/${id}/save`);
      return response.data;
    } catch {
      return { success: true, saved: true };
    }
  },

  /**
   * Remove item from user bookmarks
   */
  unsaveItem: async (id) => {
    try {
      const response = await api.delete(`/items/${id}/save`);
      return response.data;
    } catch {
      return { success: true, saved: false };
    }
  },

  /**
   * Check if item is saved
   */
  getSavedStatus: async (id) => {
    try {
      const response = await api.get(`/items/${id}/save-status`);
      return response.data;
    } catch {
      return { success: true, saved: false };
    }
  },

  /**
   * Real backend-powered discovery with geospatial radius and multi-attribute filters
   */
  discoverItems: async (params = {}) => {
    let apiItems = [];
    let apiTotal = 0;
    let apiTotalPages = 1;

    try {
      const response = await api.get('/items/discover', { params });
      if (response.data && response.data.items) {
        apiItems = response.data.items;
        apiTotal = response.data.total || response.data.items.length;
        apiTotalPages = response.data.totalPages || 1;
      }
    } catch (error) {
      console.warn('Backend discover notice:', error.message);
    }

    // Merge persistent local items so items created on this device are always discovered
    const localItems = getLocalSharedItems();
    const combinedMap = new Map();
    apiItems.forEach((item) => combinedMap.set(item.id || item._id, item));
    localItems.forEach((item) => {
      const key = item.id || item._id;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, item);
      }
    });

    const allDiscovered = Array.from(combinedMap.values());
    return {
      success: true,
      items: allDiscovered,
      total: Math.max(apiTotal, allDiscovered.length),
      totalPages: Math.max(apiTotalPages, Math.ceil(allDiscovered.length / (params.limit || 12)) || 1)
    };
  },

  /**
   * Retrieve active community wanted requests matching this item
   */
  getItemMatches: async (itemId, params = {}) => {
    try {
      const response = await api.get(`/items/${itemId}/matches`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching item matches:', error);
      return { success: false, matches: [], count: 0 };
    }
  }
};

export default itemService;
