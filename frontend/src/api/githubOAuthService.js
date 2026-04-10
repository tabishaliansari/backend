import { StorageKeys } from "@/utils/constants";
import axiosInstance from "./axios";
import ENV from "@/config/env";

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

  // Redirect to GitHub OAuth
  redirectToGitHub: () => {
    // Redirect to backend API endpoint
    window.location.href = `${ENV.API_URL}auth/github`;
  },
};

export default githubOAuthService;

