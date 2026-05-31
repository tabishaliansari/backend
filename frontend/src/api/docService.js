import axiosInstance from "./axios";

const docService = {
  // Check documentation status by source ID
  getBySource: async (sessionId, sourceId = null) => {
    const response = await axiosInstance.get(`/sessions/${sessionId}/docs/by-source`, {
      params: sourceId ? { source_id: sourceId } : {}
    });
    return response.data;
  },

  // Start generation (fresh, retry, or force update)
  generateDocs: async (sessionId, payload) => {
    const response = await axiosInstance.post(`/sessions/${sessionId}/generate-docs`, payload);
    return response.data;
  },

  // Fetch full generated documentation status (with markdown)
  getStatus: async (sessionId, docGenId) => {
    const response = await axiosInstance.get(`/sessions/${sessionId}/docs/${docGenId}/status`);
    return response.data;
  },

  // Clear / delete a documentation record
  deleteDocs: async (sessionId, docGenId) => {
    const response = await axiosInstance.delete(`/sessions/${sessionId}/docs/${docGenId}`);
    return response.data;
  },

  // Get stream URL for EventSource
  getStreamUrl: (sessionId, docGenId) => {
    const baseURL = axiosInstance.defaults.baseURL || "http://localhost:8000/api/v1";
    const cleanBaseURL = baseURL.replace(/\/+$/, "");
    return `${cleanBaseURL}/sessions/${sessionId}/docs/${docGenId}/stream`;
  }
};

export default docService;
