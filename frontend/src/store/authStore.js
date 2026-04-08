import { create } from "zustand";
import { StorageKeys } from "@/utils/constants";
import { authService } from "@/api";

const getAvatarUrl = (user) => {
  if (!user) return null;
  return user.avatar?.url || "https://placehold.co/200x200";
};

const initializeAuth = async (set) => {
  try {
    if (authService.isLoggedIn()) {
      const response = await authService.getCurrentUser();
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        isInitialized: true,
      });
    } else {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        isInitialized: true,
      });
    }
  } catch (error) {
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: error.response?.data?.message || "Failed to initialize auth",
      isInitialized: true,
    });
    localStorage.removeItem(StorageKeys.ACCESS_TOKEN);
  }
};

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: false,
  isInitialized: false,

  initialize: () => {
    if (get().isInitialized || get().isLoading) return;

    set({ isLoading: true });
    initializeAuth(set);
  },

  getUserAvatar: () => {
    const { user } = get();
    return getAvatarUrl(user);
  },

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(credentials);
      set({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        isInitialized: true,
      });
      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Login failed",
      });
      throw error;
    }
  },

  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.register(userData);
      set({ isLoading: false });
      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Registration failed",
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        isInitialized: true,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Logout failed",
      });

      localStorage.removeItem(StorageKeys.ACCESS_TOKEN);
      set({
        user: null,
        isAuthenticated: false,
        isInitialized: true,
      });
    }
  },

  verifyEmail: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.verifyEmail(token);
      set({ isLoading: false });
      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Email verification failed",
      });
      throw error;
    }
  },

  forgotPassword: async (email) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.forgotPassword(email);
      set({ isLoading: false });
      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Password reset request failed",
      });
      throw error;
    }
  },

  resetPassword: async (token, newPassword) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.resetPassword(token, newPassword);
      set({ isLoading: false });
      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Password reset failed",
      });
      throw error;
    }
  },

  //   changePassword: async (oldPassword, newPassword) => {
  //     set({ isLoading: true, error: null });
  //     try {
  //       const response = await authService.changePassword(
  //         oldPassword,
  //         newPassword
  //       );
  //       set({ isLoading: false });
  //       return response;
  //     } catch (error) {
  //       set({
  //         isLoading: false,
  //         error: error.response?.data?.message || "Password change failed",
  //       });
  //       throw error;
  //     }
  //   },

  resendEmailVerification: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.resendEmailVerification();
      set({ isLoading: false });
      return response;
    } catch (error) {
      set({
        isLoading: false,
        error:
          error.response?.data?.message ||
          "Failed to resend verification email",
      });
      throw error;
    }
  },

  isEmailVerified: () => {
    const { user } = get();
    return user?.isEmailVerified || false;
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;