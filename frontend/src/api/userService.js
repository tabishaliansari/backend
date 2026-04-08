import axiosInstance from "./axios";

const userService = {
  // Get current user profile
  getProfile: async () => {
    const response = await axiosInstance.get("/users/profile");
    return response.data;
  },

  // Get user by ID (admin only)
  getUserById: async (userId) => {
    const response = await axiosInstance.get(`/users/${userId}`);
    return response.data;
  },

  // Update current user profile
  updateProfile: async (profileData) => {
    const response = await axiosInstance.post("/users/updateProfile", profileData);
    return response.data;
  },

  // Update user by ID (admin only)
  updateUserById: async (userId, profileData) => {
    const response = await axiosInstance.patch(`/users/${userId}`, profileData);
    return response.data;
  },

  // Upload user avatar
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await axiosInstance.patch("/users/updateAvatar", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
};

export default userService;
