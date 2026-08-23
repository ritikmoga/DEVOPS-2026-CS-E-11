import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  withCredentials: true,
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("eventhub_access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
let refreshing: Promise<string | null> | null = null;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original?._retry || original?.url?.includes("/auth/"))
      throw error;
    original._retry = true;
    refreshing ??= api
      .post("/auth/refresh")
      .then((response) => {
        const token = response.data.data.accessToken;
        localStorage.setItem("eventhub_access", token);
        return token;
      })
      .catch(() => {
        localStorage.removeItem("eventhub_access");
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
    const token = await refreshing;
    if (!token) throw error;
    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  },
);
export default api;
