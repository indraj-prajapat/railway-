import { useState, useRef, useEffect } from "react";
import {
  Search,
  FileText,
  Folder,
  BarChart2,
  Sliders,
  Send,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Crown,
  MessageSquare,
  Lock,
  Moon,
  Sun,
  LogOut,
  Shield,
  Clock,
} from "lucide-react";

const API_URL = "http://localhost:5000/api/documents";
import AdminPanel from "../Authanication/AdminPanel";
import { Button } from "react-day-picker";
import FileView2 from "../Explorer/Fileview";
function Sidebar({ darkMode, setDarkMode, user, showAdminPanel, toggleAdminPanel, handleLogout, onChatLoad, token }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [recentChats, setRecentChats] = useState([]);
  const [showProModal, setShowProModal] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (isExpanded && token) {
      fetchRecentChats();
    }
  }, [isExpanded, token]);

  const fetchRecentChats = async () => {
    try {
      const res = await fetch(`${API_URL}/past-chat/latest`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      setRecentChats(data.latest_chats || []);
    } catch (error) {
      console.error("Error fetching recent chats:", error);
    }
  };

  const handleChatClick = (chat, index) => {
    if (index >= 2) {
      setShowProModal(true);
      return;
    }
    onChatLoad(chat.chat);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getFirstQuery = (chat) => {
    if (Array.isArray(chat)) {
      const userMsg = chat.find(msg => msg.type === "user");
      return userMsg?.content || "New chat";
    }
    return "New chat";
  };

  return (
    <>
      {/* Sidebar - Expands on Hover */}
      <div
        ref={sidebarRef}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className={`fixed top-0 left-0  z-50 transition-all rounded-3xl shadow-md  duration-300 ${
          isExpanded ? "w-80 h-full" : "w-16 h-16 mt-8 ml-10 "
        } ${
          darkMode
            ? "bg-gray-900 text-gray-100"
            : "bg-white text-gray-800"
        } shadow-2xl overflow-hidden`}
      >
        {/* Collapsed State - Icon Only */}
        {!isExpanded && (
          <div className="flex flex-col items-center py-4 space-y-6">
            
            <Menu size={30} className="text-gray-400" />
          </div>
        )}

        {/* Expanded State - Full Content */}
        {isExpanded && (
          <div className="p-6  h-full">
            {/* User Info */}
            <div className={`mb-6 p-4 rounded-2xl ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  darkMode ? "bg-teal-700" : "bg-teal-600"
                } text-white font-bold text-lg`}>
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                  <p className="font-semibold">{user?.name || "User"}</p>
                  <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    {user?.email || "user@example.com"}
                  </p>
                </div>
              </div>
              {user?.role === "admin" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600 text-white text-xs rounded-full">
                  <Shield size={12} />
                  Admin
                </span>
              )}
            </div>

            {/* Recent Chats Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock size={16} />
                Recent Chats
              </h3>
              {recentChats.length === 0 ? (
                <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"} text-center py-4`}>
                  No recent chats
                </p>
              ) : (
                <div className="space-y-2">
                  {recentChats.map((chat, index) => (
                    <div
                      key={chat.id}
                      onClick={() => handleChatClick(chat, index)}
                      className={`relative p-3 rounded-lg cursor-pointer transition ${
                        index >= 2
                          ? darkMode
                            ? "bg-gray-800 opacity-60"
                            : "bg-gray-100 opacity-60"
                          : darkMode
                          ? "bg-gray-800 hover:bg-gray-700"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <MessageSquare size={16} className="text-teal-500 shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {getFirstQuery(chat.chat)}
                          </p>
                          <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                            {formatTimestamp(chat.timestamp)}
                          </p>
                        </div>
                        {index >= 2 && (
                          <Lock size={14} className="text-amber-500 shrink-0" />
                        )}
                      </div>
                      {/* {index >= 2 && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg backdrop-blur-xsm">
                          <span className="text-xs text-red-800  font-semibold flex items-center gap-1">
                            <Crown size={12} />
                            Pro Only
                          </span>
                        </div>
                      )} */}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold mb-3">Settings</h3>
              
              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition ${
                  darkMode
                    ? "bg-gray-800 hover:bg-gray-700"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  {darkMode ? <Moon size={18} /> : <Sun size={18} />}
                  <span className="text-sm">
                    {darkMode ? "Dark Mode" : "Light Mode"}
                  </span>
                </span>
                <div
                  className={`w-12 h-6 rounded-full transition ${
                    darkMode ? "bg-teal-600" : "bg-gray-300"
                  } relative`}
                >
                  <div
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      darkMode ? "translate-x-6" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Admin Panel */}
              {user?.role === "admin" && (
                <button
                  onClick={toggleAdminPanel}
                  className={`w-full flex items-center gap-2 p-3 rounded-lg transition ${
                    showAdminPanel
                      ? "bg-teal-600 text-white"
                      : darkMode
                      ? "bg-gray-800 hover:bg-gray-700"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  <Shield size={18} />
                  <span className="text-sm">Admin Panel</span>
                </button>
              )}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className={`w-full flex items-center gap-2 p-3 rounded-lg transition ${
                  darkMode
                    ? "bg-red-900 hover:bg-red-800 text-red-100"
                    : "bg-red-100 hover:bg-red-200 text-red-800"
                }`}
              >
                <LogOut size={18} />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pro Modal */}
      {showProModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div
            className={`rounded-lg p-6 max-w-md w-full mx-4 ${
              darkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Crown className="text-amber-500" size={28} />
                Upgrade to Pro
              </h2>
              <button
                onClick={() => setShowProModal(false)}
                className={`p-1 rounded ${
                  darkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"
                }`}
              >
                <X size={24} />
              </button>
            </div>
            <div className="text-center py-8">
              <p className="text-lg font-semibold mb-2">Unlock Chat History</p>
              <p className={`${darkMode ? "text-gray-400" : "text-gray-500"} mb-4`}>
                Upgrade to Pro to access all your previous chat history and get unlimited searches!
              </p>
              <div className={`p-4 rounded-lg mb-4 ${darkMode ? "bg-gray-700" : "bg-gray-100"}`}>
                <p className="text-sm mb-2">Pro Features:</p>
                <ul className="text-sm text-left space-y-1">
                  <li>✓ Unlimited searches</li>
                  <li>✓ Full chat history access</li>
                  <li>✓ Advanced filters</li>
                  <li>✓ Priority support</li>
                </ul>
              </div>
              <p className="text-sm text-amber-500 font-semibold">Coming Soon!</p>
            </div>
            <button
              onClick={() => setShowProModal(false)}
              className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function SearchContent({ darkMode, token, setDarkMode, user }) {
  const [activeFilter, setActiveFilter] = useState(null);
  const isDarkMode = darkMode || false;
  const [filters, setFilters] = useState({
    query: "",
    fileTypes: [],
    fileSize: 50,
    folderId: null,
    folderName: "",
    searchType: null,
  });
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [folderTree, setFolderTree] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const popupRef = useRef(null);
  const chatEndRef = useRef(null);
  const [fileView, setFileView] = useState(false);
  const [currentfileview, setCurrentFileView] = useState(null);
  const toggleFilter = (filter) => {
    setActiveFilter((prev) => (prev === filter ? null : filter));
  };

  useEffect(() => {
    if (folderTree.length === 0) {
      fetch("http://localhost:5000/api/documents/folders-tree")
        .then((res) => res.json())
        .then((data) => setFolderTree(data))
        .catch((err) => console.error("Error fetching folders:", err));
    }
  }, [activeFilter]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setActiveFilter(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleFileTypeSelect = (type) => {
    setFilters((prev) => {
      const updated = prev.fileTypes.includes(type)
        ? prev.fileTypes.filter((t) => t !== type)
        : [...prev.fileTypes, type];
      return { ...prev, fileTypes: updated };
    });
  };

  const toggleAdminPanel = () => {
    setShowAdminPanel((prev) => !prev);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.reload();
  };

  const handleFileSizeChange = (e) => {
    setFilters((prev) => ({
        ...prev,
        fileSize: parseInt(e.target.value, 10), // ✅ ensures it's an integer
    }));
  };

  const handleSearchTypeSelect = (type) => {
    setFilters((prev) => ({ ...prev, searchType: type }));
    setActiveFilter(null);
  };

  const handleFileClick = (file) => {
    console.log("File clicked for preview:", {
      id: file.id,
      name: file.name,
      original_filename: file.original_filename,
      file_type: file.file_type,
      address: file.address,
      file_size_mb: file.file_size_mb,
      score: file.score,
    });
  };

  const handleSend = async () => {
    if (!filters.query.trim() || isLocked) return;
    console.log(filters)
    const userMessage = {
      type: "user",
      content: filters.query,
      filters: { ...filters },
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/new-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filter: filters,
        }),
      });

      const data = await res.json();

      const botMessage = {
        type: "bot",
        content: data,
        timestamp: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, botMessage]);
      setIsLocked(true);

      saveChatToBackend([...chatMessages, userMessage, botMessage]);
    } catch (error) {
      console.error("Error during fetch:", error);
      const errorMessage = {
        type: "bot",
        content: { error: "Failed to fetch results. Please try again." },
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setFilters({
        query: "",
        fileTypes: [],
        fileSize: 50,
        folderId: null,
        folderName: "",
        searchType: null,
      });
    }
  };

  const saveChatToBackend = async (messages) => {
    try {
      await fetch(`${API_URL}/past-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chat: messages,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("Error saving chat:", error);
    }
  };

  const handleNewChat = () => {
    setChatMessages([]);
    setIsLocked(false);
    setFilters({
      query: "",
      fileTypes: [],
      fileSize: 50,
      folderId: null,
      folderName: "",
      searchType: null,
    });
  };

  const handleChatLoad = (chat) => {
    if (Array.isArray(chat)) {
      setChatMessages(chat);
      setIsLocked(true);
    }
  };

  const handleFolderSelect = (id, name) => {
    setFilters((prev) => ({ ...prev, folderId: id, folderName: name }));
    setActiveFilter(null);
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderFolderTree = (folders, level = 0) => (
    <ul className="ml-2 space-y-1">
      {folders.map((folder) => (
        <li key={folder.id}>
          <div
            className={`flex items-center cursor-pointer px-2 py-1 rounded-md transition ${
                filters.folderId === folder.id
                ? "bg-teal-600 text-white"
                : darkMode
                ? "hover:bg-gray-700"
                : "hover:bg-gray-100"
            }`}
            onClick={() => handleFolderSelect(folder.id, folder.name)}  // Select folder on whole row click
            >
            {folder.children?.length > 0 && (
                <span
                className="mr-2"
                onClick={e => {
                    e.stopPropagation();        // Prevent select when toggling expand
                    toggleExpand(folder.id);
                }}
                >
                {expanded[folder.id] ? (
                    <ChevronDown size={14} />
                ) : (
                    <ChevronRight size={14} />
                )}
                </span>
            )}
            <Folder size={16} className="mr-2 text-teal-500 shrink-0" />
            <span className="truncate">
                {folder.name}
            </span>
            </div>

          {folder.children && expanded[folder.id] && (
            <div className="ml-4 border-l border-gray-500 pl-2">
              {renderFolderTree(folder.children, level + 1)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const fileTypes = ["pdf", "txt", "xlsx", "csv", "docx", "pptx"];
  const searchModes = ["Keyword", "Semantic", "AI Search"];
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const popupRef1 = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
        if (popupRef1.current && !popupRef1.current.contains(event.target)) {
        setShowFilterPopup(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
  const onPreviewFile = (file) => {
    setFileView(true);
    setCurrentFileView(file);
  };
  return (
    <div className="h-screen w-full flex">
      {/* Sidebar Component */}
      <Sidebar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        user={user}
        showAdminPanel={showAdminPanel}
        toggleAdminPanel={toggleAdminPanel}
        handleLogout={handleLogout}
        onChatLoad={handleChatLoad}
        token={token}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full">
        {/* Header Section */}
        <div
          className={`shadow-md rounded-lg p-4 flex justify-between items-center ${
            darkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold mb-1">
              Railway Document Search Assistant
            </h1>
            <p
              className={`text-sm ${
                darkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Your AI-powered assistant for searching and exploring documents.
            </p>
          </div>
        </div>
        <div>
        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto h-[57vh] py-6 px-4 space-y-4">
          {chatMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div
                className={`max-w-2xl mx-auto p-6 rounded-lg text-center ${
                  darkMode
                    ? "bg-gray-800 text-gray-100"
                    : "bg-gray-50 text-gray-800"
                }`}
              >
                <h2 className="text-xl font-semibold mb-3">
                  Welcome! How can I help you today?
                </h2>
                <p className="mb-4">
                  Start by asking a question or searching for documents. You can
                  use filters to refine your search.
                </p>
                <div className="space-y-2 text-sm text-left">
                  <p>
                    <strong>Example queries:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Show me railway safety reports in PDF</li>
                    <li>Find all Excel files about maintenance</li>
                    <li>Search for budget documents from 2024</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <>
              {chatMessages.map((message, index) => (
                <div key={index} className="space-y-4">
                  {message.type === "user" ? (
                    <div className="flex justify-end">
                      <div
                        className={`max-w-[70%] p-4 rounded-lg ${
                          darkMode
                            ? "bg-teal-700 text-gray-100"
                            : "bg-teal-600 text-white"
                        }`}
                      >
                        <p className="font-medium mb-2">{message.content}</p>
                        {(message.filters.fileTypes.length > 0 ||
                          message.filters.folderName ||
                          message.filters.searchType) && (
                          <div className="text-xs opacity-90 mt-2 space-y-1">
                            {message.filters.fileTypes.length > 0 && (
                              <p>
                                Types: {message.filters.fileTypes.join(", ")}
                              </p>
                            )}
                            {message.filters.folderName && (
                              <p>Folder: {message.filters.folderName}</p>
                            )}
                            {message.filters.searchType && (
                              <p>Mode: {message.filters.searchType}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div
                        className={`max-w-[80%] min-w-[50%] p-4 rounded-lg ${
                          darkMode
                            ? "bg-gray-700 text-gray-100"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {message.content.error ? (
                          <p className="text-red-500">{message.content.error}</p>
                        ) : (
                          <>
                            <p className="font-semibold mb-3">
                              Found {message.content.total_results} result
                              {message.content.total_results !== 1 ? "s" : ""}
                            </p>
                            <div className="space-y-2">
                              {message.content.results?.map((file) => (
                                <div
                                  key={file.id}
                                  onClick={() => onPreviewFile(file)}
                                  className={`p-3 rounded-lg border cursor-pointer transition ${
                                    darkMode
                                      ? "border-gray-600 hover:bg-gray-600"
                                      : "border-gray-300 hover:bg-gray-200"
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <FileText
                                      size={20}
                                      className="text-teal-500 shrink-0 mt-1"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium truncate">
                                        {file.original_filename || file.name}
                                      </p>
                                      
                                      <p
                                        className={`text-sm ${
                                          darkMode
                                            ? "text-gray-400"
                                            : "text-gray-600"
                                        }`}
                                      >
                                        {file.address}
                                      </p>
                                      <div className="flex gap-3 mt-1 text-xs">
                                        <span
                                          className={`${
                                            darkMode
                                              ? "text-gray-500"
                                              : "text-gray-500"
                                          }`}
                                        >
                                          {file.file_type.toUpperCase()}
                                        </span>
                                        <span
                                          className={`${
                                            darkMode
                                              ? "text-gray-500"
                                              : "text-gray-500"
                                          }`}
                                        >
                                          {file.file_size_mb.toFixed(2)} MB
                                        </span>
                                        <p className="font-medium bold text-end">
                                            V{file.version}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div
                    className={`p-4 rounded-lg ${
                      darkMode
                        ? "bg-gray-700 text-gray-100"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-teal-600 border-t-transparent rounded-full"></div>
                      <p>Searching...</p>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </>
          )}
        </div>
        </div>

        {/* Locked Message */}
        {isLocked && (
          <div
            className={`mx-4 mb-2 p-3 rounded-lg text-center border ${
              darkMode
                ? "bg-gray-800 border-gray-700 text-gray-300"
                : "bg-gray-50 border-gray-300 text-gray-700"
            }`}
          >
            <p className="text-sm">
              You've reached the limit for free searches.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleNewChat}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm transition"
              >
                Start New Chat
              </button>
              <button
                onClick={() => setShowProModal(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition flex items-center gap-2"
              >
                <Crown size={16} />
                Upgrade to Pro
              </button>
            </div>
          </div>
        )}

        {/* Input Section */}
        <div className="mt-auto relative px-4 pb-4">
        <div
            className={`flex items-center border rounded-full shadow-md px-3 py-2 transition-all duration-200 ${
            isLocked
                ? "opacity-50 cursor-not-allowed"
                : "focus-within:ring-2 focus-within:ring-teal-500"
            } ${
            darkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-200"
            }`}
        >
            {/* Search Icon */}
            <button
            className={`p-2 rounded-full transition ${
                darkMode ? "hover:bg-gray-600" : "hover:bg-gray-100"
            }`}
            disabled={isLocked}
            >
            <Search
                size={18}
                className={darkMode ? "text-gray-400" : "text-gray-500"}
            />
            </button>

            {/* Input Field */}
            <input
            type="text"
            value={filters.query}
            onChange={(e) =>
                setFilters((prev) => ({ ...prev, query: e.target.value }))
            }
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder={
                isLocked
                ? "Start a new chat to continue..."
                : "Ask anything or search documents..."
            }
            disabled={isLocked}
            className={`flex-1 bg-transparent outline-none px-3 ${
                darkMode
                ? "text-gray-100 placeholder-gray-500"
                : "text-gray-700 placeholder-gray-400"
            }`}
            />

            {/* Filter Button */}
            <div className="relative" ref={popupRef}>
            <button
                onClick={() => setShowFilterPopup(!showFilterPopup)}
                disabled={isLocked}
                className={`p-2 rounded-full transition ${
                isLocked
                    ? "opacity-50 cursor-not-allowed"
                    : darkMode
                    ? "hover:bg-gray-600 text-gray-300"
                    : "hover:bg-gray-100 text-gray-500"
                }`}
            >
                <Sliders size={18} />
            </button>

                        {/* Filter Popup */}
            {showFilterPopup && !isLocked && (
            <div
                className={`absolute bottom-14 right-0 w-[700px] h-[420px] p-4 rounded-xl shadow-2xl border z-50 flex gap-4 ${
                darkMode
                    ? "bg-gray-800 border-gray-700 text-gray-100"
                    : "bg-white border-gray-200 text-gray-800"
                }`}
            >
                {/* LEFT SIDE — Filter Options */}
                <div className="w-1/2 flex flex-col justify-between">
                <div>
                    <h3 className="font-semibold text-lg mb-4 text-center">
                    Advanced Filters
                    </h3>

                    {/* File Type */}
                    <div className="mb-5">
                    <h4 className="font-semibold mb-2 text-sm">File Types</h4>
                    <div className="flex flex-wrap gap-2">
                        {fileTypes.map((type) => (
                        <button
                            key={type}
                            onClick={() => handleFileTypeSelect(type)}
                            className={`px-2 py-1 text-xs rounded-full border ${
                            filters.fileTypes.includes(type)
                                ? "bg-teal-600 text-white border-teal-600"
                                : darkMode
                                ? "border-gray-600 hover:bg-gray-700"
                                : "border-gray-300 hover:bg-gray-100"
                            }`}
                        >
                            {type.toUpperCase()}
                        </button>
                        ))}
                    </div>
                    </div>

                    {/* File Size */}
                    <div className="mb-5">
                    <h4 className="font-semibold mb-2 text-sm">Max File Size (MB)</h4>
                    <input
                        type="range"
                        min="1"
                        max="500"
                        value={filters.fileSize}
                        onChange={handleFileSizeChange}
                        className="w-full accent-teal-600"
                    />
                    <p className="text-sm text-center mt-1">
                        {filters.fileSize} MB
                    </p>
                    </div>

                    {/* Search Mode */}
                    <div className="mb-5">
                    <h4 className="font-semibold mb-2 text-sm">Search Mode</h4>
                    <div className="flex flex-wrap gap-2">
                        {searchModes.map((mode) => (
                        <button
                            key={mode}
                            onClick={() => handleSearchTypeSelect(mode)}
                            className={`px-3 py-1 rounded-lg text-xs border ${
                            filters.searchType === mode
                                ? "bg-teal-600 text-white border-teal-600"
                                : darkMode
                                ? "border-gray-600 hover:bg-gray-700"
                                : "border-gray-300 hover:bg-gray-100"
                            }`}
                        >
                            {mode}
                        </button>
                        ))}
                    </div>
                    </div>
                </div>

                {/* Apply / Reset Buttons */}
                <div className="flex justify-between mt-2">
                    <button
                    onClick={() => {
                        setFilters({
                        query: "",
                        fileTypes: [],
                        fileSize: 100,
                        folderId: null,
                        folderName: "",
                        searchType: "Keyword",
                        });
                    }}
                    className={`px-3 py-1 rounded-lg text-sm border ${
                        darkMode
                        ? "border-gray-600 hover:bg-gray-700"
                        : "border-gray-300 hover:bg-gray-100"
                    }`}
                    >
                    Reset
                    </button>
                    <button
                    onClick={() => {
                        handleSend();
                        setShowFilterPopup(false);
                    }}
                    className="px-3 py-1 rounded-lg text-sm bg-teal-600 text-white hover:bg-teal-700"
                    >
                    Apply
                    </button>
                </div>
                </div>

                {/* RIGHT SIDE — Folder Tree */}
                <div className="w-1/2 relative flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Folder size={14} /> Folder
                        </h4>
                        <button
                        onClick={() => setShowFilterPopup(false)}
                        className={`p-1 rounded-full transition ${
                            darkMode
                            ? "hover:bg-gray-700 text-gray-300"
                            : "hover:bg-gray-200 text-gray-600"
                        }`}
                        >
                        <X size={16} />
                        </button>
                    </div>
                    <div className="h-full w-full overflow-y-auto border rounded-md p-2 text-sm">
                      {folderTree.length > 0 ? (
                        renderFolderTree(folderTree)
                      ) : (
                        <p className="text-gray-500 text-center text-xs">No folders found</p>
                      )}
                    </div>
                  </div>
            </div>
            )}

            </div>

            {/* Send Button */}
            <button
            onClick={handleSend}
            disabled={isLocked || !filters.query.trim()}
            className={`p-2 rounded-full transition ml-1 ${
                isLocked || !filters.query.trim()
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-teal-600 hover:bg-teal-700 text-white"
            }`}
            >
            <Send size={18} />
            </button>
        </div>
        </div>


      {/* Pro Modal */}
      {showProModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className={`rounded-lg p-6 max-w-md w-full mx-4 ${
              darkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Crown className="text-amber-500" size={28} />
                Upgrade to Pro
              </h2>
              <button
                onClick={() => setShowProModal(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <X size={24} />
              </button>
            </div>
            <div className="text-center py-8">
              <p className="text-xl font-semibold mb-2">Coming Soon!</p>
              <p className="text-gray-500 dark:text-gray-400">
                Pro features will be available shortly. Stay tuned for
                unlimited searches, advanced filters, and more!
              </p>
            </div>
            <button
              onClick={() => setShowProModal(false)}
              className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
      {showAdminPanel &&(
        <AdminPanel token={token} closePanel={toggleAdminPanel} darkMode={darkMode}/>
      )}
      {fileView && (
              <div
                className={`fixed z-50 !h-screen !w-screen transition-colors duration-300 
                  ${isDarkMode ? 'bg-[#0f172a]' : 'bg-gray-200'}`}
              >
                <FileView2
                  file={currentfileview}
                  onClose={() => setFileView(false)}
                  token={token}
                  darkMode={isDarkMode}
                />
              </div>
            )}
    </div>
    </div>
  );
}