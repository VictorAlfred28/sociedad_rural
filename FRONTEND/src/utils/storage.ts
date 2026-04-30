import { Capacitor } from '@capacitor/core';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

export const setSecureItem = async (key: string, value: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
        await SecureStoragePlugin.set({ key, value });
    } else {
        localStorage.setItem(key, value);
    }
};

export const getSecureItem = async (key: string): Promise<string | null> => {
    if (Capacitor.isNativePlatform()) {
        try {
            const result = await SecureStoragePlugin.get({ key });
            return result.value;
        } catch (e) {
            return null; // Key not found or error
        }
    } else {
        return localStorage.getItem(key);
    }
};

export const removeSecureItem = async (key: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
        try {
            await SecureStoragePlugin.remove({ key });
        } catch (e) {
            // Ignore error if key doesn't exist
        }
    } else {
        localStorage.removeItem(key);
    }
};

export const clearSecureStorage = async (): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
        await SecureStoragePlugin.clear();
    } else {
        localStorage.clear();
    }
};
