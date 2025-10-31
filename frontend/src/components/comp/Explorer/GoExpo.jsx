import React, { useEffect, useState } from "react";
import {
  Folder,
  Plus,
  ArrowLeft,
  Pencil,
  Search,
  Download,
  Trash2,
  ListRestartIcon,
  X,
  Eye,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import FileCard from "./FileCard";
import FileView2 from "./Fileview";

const API_URL = "http://localhost:5000/api/documents";
const API_BASE = "http://localhost:5000/api";

export default function FileExplorer3({ setActiveTab, activeTab, token, darkMode }) {
  const isDarkMode = darkMode || false;
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [draggingFile, setDraggingFile] = useState(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [renameDialog, setRenameDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [versions, setVersions] = useState([]);
  const [groupBy, setGroupBy] = useState("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchResults2, setSearchResults2] = useState([]);
  const [expandedFileId, setExpandedFileId] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState([]);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadContractor, setUploadContractor] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadFiles, setUploadFiles] = useState([]);
  const [fileView, setFileView] = useState(false);
  const [currentfileview, setCurrentFileView] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [dltid, setdltid] = useState("");

  const handleDeleteClick = (fileid) => {
    setdltid(fileid);
    setShowConfirm(true);
  };

  const handleClose = () => {
    setShowConfirm(false);
  };

  const handleDeleteFile = () => {
    onDeleteFile(dltid);
    setShowConfirm(false);
  };

  const handleDeleteAllVersions = () => {
    onDeleteFile2(dltid);
    setShowConfirm(false);
  };

  const handleFileSelect = (e) => {
    setUploadFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      alert("Please enter Department and select files");
      return;
    }

    const formData = new FormData();
    uploadFiles.forEach((file) => formData.append("files", file));

    const metadata = {
      contractor: uploadContractor,
      tags: uploadTags.split(",").map((t) => t.trim()),
      folder_id: currentFolder ? currentFolder.id : null,
    };
    formData.append("metadata", JSON.stringify(metadata));

    setUploadDialog(false);

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await res.json();
      console.log("Upload response:", data);

      fetchExplorer();

      setUploadContractor("");
      setUploadTags("");
      setUploadFiles([]);
    } catch (err) {
      console.error("Upload error:", err);
      alert(`Upload failed: ${err.message}`);
    }
  };

  const fetchExplorer = async () => {
    const res = await fetch(`${API_URL}/explorer`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();

    const fileMap = new Map();

    data.files.forEach((file) => {
      const key = `${file.original_filename}__${file.folder_id || "root"}`;
      if (!fileMap.has(key) || file.version > fileMap.get(key).version) {
        fileMap.set(key, file);
      }
    });

    const highestVersionFiles = Array.from(fileMap.values());

    setFolders(data.folders);
    setFiles(highestVersionFiles);
  };

  useEffect(() => {
    fetchExplorer();
  }, []);

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    await fetch(`${API_URL}/folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newFolderName,
        parent_id: currentFolder ? currentFolder.id : null,
      }),
    });
    setShowDialog(false);
    setNewFolderName("");
    fetchExplorer();
  };

  const renameItem = async () => {
    if (!renameTarget || !renameValue.trim()) return;

    if (renameTarget.type === "file") {
      await fetch(`${API_URL}/file/${renameTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: renameValue }),
      });
    } else {
      await fetch(`${API_URL}/folder/${renameTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue }),
      });
    }

    setRenameDialog(false);
    setRenameValue("");
    setRenameTarget(null);
    fetchExplorer();
  };

  const handleDragStart = (e, file) => {
    setDraggingFile(file);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e, targetFolder) => {
    e.preventDefault();
    if (!draggingFile) return;

    await fetch(`${API_URL}/file/${draggingFile.id}/move`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder_id: targetFolder ? targetFolder.id : null,
      }),
    });

    setDraggingFile(null);
    fetchExplorer();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragOverFolder = (e, folderId) => {
    e.preventDefault();
    if (!expandedFolders.includes(folderId)) {
      setExpandedFolders([...expandedFolders, folderId]);
    }
  };

  const renderFolder = (folder) => {
    const isExpanded = expandedFolders.includes(folder.id);
    const subfolders = folders.filter((f) => f.parent_id === folder.id);

    return (
      <li key={folder.id} className="flex flex-col gap-1">
        <div
          className={`flex items-center gap-2 cursor-pointer p-1 rounded ${
            currentFolder?.id === folder.id
              ? isDarkMode
                ? "bg-gray-700"
                : "bg-gray-200"
              : ""
          }`}
          onClick={() => {
            setCurrentFolder(folder);
            setSearchResults([]);
          }}
          onDragOver={(e) => handleDragOverFolder(e, folder.id)}
          onDrop={(e) => handleDrop(e, folder)}
        >
          <Folder size={16} /> {folder.name}
        </div>

        {isExpanded && subfolders.length > 0 && (
          <ul className="pl-4 border-l ml-2">
            {subfolders.map((sub) => renderFolder(sub))}
          </ul>
        )}
      </li>
    );
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults2([]);
      setOpenDialog(true);
      return;
    }
    const res = await fetch(`${API_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: searchQuery,
        folder: currentFolder?.id || null,
      }),
    });
    const data = await res.json();
    setSearchResults2(data.results || []);
    setOpenDialog(true);
  };

  const groupFiles = (fileList) => {
    if (groupBy === "none") return fileList;

    let groups = {};
    fileList.forEach((f) => {
      const key = groupBy === "contractor" ? f.contractor : f.file_type;
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return groups;
  };

  const onDeleteFile = async (fileId) => {
    try {
      const permResp = await fetch(
        `http://localhost:5000/api/documents/check-permission2/${fileId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!permResp.ok) throw new Error("Permission check failed");

      const permData = await permResp.json();

      if (!permData.can_edit) {
        alert("You don't have delete permission for this file.");
        return;
      }

      const confirmed = window.confirm(
        "Are you sure you want to delete this file?"
      );
      if (!confirmed) return;

      const response = await fetch(`${API_BASE}/documents/files/${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        fetchExplorer();
      } else {
        console.error("Failed to delete file:", response.statusText);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const onDeleteFile2 = async (fileId) => {
    try {
      const permResp = await fetch(
        `http://localhost:5000/api/documents/check-permission2/${fileId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!permResp.ok) throw new Error("Permission check failed");

      const permData = await permResp.json();

      if (!permData.can_edit) {
        alert("You don't have delete permission for this file.");
        return;
      }

      const confirmed = window.confirm(
        "Are you sure you want to delete this file?"
      );
      if (!confirmed) return;

      const response = await fetch(`${API_BASE}/documents/files2/${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        fetchExplorer();
      } else {
        console.error("Failed to delete file:", response.statusText);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const restoreVersion = async (file) => {
    const confirmed = window.confirm(
      `Are you sure you want to restore version ${file.version} of ${file.original_filename} to latest?`
    );
    if (!confirmed) return;

    try {
      const fileRes = await fetch(`${API_URL}/files/${file.id}/download`);
      if (!fileRes.ok) throw new Error("Failed to fetch file");
      const blob = await fileRes.blob();

      const formData = new FormData();
      formData.append("files", blob, file.original_filename);

      const metadata = {
        contractor: file.contractor,
        tags: file.tags || [],
        folder_id: file.folder_id,
      };
      formData.append("metadata", JSON.stringify(metadata));

      setUploadDialog(false);

      const uploadRes = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Failed to restore version");

      const result = await uploadRes.json();
      console.log("Restored successfully:", result);
    } catch (err) {
      console.error("Restore error:", err);
    }
  };

  const onDownloadFile = (fileId, filename) => {
    window.open(`${API_BASE}/documents/files/${fileId}/download`, "_blank");
  };

  const onPreviewFile = (file) => {
    setFileView(true);
    setCurrentFileView(file);
  };

  const fetchVersions = async (fileId) => {
    setLoadingVersions(true);
    try {
      const res = await fetch(`${API_BASE}/documents/files/${fileId}/versions`);
      const data = await res.json();

      setVersions(data.versions || []);
      setExpandedFileId(fileId);
    } catch (err) {
      console.error("Error fetching versions", err);
    } finally {
      setLoadingVersions(false);
    }
  };

  const closeVersions = () => {
    setExpandedFileId(null);
    setVersions([]);
  };

  const filteredFiles = currentFolder
    ? files.filter((f) => f.folder_id === currentFolder.id)
    : files.filter((f) => f.folder_id === null);

  const childFolders = currentFolder
    ? folders.filter((f) => f.parent_id === currentFolder.id)
    : folders.filter((f) => f.parent_id === null);

  const displayedFiles = searchResults.length
    ? searchResults.map((r) => r.document)
    : filteredFiles;

  const groupedFiles = groupFiles(displayedFiles);

  return (
    <div
      className={`z-50 inset-0 fixed h-screen w-[100%] flex items-center justify-center ${
        isDarkMode ? "bg-gray-900 text-white" : "bg-white text-black"
      }`}
    >
      <div className="flex flex-row h-screen min-h-0 w-full">
        {/* Sidebar */}
        <div
          className={`border-r p-4 overflow-y-auto basis-[15%] min-h-0 ${
            isDarkMode ? "bg-gray-800 border-gray-700" : "bg-slate-300"
          }`}
        >
          <h2 className="font-bold mb-2">Departments</h2>
          <ul>
            {folders
              .filter((f) => f.parent_id === null)
              .map((folder) => renderFolder(folder))}
          </ul>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex gap-2 items-center">
              {currentFolder && (
                <Button
                  variant="outline"
                  size="sm"
                  className={
                    isDarkMode
                      ? "bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                      : ""
                  }
                  onClick={() =>
                    setCurrentFolder(
                      folders.find((f) => f.id === currentFolder.parent_id) ||
                        null
                    )
                  }
                >
                  <ArrowLeft size={16} /> Back
                </Button>
              )}
              <h2 className="font-bold text-lg">
                {currentFolder ? currentFolder.name : "Root"}
              </h2>
            </div>
            <div className="flex items-end gap-2 items-center">
              <div
                className={`flex items-center border rounded px-2 ${
                  isDarkMode
                    ? "border-gray-700 bg-gray-800"
                    : "border-gray-300 bg-white"
                }`}
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearch();
                  }}
                  className="flex items-center"
                >
                  <input
                    type="text"
                    placeholder="Search..."
                    className={`p-1 outline-none bg-transparent ${
                      isDarkMode
                        ? "text-white placeholder-gray-400"
                        : "text-black"
                    }`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Button type="submit" variant="ghost" size="icon">
                    <Search size={16} />
                  </Button>
                </form>
              </div>

              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger
                  className={`w-[140px] ${
                    isDarkMode
                      ? "bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                      : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="file_type">File Type</SelectItem>
                </SelectContent>
              </Select>

              <Button
                className={
                  isDarkMode
                    ? "bg-gray-800 text-white border border-gray-700 hover:bg-gray-700"
                    : "bg-white text-black hover:bg-gray-100"
                }
                onClick={() => setShowDialog(true)}
              >
                <Plus size={16} /> New Folder
              </Button>
              <Button
                className={
                  isDarkMode
                    ? "bg-gray-800 text-white border border-gray-700 hover:bg-gray-700"
                    : "bg-white text-black hover:bg-gray-100"
                }
                onClick={() => setUploadDialog(true)}
              >
                <Plus size={16} /> Upload
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            {childFolders.map((folder) => (
              <div
                key={folder.id}
                className={`p-3 border rounded-xl flex items-center gap-2 cursor-pointer relative ${
                  isDarkMode
                    ? "border-gray-700 hover:bg-gray-800"
                    : "hover:bg-gray-100"
                }`}
                onClick={() => setCurrentFolder(folder)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, folder)}
              >
                <Folder className="h-6 w-6 text-blue-500 flex-shrink-0 cursor-pointer" />
                {folder.name}
                <button
                  className={`absolute top-1 right-1 text-xs ${
                    isDarkMode
                      ? "text-gray-400 hover:text-white"
                      : "text-gray-500 hover:text-black"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameTarget({ type: "folder", id: folder.id });
                    setRenameValue(folder.name);
                    setRenameDialog(true);
                  }}
                >
                  <Pencil size={12} />
                </button>
              </div>
            ))}
          </div>

          {groupBy === "none" ? (
            <div className="grid grid-cols-3 gap-4">
              {displayedFiles.map((file) => (
                <div
                  key={file.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, file)}
                >
                  <FileCard
                    key={file.id}
                    file={file}
                    viewMode="list"
                    expandedFileId={expandedFileId}
                    fetchVersions={fetchVersions}
                    onDelete={() => handleDeleteClick(file.id)}
                    onDownload={() =>
                      onDownloadFile(file.id, file.original_filename)
                    }
                    onpreview={() => onPreviewFile(file)}
                    closeVersions={closeVersions}
                    darkMode={isDarkMode}
                  />
                </div>
              ))}
            </div>
          ) : (
            Object.keys(groupedFiles).map((groupKey) => (
              <div key={groupKey} className="mb-6">
                <h3 className="font-semibold mb-2">{groupKey}</h3>
                <div className="grid grid-cols-4 gap-4">
                  {groupedFiles[groupKey].map((file) => (
                    <div
                      key={file.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, file)}
                    >
                      <FileCard
                        key={file.id}
                        file={file}
                        viewMode="list"
                        expandedFileId={expandedFileId}
                        fetchVersions={fetchVersions}
                        onDelete={() => handleDeleteClick(file.id)}
                        onDownload={() =>
                          onDownloadFile(file.id, file.original_filename)
                        }
                        onpreview={() => onPreviewFile(file)}
                        closeVersions={closeVersions}
                        darkMode={isDarkMode}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Dialogs and overlays - unchanged */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className={isDarkMode ? "bg-gray-800 text-white border-gray-700" : ""}>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
          </DialogHeader>
          <div className="modal">
            <div className="modal-content">
              <p className="mb-4">
                Do you want to delete only the latest version or all versions?
              </p>
              <div className="flex gap-4">
                <Button
                  className={
                    isDarkMode
                      ? "bg-gray-700 text-white border border-gray-600 hover:bg-gray-600"
                      : "bg-white text-black border"
                  }
                  onClick={handleDeleteFile}
                >
                  Delete File
                </Button>
                <Button
                  className={
                    isDarkMode
                      ? "bg-gray-700 text-white border border-gray-600 hover:bg-gray-600"
                      : "bg-white text-black border"
                  }
                  onClick={handleDeleteAllVersions}
                >
                  Delete All Versions
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className={isDarkMode ? "bg-gray-800 text-white border-gray-700" : ""}>
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
          </DialogHeader>
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className={`border rounded p-2 w-full mb-3 ${
              isDarkMode
                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                : "bg-white border-gray-300"
            }`}
            placeholder="Folder name"
          />
          <Button onClick={createFolder}>Create</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialog} onOpenChange={setRenameDialog}>
        <DialogContent className={isDarkMode ? "bg-gray-800 text-white border-gray-700" : ""}>
          <DialogHeader>
            <DialogTitle>Rename {renameTarget?.type}</DialogTitle>
          </DialogHeader>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className={`border rounded p-2 w-full mb-3 ${
              isDarkMode
                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                : "bg-white border-gray-300"
            }`}
            placeholder="New name"
          />
          <Button onClick={renameItem}>Rename</Button>
        </DialogContent>
      </Dialog>

      {expandedFileId ? (
        <Dialog
          open={!!expandedFileId}
          onOpenChange={() => setExpandedFileId(null)}
        >
          <DialogContent className={`max-w-5xl ${isDarkMode ? "bg-gray-800 text-white border-gray-700" : ""}`}>
            {loadingVersions ? (
              <p>Loading versions...</p>
            ) : versions.length > 0 ? (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {versions[0].original_filename} – {versions[0].contractor}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-2 max-h-96 overflow-y-auto mt-4">
                  {versions.map((vfile, idx) => (
                    <div
                      key={vfile.id}
                      className={`flex items-center justify-between border rounded-lg p-3 ${
                        isDarkMode ? "border-gray-700" : ""
                      }`}
                    >
                      <div>
                        <p className="font-medium">Version {vfile.version}</p>
                        <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                          Size: {(vfile.file_size / 1024).toFixed(2)} KB •
                          Uploaded: {new Date(vfile.upload_date).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className={isDarkMode ? "border-gray-600 hover:bg-gray-700" : ""}
                          onClick={() => onPreviewFile(vfile)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={isDarkMode ? "border-gray-600 hover:bg-gray-700" : ""}
                          onClick={() => onDownloadFile(vfile.id, vfile.original_filename)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={isDarkMode ? "border-gray-600 hover:bg-gray-700" : ""}
                          onClick={() => onDeleteFile(vfile.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={isDarkMode ? "border-gray-600 hover:bg-gray-700" : ""}
                          onClick={() => restoreVersion(vfile)}
                        >
                          <ListRestartIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p>No versions found</p>
            )}
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className={isDarkMode ? "bg-gray-800 text-white border-gray-700" : ""}>
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
          </DialogHeader>

          <div className="mb-3">
            <label className="block mb-1">Department Name</label>
            <input
              type="text"
              value={uploadContractor}
              onChange={(e) => setUploadContractor(e.target.value)}
              className={`border rounded p-2 w-full ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  : "bg-white border-gray-300"
              }`}
              placeholder="Contractor Name"
            />
          </div>

          <div className="mb-3">
            <label className="block mb-1">Tags (comma separated)</label>
            <input
              type="text"
              value={uploadTags}
              onChange={(e) => setUploadTags(e.target.value)}
              className={`border rounded p-2 w-full ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  : "bg-white border-gray-300"
              }`}
              placeholder="tag1, tag2"
            />
          </div>

          <div className="mb-3">
            <label className="block mb-1">Select Files</label>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className={`w-full ${isDarkMode ? "text-white" : ""}`}
            />
          </div>

          <Button onClick={handleUpload}>Upload</Button>
        </DialogContent>
      </Dialog>

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

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent
          className={`transition-colors duration-300 
            ${isDarkMode ? 'bg-gray-900 text-gray-100 border-gray-700' : 'bg-white text-gray-900 border-gray-200'}`}
        >
          <DialogHeader>
            <DialogTitle
              className={`${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}
            >
              Search Results
            </DialogTitle>
          </DialogHeader>

          {searchResults2.length === 0 ? (
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              No results found.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {searchResults2.map((doc) => (
                <div
                  key={doc.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-all duration-200 
                    ${isDarkMode 
                      ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' 
                      : 'bg-gray-50 border-gray-300 hover:bg-gray-100'}`}
                  onClick={() => console.log("Clicked doc:", doc.id)}
                >
                  <h4
                    className={`mb-1 font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}
                  >
                    {doc.original_filename}
                  </h4>
                  <small className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Version: {doc.version} | Location: {doc.address}
                  </small>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>

  );
}
