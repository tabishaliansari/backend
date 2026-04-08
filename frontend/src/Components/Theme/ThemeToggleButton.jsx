import { useThemeStore } from "@/store";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded bg-gray-200 dark:bg-gray-700"
    >
      {theme === "dark" ? "🌞 Light" : "🌙 Dark"}
    </button>
  );
};

export default ThemeToggle;