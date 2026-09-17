import { initializeApp, getApps, getApp } from "firebase/app";
import { getRemoteConfig, fetchAndActivate, getValue } from "firebase/remote-config";

const firebaseConfig = {
    apiKey: "AIzaSyBF_z-0_I7TcKQENL8sXNQtE9WW7vsIHBg",
    authDomain: "khy-heng.firebaseapp.com",
    projectId: "khy-heng",
    storageBucket: "khy-heng.firebasestorage.app",
    messagingSenderId: "519004002974",
    appId: "1:519004002974:web:28699a5611e4055b9cb98f",
    measurementId: "G-ZHY6MDRR8B"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let remoteConfigInstance = null;

export const getRemoteConfigInstance = () => {
    if (typeof window === 'undefined') return null;
    if (!remoteConfigInstance) {
        try {
            remoteConfigInstance = getRemoteConfig(app);
            // កំណត់ fetch interval (0 ដើម្បីឱ្យឆាប់ទទួល IP ថ្មីភ្លាមៗ)
            remoteConfigInstance.settings = {
                minimumFetchIntervalMillis: 0,
                fetchTimeoutMillis: 5000,
            };
            // កំណត់ Default Fallback បើសិនជា fetch មិនទាន់មកដល់
            remoteConfigInstance.defaultConfig = {
                server_host: "192.168.88.133"
            };
        } catch (e) {
            console.warn("Failed to initialize Firebase Remote Config:", e);
        }
    }
    return remoteConfigInstance;
};

export const remoteConfig = typeof window !== 'undefined' ? getRemoteConfigInstance() : null;

// Function សម្រាប់ទាញយក host ពី Firebase
export const getRemoteServerHost = async () => {
    try {
        const rc = getRemoteConfigInstance();
        if (!rc) {
            return localStorage.getItem('cached_server_host') || "192.168.88.133";
        }
        await fetchAndActivate(rc);
        const host = getValue(rc, "server_host").asString()?.trim();
        if (host) {
            console.log("[Firebase RemoteConfig] Server host fetched successfully:", host);
            try {
                localStorage.setItem('cached_server_host', host);
            } catch (_) {}
            return host;
        }
    } catch (err) {
        console.warn("Firebase Remote Config fetch failed, using fallback:", err);
    }

    try {
        const cached = localStorage.getItem('cached_server_host');
        if (cached) return cached;
    } catch (_) {}

    return "192.168.88.133";
};