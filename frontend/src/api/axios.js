import axios from "axios";
import { StorageKeys } from "../utils/constants";
import { navigateTo } from "@/utils/navigation";
import ENV from "@/config/env";
import { toast } from "sonner";
// import { getToastStyles } from "@/utils/toastStyles"; // (optional for custom styling)

const API_URL = ENV.API_URL;

const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(StorageKeys.ACCESS_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🔔 Generic error handler
const showErrorNotification = (error) => {
  const errorMessage =
    error.response?.data?.message ||
    error.message ||
    "An unexpected error occurred";

  // Basic toast (can add custom styles later)
  toast.error(errorMessage, {
    // style: getToastStyles("error"), // 👈 optional custom styling
  });
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || "";
    const isAuthRequest = /\/auth\/(login|register|forgotPassword|resetPassword|verify-email|resend-verification-email)/.test(requestUrl);

    // 🔁 Handle token expiry
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem(StorageKeys.REFRESH_TOKEN);

        if (!refreshToken) {
          localStorage.removeItem(StorageKeys.ACCESS_TOKEN);

          toast.error("Your session has expired. Please log in again.", {
            // style: getToastStyles("error"),
          });

          navigateTo("/auth?mode=login");
          return Promise.reject(error);
        }

        const response = await axios.get(
          `${API_URL}/auth/refreshAccessToken`,
          { withCredentials: true }
        );

        if (response.data.data.newAccessToken) {
          localStorage.setItem(
            StorageKeys.ACCESS_TOKEN,
            response.data.data.newAccessToken
          );
        }

        if (response.data.data.newRefreshToken) {
          localStorage.setItem(
            StorageKeys.REFRESH_TOKEN,
            response.data.data.newRefreshToken
          );
        }

        originalRequest.headers.Authorization = `Bearer ${response.data.data.newAccessToken}`;

        return axiosInstance(originalRequest);
      } catch (error) {
        localStorage.removeItem(StorageKeys.ACCESS_TOKEN);
        localStorage.removeItem(StorageKeys.REFRESH_TOKEN);

        toast.error("Your session has expired. Please log in again.", {
          // style: getToastStyles("error"),
        });

        if (!window.location.pathname.includes("/auth")) {
          navigateTo("/auth?mode=login");
        }

        return Promise.reject(error);
      }
    }

    // 🌐 Network error
    if (error.message === "Network Error") {
      console.error(
        "Network Error: Check backend or CORS configuration."
      );

      toast.error(
        "Unable to connect to the server. Please check your internet connection.",
        {
          // style: getToastStyles("error"),
        }
      );
    }
    // 📡 Server responded with error
    else if (error.response) {
      if (error.response.status !== 401 || originalRequest?._retry) {
        showErrorNotification(error);
      }
    }
    // ❌ No response received
    else if (error.request) {
      toast.error(
        "The request was made but no response was received. Please try again later.",
        {
          // style: getToastStyles("error"),
        }
      );
    }
    // ❓ Unknown error
    else {
      showErrorNotification(error);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;