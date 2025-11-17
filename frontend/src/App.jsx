import { useState ,useEffect} from "react";
import { Search, Paperclip, Mic, Globe, Settings, Send, BarChart3, FolderOpen } from "lucide-react";
import './App.css'
import Sidebar from "./components/comp/SideBar";
import Login from "./components/comp/Login";
import { Button } from "./components/ui/button";
import AdminPanel from "./components/comp/Authanication/AdminPanel";
import FileExplorer3 from "./components/comp/Explorer/GoExpo";
import DashboardCards from "./components/comp/Analystics/analystics"; 
import SearchContent from "./components/comp/Search/search";
import {
 

  FileText,
  Folder,
  BarChart2,
  Sliders,
} from "lucide-react";
import FileView2 from "./components/comp/Explorer/Fileview";
import { OnlyOfficeEditor } from "./components/comp/Explorer/onlyoffice";
import { set } from "date-fns";
import DocHuntBackground from "./components/comp/Background/animation";
function App() {
  const [activeTab, setActiveTab] = useState("search");
  const [darkMode, setDarkMode] = useState(true);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [currentfileview, setCurrentFileView] = useState(null);
  const [fileView, setFileView] = useState(false);
  const isDarkMode = darkMode || true;
  

  const handleLogin = (userData, token) => {
    setUser(userData);
    console.log('userData:', userData);
    setToken(token);
   
  };



  const onClose = () => {
    setFileView(false);
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }
  return (
    <>
       <div className="app-container">
        <DocHuntBackground isDarkMode={darkMode} />

      

      {/* Dashboard */}
      <div
      className={`min-h-screen flex items-center justify-center px-4 transition-colors duration-300
        ${darkMode ? "" : ""}`}
    >
      <div className="w-full max-w-8xl h-[99vh] relative">
       
     
       

        {/* Tab Container */}
        <div className="h-full flex flex-row gap-4 items-center justify-center perspective-container">
          {/* Analytics Tab */}
          <TabCard
            id="analytics"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            darkMode={darkMode}
            icon={<BarChart3 size={32} />}
            title="Analytics"
          >
            <AnalyticsContent darkMode={darkMode} token={token}/>
          </TabCard>

          {/* Search Tab */}
          <TabCard
            id="search"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            darkMode={darkMode}
            icon={<Search size={32} />}
            title="Search"
          >
            <SearchContent darkMode={darkMode} token={token} setDarkMode={setDarkMode} user={user} setCurrentFileView={setCurrentFileView} setFileView={setFileView}/>
          </TabCard>

          {/* Classic File Storage Tab */}
          <TabCard
            id="classic"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            darkMode={darkMode}
            icon={<FolderOpen size={32} />}
            title="Classic File Storage"
          >
            <ClassicFileStorageContent activeTab={activeTab} setActiveTab={setActiveTab} darkMode={darkMode} token={token} setCurrentFileView={setCurrentFileView} setFileView={setFileView} />
          </TabCard>
        </div>
      </div>
      {/* File View Modal */}
      {fileView && (
            <div
              className={`fixed z-55 !h-screen !w-screen transition-colors duration-300 
                ${isDarkMode ? 'bg-slate-900/40 border-purple-500/20' : 'bg-gray-200'}`}
                key="file-view-modal"
            >
              {/* <FileView2
                file={currentfileview}
                onClose={handleOnlyOfficeLogout}
                token={token}
                darkMode={isDarkMode}
              /> */}
              <OnlyOfficeEditor token={token} doc={currentfileview} callbackUrl={`https://quincy-degraded-azzie.ngrok-free.dev/api/documents/onlyoffice/callback/${currentfileview.id}?user_id=${user.id}`} onClose={onClose}/>
            </div>
          )}
    </div>
    </div>
    
    
    </>
  );
}


// TabCard Component
function TabCard({ id, activeTab, setActiveTab, darkMode, icon, title, children }) {
  const isActive = activeTab === id;

  // Define tab positions dynamically
  const tabs = ["analytics", "search", "classic"];

  let order;
  if (id === activeTab) {
    order = 2; // active in middle
  } else {
    // find relative position to active tab
    const activeIndex = tabs.indexOf(activeTab);
    const currentIndex = tabs.indexOf(id);
    order = currentIndex < activeIndex ? 1 : 3; // left or right
  }

  return (
    <div
      onClick={() => setActiveTab(id)}
      className={`
        h-full rounded-3xl shadow-2xl cursor-pointer
        transition-all duration-700 ease-in-out backdrop-blur-lg
        ${isActive ? "w-[80%] z-30 scale-95" : "w-[15%] z-10 scale-80  hover:opacity-90"}
        ${darkMode ? "bg-slate-900/40 border-purple-500/20" : "bg-white/40 border-purple-200/50"}
        ${!isActive && "hover:scale-95"}
        flex flex-col
      `}
      style={{
        order: order,
        transform: !isActive
          ? order === 1
            ? "perspective(1000px) rotateY(25deg) translateX(20px)"
            : "perspective(1000px) rotateY(-25deg) translateX(-20px)"
          : "perspective(1000px) rotateY(0deg) translateX(0px)",
      }}
    >
      {!isActive && (
        <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
          <div className={`${darkMode ? "text-white" : "text-black"}`}>{icon}</div>
          <h2 className={`text-xl font-bold text-center ${darkMode ? "text-white" : "text-black"}`}>{title}</h2>
        </div>
      )}

      {isActive && (
        <div className="h-full flex flex-col p-6 justify-between w-[100%] items-center overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}


// Analytics Content
function AnalyticsContent({ darkMode ,token}) {
  return (
    <div className="h-full w-full flex mt-10 flex-col overflow-y-scroll">
      <div className={`border shadow-md rounded-lg p-4 text-center mb-6 ${darkMode ? "border-gray-700 bg-gray-700" : "border-gray-200 bg-gray-100"}`}>
        <h1 className="text-2xl font-bold mb-1">Analytics Dashboard</h1>
        <p className={`text-sm ${darkMode ? "text-gray-400 " : "text-gray-500 "}`}>
          View insights and statistics about your document searches.
        </p>
      </div>

      <div>
        <DashboardCards token={token} darkMode={darkMode}/>
      </div>
    </div>
  );
}



// Classic File Storage Content
function ClassicFileStorageContent({ darkMode,setActiveTab, activeTab ,token, setCurrentFileView,setFileView}) {
  

  return (
    <div className="h-full w-full flex flex-col">
      

     <FileExplorer3 setActiveTab={setActiveTab} activeTab={activeTab} token ={token} darkMode={darkMode} setCurrentFileView={setCurrentFileView} setFileView={setFileView} />
    </div>
  );
}

export default App;
