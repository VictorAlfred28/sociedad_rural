import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { useEffect, useState, useCallback } from 'react';

export const usePlatform = () => {
    const [isNative, setIsNative] = useState<boolean>(false);
    const [platform, setPlatform] = useState<string>('web');

    useEffect(() => {
        const isNativePlatform = Capacitor.isNativePlatform();
        setIsNative(isNativePlatform);
        setPlatform(Capacitor.getPlatform());
    }, []);

    const openUrl = useCallback(async (url: string) => {
        if (Capacitor.isNativePlatform()) {
            await Browser.open({ url });
        } else {
            window.open(url, '_blank');
        }
    }, []);

    return {
        isNative,
        platform, // 'web', 'ios', 'android'
        openUrl
    };
};
