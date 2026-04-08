import { StorageKeys } from "@/utils/constants";
import axiosInstance from "./axios";

const authService = {
  register: async (userdata) => {
    const response = await axiosInstance.post("/auth/register", userdata);
    return response.data;
  },

  login: async (credentials) => {
    const response = await axiosInstance.post("/auth/login", credentials);

    if (response.data.data.accessToken) {
      localStorage.setItem(
        StorageKeys.ACCESS_TOKEN,
        response.data?.data?.accessToken,
      );
    }

    if (response.data.data.refreshToken) {
      localStorage.setItem(
        StorageKeys.REFRESH_TOKEN,
        response.data?.data?.refreshToken,
      );
    }

    return response.data;
  },

  logout: async () => {
    const response = await axiosInstance.post("/auth/logout");
    localStorage.removeItem(StorageKeys.ACCESS_TOKEN);
    localStorage.removeItem(StorageKeys.REFRESH_TOKEN);

    return response.data;
  },

  getCurrentUser: async () => {
    const response = await axiosInstance.get("/users/profile");

    return response.data;
  },

  // Verify email
  verifyEmail: async (token) => {
    const response = await axiosInstance.get(`/auth/verify-email/${token}`);
    return response.data;
  },

  // Request password reset
  forgotPassword: async (email) => {
    const response = await axiosInstance.post("/auth/forgotPassword", {
      email,
    });
    return response.data;
  },

  // Reset password with token
  resetPassword: async (token, password) => {
    const response = await axiosInstance.post(`/auth/resetPassword/${token}`, {
      password,
      confPassword: password,
    });
    return response.data;
  },

  // Change password (authenticated)
  //   changePassword: async (oldPassword, newPassword) => {
  //     const response = await axiosInstance.post("/auth/change-password", {
  //       oldPassword,
  //       newPassword,
  //     });
  //     return response.data;
  //   },

  // Resend email verification
  resendEmailVerification: async (email) => {
    const response = await axiosInstance.post("/auth/resend-verification-email", {
      email,
    });
    return response.data;
  },

  // Refresh access token
  refreshAccessToken: async () => {
    const response = await axiosInstance.get("/auth/refreshAccessToken");

    if (response.data?.data?.newAccessToken) {
      localStorage.setItem(
        StorageKeys.ACCESS_TOKEN,
        response.data.data.newAccessToken,
      );

      // Update refresh token if a new one is provided
      if (response.data?.data?.newRefreshToken) {
        localStorage.setItem(
          StorageKeys.REFRESH_TOKEN,
          response.data.data.newRefreshToken,
        );
      }
    }

    return response.data;
  },

  // Check if user is logged in
  isLoggedIn: () => {
    return !!localStorage.getItem(StorageKeys.ACCESS_TOKEN);
  },

  // Get access token
  getAccessToken: () => {
    return localStorage.getItem(StorageKeys.ACCESS_TOKEN);
  },
};

export default authService;
