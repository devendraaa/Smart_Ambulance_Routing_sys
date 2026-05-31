"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { LANGUAGE_NAMES, LanguageCode } from "@/lib/translations";

type SwitcherTheme = "light" | "dark" | "emerald" | "minimal";

interface Props {
  theme?: SwitcherTheme;
}

const THEME_STYLES: Record<SwitcherTheme, {
  button: string;
  dropdown: string;
  item: string;
  itemActive: string;
  icon: string;
}> = {
  light: {
    button: "bg-white/80 border border-gray-200 text-gray-700 hover:bg-white",
    dropdown: "bg-white border border-gray-200 shadow-xl",
    item: "text-gray-600 hover:bg-blue-50 hover:text-blue-600",
    itemActive: "bg-blue-50 text-blue-600",
    icon: "text-gray-500",
  },
  dark: {
    button: "bg-white/20 border border-white/20 text-white hover:bg-white/30",
    dropdown: "bg-white border border-gray-200 shadow-xl",
    item: "text-gray-600 hover:bg-blue-50 hover:text-blue-600",
    itemActive: "bg-blue-50 text-blue-600",
    icon: "text-blue-100",
  },
  emerald: {
    button: "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100",
    dropdown: "bg-white border border-gray-200 shadow-xl",
    item: "text-gray-600 hover:bg-emerald-50 hover:text-emerald-600",
    itemActive: "bg-emerald-50 text-emerald-600",
    icon: "text-emerald-500",
  },
  minimal: {
    button: "bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200",
    dropdown: "bg-white border border-gray-200 shadow-xl",
    item: "text-gray-600 hover:bg-gray-100 hover:text-gray-800",
    itemActive: "bg-gray-100 text-gray-800",
    icon: "text-gray-500",
  },
};

const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "mr", label: "मराठी" },
];

export default function LanguageSwitcher({ theme = "light" }: Props) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const styles = THEME_STYLES[theme];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <div className="relative" ref={ref}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${styles.button}`}
        aria-label="Switch language"
      >
        <Globe className={`w-3.5 h-3.5 ${styles.icon}`} />
        <span className="hidden sm:inline">{current.label}</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className={`absolute right-0 top-full mt-1.5 w-36 rounded-xl overflow-hidden z-50 ${styles.dropdown}`}
          >
            {LANGUAGES.map((lang) => {
              const active = language === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setOpen(false);
                  }}
                  className={`w-full px-3.5 py-2.5 text-xs font-medium text-left transition-colors flex items-center justify-between ${
                    active ? styles.itemActive : styles.item
                  }`}
                >
                  <span>{lang.label}</span>
                  {active && (
                    <motion.span
                      layoutId="lang-dot"
                      className="w-1.5 h-1.5 rounded-full bg-current"
                    />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
