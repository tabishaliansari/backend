import axiosInstance from "./axios";

const chatSessionService = {
  // Create a new chat session
  createSession: async (data) => {
    const response = await axiosInstance.post("/sessions", data);
    return response.data;
  },

  // Get all chat sessions (paginated)
  getSessions: async (params) => {
    const response = await axiosInstance.get("/sessions/", { params });
    return response.data;
  },

  // Get a specific chat session by ID
  getSessionById: async (sessionId) => {
    const response = await axiosInstance.get(`/sessions/${sessionId}`);
    return response.data;
  },

  // Rename a chat session
  renameSession: async (sessionId, title) => {
    const response = await axiosInstance.patch(`/sessions/${sessionId}/title`, { title });
    return response.data;
  },

  // Attach sources to a chat session
  attachSources: async (sessionId, sourceIds) => {
    const response = await axiosInstance.patch(`/sessions/${sessionId}/sources`, { source_ids: sourceIds });
    return response.data;
  },

  // Remove a source from a chat session
  removeSource: async (sessionId, sourceId) => {
    const response = await axiosInstance.delete(`/sessions/${sessionId}/sources/${sourceId}`);
    return response.data;
  },

  // Delete a chat session
  deleteSession: async (sessionId) => {
    const response = await axiosInstance.delete(`/sessions/${sessionId}`);
    return response.data;
  },

  // Execute a graph query in the context of the session
  queryGraph: async (sessionId, queryData) => {
    const response = await axiosInstance.post(`/sessions/${sessionId}/graph/query`, queryData);
    return response.data;
  },

  // Get the full graph attached to the session
  getFullGraph: async (sessionId, sourceIds) => {
    const params = {};
    if (sourceIds && sourceIds.length > 0) {
      params.source_ids = sourceIds.join(',');
    }
    const response = await axiosInstance.get(`/sessions/${sessionId}/graph`, { params });
    return response.data;
  },

  // Get session context state
  getContextState: async (sessionId) => {
    const response = await axiosInstance.get(`/sessions/${sessionId}/context/state`);
    return response.data;
  },

  // Evaluate context compaction
  evaluateContext: async (sessionId) => {
    const response = await axiosInstance.post(`/sessions/${sessionId}/context/evaluate`);
    return response.data;
  },

  // Compact session context
  compactContext: async (sessionId) => {
    const response = await axiosInstance.post(`/sessions/${sessionId}/context/compact`);
    return response.data;
  },

  // Get session context summary
  getContextSummary: async (sessionId) => {
    const response = await axiosInstance.get(`/sessions/${sessionId}/context/summary`);
    return response.data;
  },

  // Rebuild session context
  rebuildContext: async (sessionId) => {
    const response = await axiosInstance.post(`/sessions/${sessionId}/context/rebuild`);
    return response.data;
  }
};

export default chatSessionService;
