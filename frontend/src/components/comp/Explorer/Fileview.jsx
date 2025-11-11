import React, { useState, useEffect, useRef } from "react";
import { DocumentEditor } from "@onlyoffice/document-editor-react";
import { getCurrentUser } from "../currentUser";

const DOCUMENT_SERVER_URL = "https://onlyoffice-docserver-hxf6cbcbfufzebfa.centralindia-01.azurewebsites.net/";
const API_BASE = "http://localhost:5000/api/documents";

// Determine document type from filename
const getDocumentType = (filename) => {
  if (/\.(xlsx|csv)$/i.test(filename)) return "cell";
  if (/\.(pptx|ppt)$/i.test(filename)) return "slide";
  return "word";
};

// Get file extension
const getExtension = (filename) => filename?.split(".").pop().toLowerCase();

export default function FileView2({ file, onClose, token }) {
  const [sasUrl, setSasUrl] = useState(null);
  const [editorConfig, setEditorConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const editorRef = useRef(null);
  const editorContainerRef = useRef(null);
  const currentFileIdRef = useRef(null);

  // Cleanup function to destroy editor instance
  const destroyEditor = () => {
    try {
      if (editorRef.current?.instance) {
        editorRef.current.instance.destroyEditor();
      }
    } catch (err) {
      console.log("Editor cleanup:", err.message);
    }
    
    // Clear the container
    if (editorContainerRef.current) {
      editorContainerRef.current.innerHTML = '';
    }
    
    editorRef.current = null;
    setEditorConfig(null);
  };

  useEffect(() => {
    // If file changed, destroy old editor first
    if (currentFileIdRef.current && currentFileIdRef.current !== file?.id) {
      destroyEditor();
    }

    const initializeEditor = async () => {
      try {
        setLoading(true);
        setError(null);
        currentFileIdRef.current = file.id;

        // Fetch SAS URL
        const sasRes = await fetch(`${API_BASE}/files/${file.id}/previewoff`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!sasRes.ok) throw new Error("Failed to fetch document URL");
        const { sasUrl } = await sasRes.json();
        setSasUrl(sasUrl);

        // Check permissions
        const permRes = await fetch(`${API_BASE}/check-permission/${file.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!permRes.ok) throw new Error("Permission check failed");
        const { can_edit } = await permRes.json();

        // Build and sign config
        const user = getCurrentUser();
        const extension = getExtension(file.original_filename);
        const baseConfig = {
          document: {
            fileType: extension,
            key: `${file.id}-${Date.now()}`, // Unique key for each load
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
        const tokenRes = await fetch(`${API_BASE}/onlyoffice/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(baseConfig),
        });
        const { otoken } = await tokenRes.json();
        baseConfig.token = otoken;

        // Small delay to ensure cleanup is complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        setEditorConfig(baseConfig);
      } catch (err) {
        console.error("Editor initialization failed:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (file?.id) {
      initializeEditor();
    }

    // Cleanup on unmount
    return () => {
      destroyEditor();
    };
  }, [file?.id, token]);

  const handleSaveAs = async (event) => {
    try {
      const newFileName = event?.data?.title || file.original_filename;
      const extension = getExtension(file.original_filename);

      editorRef.current?.instance?.downloadAs(async (blob) => {
        if (!blob) throw new Error("No file data received");

        const formData = new FormData();
        formData.append("files", blob, newFileName);
        formData.append("metadata", JSON.stringify({
          contractor: file.contractor,
          tags: file.tags,
          folder_id: file.folder_id,
        }));

        const res = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");
        console.log("File saved successfully");
      }, extension);
    } catch (err) {
      console.error("Save As failed:", err);
    }
  };

  if (loading) return <p className="p-4">Loading editor...</p>;
  if (error) return <p className="p-4 text-red-500">Error: {error}</p>;

  return (
    <div className="p-4 w-screen h-screen">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Editing: {file.original_filename}</h2>
        <button
          onClick={onClose}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
        >
          Close
        </button>
      </div>

      <div ref={editorContainerRef} className="w-full h-[calc(100vh-6rem)]">
        {editorConfig && (
          <DocumentEditor
            id="ooEditor"
            ref={editorRef}
            documentServerUrl={DOCUMENT_SERVER_URL}
            config={editorConfig}
            events_onDocumentReady={() => console.log("Editor ready")}
            events_onRequestSaveAs={handleSaveAs}
            events_onError={(err) => console.error("Editor error:", err)}
          />
        )}
      </div>
    </div>
  );
}