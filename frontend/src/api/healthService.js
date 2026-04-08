import axiosInstance from "./axios";

const healthService = {
  // Get system health status
  getSystemHealth: async () => {
    const response = await axiosInstance.get("/health");
    return response.data;
  },

  // Check database connection status
  checkDatabaseStatus: async () => {
    const response = await axiosInstance.get("/health/db");
    return response.data;
  },
};

export default healthService;
