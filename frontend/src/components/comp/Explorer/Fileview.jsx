import React, { useState, useEffect } from "react";
import { DocumentEditor } from "@onlyoffice/document-editor-react";
import { BASE_API } from "@/config/setting";
const DOCUMENT_SERVER_URL = "https://onlyoffice-docserver-hxf6cbcbfufzebfa.centralindia-01.azurewebsites.net/";
const API_BASE = `${BASE_API}/api/documents`;
import { getOnlyOfficeToken } from "@/services/api";

// Determine document type from filename
const getDocumentType = (filename) => {
  if (/\.(xlsx|csv)$/i.test(filename)) return "cell";
  if (/\.(pptx|ppt)$/i.test(filename)) return "slide";
  return "word";
};

// Get file extension
const getExtension = (filename) => filename?.split(".").pop()?.toLowerCase();

export default function FileView2({ file, onClose, token }) {
  const [editorConfig, setEditorConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    const initializeEditor = async () => {
      try {
        if (!mounted) return;
        
        setLoading(true);
        setError(null);

        // Fetch SAS URL
        const sasRes = await fetch(`${API_BASE}/files/${file.id}/previewoff`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!sasRes.ok) throw new Error("Failed to fetch document URL");
        const { sasUrl } = await sasRes.json();

        // Check permissions
        const permRes = await fetch(`${API_BASE}/check-permission/${file.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!permRes.ok) throw new Error("Permission check failed");
        const { can_edit } = await permRes.json();

        // Get current user (assuming you have this function)
        const user = { id: 'local-user' }; // Replace with actual getCurrentUser() if available
        const extension = getExtension(file.original_filename);
        
        const baseConfig = {
          document: {
            fileType: extension,
            key: `${file.id}-${Date.now()}`,
            title: file.original_filename,
            url: sasUrl,
          },
          documentType: getDocumentType(file.original_filename),
          editorConfig: {
            mode: can_edit ? "edit" : "view",
            customization: {
              autosave: false,
              forcesave: true,
            },
            callbackUrl: `https://quincy-degraded-azzie.ngrok-free.dev/api/documents/onlyoffice/callback/${file.id}?user_id=${user.id}`,
          },
        };

        // Get signed token
        const { otoken } = await getOnlyOfficeToken(baseConfig);
        baseConfig.token = otoken;

        if (!mounted) return;

        setEditorConfig(baseConfig);
        setLoading(false);
      } catch (err) {
        console.error("Editor initialization failed:", err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    if (file?.id) {
      initializeEditor();
    }

    return () => {
      mounted = false;
    };
  }, [file?.id, token]);

  const handleClose = () => {
    // Force remount on next open by incrementing key
    setEditorKey(prev => prev + 1);
    setEditorConfig(null);
    onClose();
  };

  if (loading) return <p className="p-4">Loading editor...</p>;
  if (error) return <p className="p-4 text-red-500">Error: {error}</p>;

  return (
    <div className="p-4 w-screen h-screen">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Editing: {file.original_filename}</h2>
        <button
          onClick={handleClose}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
        >
          Close
        </button>
      </div>

      <div className="w-full h-[calc(100vh-6rem)]">
        {editorConfig && (
          <DocumentEditor
            key={`editor-${file.id}-${editorKey}`}
            id={`ooEditor-${editorKey}`}
            documentServerUrl={DOCUMENT_SERVER_URL}
            config={editorConfig}
            events_onDocumentReady={() => console.log("Editor ready")}
            events_onError={(err) => console.error("Editor error:", err)}
          />
        )}
      </div>
    </div>
  );
}
