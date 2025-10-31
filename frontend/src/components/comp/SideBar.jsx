import React, { useState } from "react";
import {
  Menu,
  Search,
  User,
  Sun,
  Moon,
  Star,
  CirclePlus,
  LogOut,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Sidebar({
  darkMode,
  setDarkMode,
  user,
  showAdminPanel,
  toggleAdminPanel,
  handleLogout,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const toggleTheme = () => setDarkMode(!darkMode);

  return (
    <div
      className={`overflow-hidden transition-all duration-500 ease-in-out
      ${darkMode ? "bg-gray-900 text-gray-100" : "text-gray-900"}
      ${isExpanded ? "w-56 h-[88vh] rounded-2xl shadow-2xl py-10 px-4 bg-gray-100" : "w-25 h-11 bg-transparent"}
    `}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Collapsed Menu Icon */}
      {!isExpanded && (
        <div className="flex items-center justify-center h-full cursor-pointer">
          <Menu className="!w-6 !h-6 text-gray-600 dark:text-gray-300" />
          <span className="text-sm font-semibold ml-2">Menu</span>
        </div>
      )}

      {/* Expanded Sidebar Content */}
      {isExpanded && (
        <div className="flex flex-col justify-between h-full p-4">
          {/* ---------------- TOP SECTION ---------------- */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/10 cursor-pointer">
              <Menu className="w-5 h-5" />
              <span className="text-sm font-semibold">Menu</span>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/10 cursor-pointer">
              <CirclePlus className="w-5 h-5" />
              <span className="text-sm font-semibold">New Search</span>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/10 cursor-pointer">
                <Search className="w-5 h-5" />
                <span className="text-sm font-semibold">Recent Searches</span>
              </div>
              <div className="ml-8 mt-1 flex flex-col gap-1">
                {["Search 1", "Search 2", "Search 3"].map((s, i) => (
                  <div
                    key={i}
                    className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 cursor-pointer"
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---------------- BOTTOM SECTION ---------------- */}
          <div className="flex flex-col gap-3 border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/10 cursor-pointer">
              <User className="w-5 h-5" />
              <span className="text-sm font-semibold">Profile</span>
            </div>

            {/* Theme toggle */}
            <div
              onClick={toggleTheme}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/10 cursor-pointer"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span className="text-sm font-semibold">
                {darkMode ? "Light Mode" : "Dark Mode"}
              </span>
            </div>

            {/* Admin Panel Button */}
            {user?.role === "admin" && (
              <div
                onClick={toggleAdminPanel}
                className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/10 cursor-pointer `}
              >
                <Shield className="w-5 h-5" />
                <span className="text-sm font-semibold">Admin Pannel</span>
              </div>
            )}

            {/* Logout Button */}
            <div
              onClick={handleLogout}
              className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/10 cursor-pointer `}
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm text-red-700 font-semibold">Logout</span>
            </div>

            {/* Pro Version */}
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/10 cursor-pointer">
              <Star className="w-5 h-5 text-yellow-500" />
              <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                Pro Version
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
