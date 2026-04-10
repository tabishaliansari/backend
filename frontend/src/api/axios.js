import axios from "axios";
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

// 🔔 Generic error handler
const showErrorNotification = (error) => {
  const errorMessage =
    error.response?.data?.message ||
    error.message ||
    "An unexpected error occurred";

  toast.error(errorMessage);
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
        await axios.get(
          `${API_URL}auth/refreshAccessToken`,
          { withCredentials: true }
        );

        return axiosInstance(originalRequest);
      } catch (error) {
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