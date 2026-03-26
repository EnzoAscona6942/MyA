// API URL: use environment variable in production, fallback to localhost for development
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
export const API_URL = `${API_BASE}/api`;

export const getHeaders = () => {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
    };
};

export const api = {
    get: async (url) => {
        const res = await fetch(`${API_URL}${url}`, { headers: getHeaders() });
        if (!res.ok) throw await res.json();
        return res.json();
    },
    post: async (url, body) => {
        const res = await fetch(`${API_URL}${url}`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },
    put: async (url, body) => {
        const res = await fetch(`${API_URL}${url}`, {
            method: "PUT",
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },
    delete: async (url) => {
        const res = await fetch(`${API_URL}${url}`, {
            method: "DELETE",
            headers: getHeaders()
        });
        if (!res.ok) throw await res.json();
        return res.json();
    }
};
