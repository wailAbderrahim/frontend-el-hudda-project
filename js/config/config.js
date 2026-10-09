const isLocalhost = typeof window !== 'undefined' && Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '' ||
    window.location.protocol === 'file:'
);

export const API_URL = isLocalhost
    ? "http://localhost:5000/api"
    : "https://el-hudda-project.onrender.com/api";

export const WS_URL = isLocalhost
    ? "ws://localhost:5000"
    : "wss://el-hudda-project.onrender.com";
