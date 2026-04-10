import { create } from "zustand";

const THEME_KEY = "theme";

const getSystemTheme = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const applyThemeToDocument = (theme) => {
  const root = window.document.documentElement;
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  if (resolvedTheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  return resolvedTheme;
};

const getStoredTheme = () => {
  if (typeof window === "undefined") {
    return "light";
  }

  return localStorage.getItem(THEME_KEY) || "light";
};

const initialTheme = getStoredTheme();
const initialResolvedTheme =
  typeof window !== "undefined" ? applyThemeToDocument(initialTheme) : "light";

const useThemeStore = create((set) => ({
  theme: initialTheme,
  resolvedTheme: initialResolvedTheme,

  setTheme: (theme) => {
    const resolvedTheme = applyThemeToDocument(theme);
    localStorage.setItem(THEME_KEY, theme);
    set({ theme, resolvedTheme });
  },

  toggleTheme: () =>
    set((state) => {
      const currentResolvedTheme =
        state.theme === "system" ? getSystemTheme() : state.theme;
      const newTheme = currentResolvedTheme === "dark" ? "light" : "dark";

      const resolvedTheme = applyThemeToDocument(newTheme);
      localStorage.setItem(THEME_KEY, newTheme);

      return { theme: newTheme, resolvedTheme };
    }),
}));

export default useThemeStore;