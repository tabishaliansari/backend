const ENV = {
  API_URL:
    String(import.meta.env.VITE_API_URL) ||
    "http://localhost:4000/",

  // future configs (keep ready)
  APP_NAME: String(import.meta.env.VITE_APP_NAME) || "YourApp",
  MODE: String(import.meta.env.MODE) || "development",
};

export default ENV;