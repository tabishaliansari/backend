import { StorageKeys } from "@/utils/constants";
import axiosInstance from "./axios";

const githubOAuthService = {
  // Initiate GitHub OAuth flow
  initiateGitHubOAuth: async () => {
    try {
      // Call backend to get GitHub OAuth URL and state
      const response = await axiosInstance.get("/auth/github");
      // Note: This will be a redirect, so we don't get here
      return response;
    } catch (error) {
      // If user already logged in, error will be caught here
      throw error;
    }
  },

  // Handle GitHub OAuth callback
  handleGitHubCallback: async (code, state) => {
    const response = await axiosInstance.get("/auth/github/callback", {
      params: { code, state },
    });

    // Store tokens from response if provided
    if (response.data?.data?.access_token) {
      localStorage.setItem(
        StorageKeys.ACCESS_TOKEN,
        response.data.data.access_token,
      );
    }

    return response.data;
  },

  // Redirect to GitHub OAuth
  redirectToGitHub: () => {
    // This will trigger a redirect, so we call the GET endpoint directly
    window.location.href = "/api/auth/github";
  },
};

export default githubOAuthService;
