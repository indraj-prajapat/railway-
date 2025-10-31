import { useEffect, useState } from "react";
import { FileText, FileSpreadsheet, FileImage, File } from "lucide-react";

export default function FileTypeStats() {
  const [stats, setStats] = useState({});

  useEffect(() => {
    fetch("http://localhost:5000/api/documents/explorer/filetype-stats", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setStats(data));
  }, []);

  const getIcon = (ext) => {
    switch (ext) {
      case "pdf":
        return <FileText className="w-3 h-3 text-red-500" />;
      case "docx":
      case "doc":
        return <FileText className="w-3 h-3 text-blue-500" />;
      case "xlsx":
      case "xls":
        return <FileSpreadsheet className="w-3 h-3 text-green-500" />;
      case "png":
      case "jpg":
      case "jpeg":
        return <FileImage className="w-3 h-3 text-purple-500" />;
      default:
        return <File className="w-3 h-3 text-gray-500" />;
    }
  };

  return (
    <div className="flex flex-wrap gap-1 justify-start">
      {Object.entries(stats).map(([ext, count]) => (
        <div
          key={ext}
          className="flex flex-col items-center justify-center min-w-[15%] bg-white rounded-sm p-0.5 shadow-sm"
        >
          <span className="text-[8px] capitalize leading-tight">{ext}</span>
          {getIcon(ext)}
          <span className="text-[9px] font-semibold leading-tight">{count}</span>
        </div>
      ))}
    </div>
  );
}
