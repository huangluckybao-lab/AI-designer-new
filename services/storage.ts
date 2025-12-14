import { ClothingItem, SavedOutfit, User } from '../types';

const DB_NAME = 'AuraAI_DB';
const DB_VERSION = 2; // Upgraded for Users support
const STORE_WARDROBE = 'wardrobe';
const STORE_HISTORY = 'history';
const STORE_USERS = 'users';

// Open (and create/upgrade) the database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_WARDROBE)) {
        db.createObjectStore(STORE_WARDROBE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_USERS)) {
        const userStore = db.createObjectStore(STORE_USERS, { keyPath: 'id' });
        userStore.createIndex('username', 'username', { unique: true });
      }
    };
  });
};

export const StorageService = {
  // --- Auth Operations ---
  
  async registerUser(username: string, password: string): Promise<User> {
    const db = await openDB();
    
    // Check if username exists
    const exists = await new Promise<boolean>((resolve, reject) => {
      const transaction = db.transaction(STORE_USERS, 'readonly');
      const index = transaction.objectStore(STORE_USERS).index('username');
      const request = index.get(username);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });

    if (exists) {
      throw new Error("用户名已存在");
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      username,
      password, // Note: In production, hash this!
      createdAt: Date.now()
    };

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_USERS, 'readwrite');
      const store = transaction.objectStore(STORE_USERS);
      const request = store.add(newUser);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return newUser;
  },

  async loginUser(username: string, password: string): Promise<User> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_USERS, 'readonly');
      const index = transaction.objectStore(STORE_USERS).index('username');
      const request = index.get(username);
      
      request.onsuccess = () => {
        const user = request.result as User;
        if (user && user.password === password) {
          resolve(user);
        } else {
          reject(new Error("用户名或密码错误"));
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  // --- Wardrobe Operations ---
  async getAllWardrobe(userId: string): Promise<ClothingItem[]> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_WARDROBE, 'readonly');
        const store = transaction.objectStore(STORE_WARDROBE);
        const request = store.getAll();
        request.onsuccess = () => {
          const allItems = request.result as ClothingItem[];
          // Filter in memory for simplicity (VS complex indexes)
          const userItems = allItems.filter(item => item.userId === userId);
          resolve(userItems || []);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error("Failed to get wardrobe", e);
      return [];
    }
  },

  async addWardrobeItem(item: ClothingItem): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_WARDROBE, 'readwrite');
      const store = transaction.objectStore(STORE_WARDROBE);
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async deleteWardrobeItem(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_WARDROBE, 'readwrite');
      const store = transaction.objectStore(STORE_WARDROBE);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // --- History Operations ---
  async getAllHistory(userId: string): Promise<SavedOutfit[]> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_HISTORY, 'readonly');
        const store = transaction.objectStore(STORE_HISTORY);
        const request = store.getAll();
        request.onsuccess = () => {
          const allItems = request.result as SavedOutfit[];
          const userItems = allItems.filter(item => item.userId === userId);
          resolve(userItems || []);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error("Failed to get history", e);
      return [];
    }
  },

  async addHistoryItem(item: SavedOutfit): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_HISTORY, 'readwrite');
      const store = transaction.objectStore(STORE_HISTORY);
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async deleteHistoryItem(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_HISTORY, 'readwrite');
      const store = transaction.objectStore(STORE_HISTORY);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // --- Migration Utility ---
  async migrateFromLocalStorage(): Promise<void> {
    // Migration now deprecated or needs to handle orphaned items (items without userId).
    // For this version, we assume migration happened before or we just clear LS.
    // If we want to support legacy migration, we would need to assign them to the first user
    // or keep them null. Let's just clear for safety in this multi-user context.
    localStorage.removeItem('aura_wardrobe');
    localStorage.removeItem('aura_history');
  }
};