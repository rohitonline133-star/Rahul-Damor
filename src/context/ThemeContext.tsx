import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';
export type DeviceView = 'phone' | 'responsive';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  deviceView: DeviceView;
  toggleDeviceView: () => void;
  wallpaper: string;
  setWallpaper: (wallpaper: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('gb_theme');
    return (saved as ThemeMode) || 'dark'; // Dark theme default for modern mobile feel
  });

  const [deviceView, setDeviceViewState] = useState<DeviceView>(() => {
    const saved = localStorage.getItem('gb_device_view');
    return (saved as DeviceView) || 'phone';
  });

  const [wallpaper, setWallpaperState] = useState<string>(() => {
    return localStorage.getItem('gb_wallpaper') || 'default';
  });

  useEffect(() => {
    localStorage.setItem('gb_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('gb_device_view', deviceView);
  }, [deviceView]);

  useEffect(() => {
    localStorage.setItem('gb_wallpaper', wallpaper);
  }, [wallpaper]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
  };

  const toggleDeviceView = () => {
    setDeviceViewState((prev) => (prev === 'phone' ? 'responsive' : 'phone'));
  };

  const setWallpaper = (w: string) => {
    setWallpaperState(w);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        deviceView,
        toggleDeviceView,
        wallpaper,
        setWallpaper,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
