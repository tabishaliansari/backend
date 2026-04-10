import axiosInstance from "./axios";

const githubOAuthService = {
  // Initiate GitHub OAuth flow
  initiateGitHubOAuth: async () => {
    const response = await axiosInstance.get("/auth/github", {
      params: { redirect_to_provider: false },
    });
    return response.data;
  },

  // Redirect to GitHub OAuth
  redirectToGitHub: async () => {
    const payload = await githubOAuthService.initiateGitHubOAuth();
    const authUrl = payload?.data?.authorizationUrl;

    if (!authUrl) {
      throw new Error("Failed to build GitHub OAuth URL");
    }

    window.location.assign(authUrl);
  },
};

export default githubOAuthService;

