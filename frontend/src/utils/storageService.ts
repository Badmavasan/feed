// src/utils/storageService.ts

export const storageService = {
    get<T = unknown>(key: string): T {
        if (typeof window === 'undefined') return null as T;
        const data: string | null = localStorage.getItem(key);
        return data ? JSON.parse(data) as T : null as T;
    },

    set<T>(key: string, value: T): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem(key, JSON.stringify(value));
    },

    add<T>(key: string, item: T): void {
        if (typeof window === 'undefined') return;
        const current = storageService.get<T[]>(key) || [];
        current.push(item);
        storageService.set<T[]>(key, current);
    },

    remove(key: string, index: number): void {
        if (typeof window === 'undefined') return;
        const current = storageService.get<unknown[]>(key) || [];
        current.splice(index, 1);
        storageService.set(key, current);
    },

    clear(key: string): void {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(key);
    },


};
