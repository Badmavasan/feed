import axios from 'axios';
import { withBasePath } from '@/utils/assetUrl';

const axiosInstance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001',
    timeout: 8000,
});

// Request interceptor: add token to request header
axiosInstance.interceptors.request.use(
    config => {
        console.log("Send Request:", config.method?.toUpperCase(), config.url);
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem("token");
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    error => Promise.reject(error)
);

// Response interceptor: unified handling of token expiration or invalidity
axiosInstance.interceptors.response.use(
    response => response,
    error => {
        const code = error?.response?.data?.code;
        const message = error?.response?.data?.message;

        if (code === "INVALID_TOKEN") {
            console.warn("Token Expired or invalid, logging out...");

            // Clear locally stored identity information
            localStorage.removeItem("token");
            localStorage.removeItem("currentUser");
            localStorage.removeItem("currentProject");

            // Avoid repeated jumps or infinite loops
            if (typeof window !== 'undefined' && !window.location.pathname.includes("/login")) {
                alert("Your session has expired. Please log in again.");
                window.location.href = withBasePath("/login");
            }
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
