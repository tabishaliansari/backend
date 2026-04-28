import axiosInstance from "./axios";

const authService = {
  register: async (userdata) => {
    const response = await axiosInstance.post("/auth/register", userdata);
    return response.data;
  },

  login: async (credentials) => {
    const response = await axiosInstance.post("/auth/login", credentials);

    return response.data;
  },

  logout: async () => {
    const response = await axiosInstance.post("/auth/logout");

    return response.data;
  },

  getCurrentUser: async () => {
    const response = await axiosInstance.get("/users/me/profile");

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

    return response.data;
  },
};

export default authService;
