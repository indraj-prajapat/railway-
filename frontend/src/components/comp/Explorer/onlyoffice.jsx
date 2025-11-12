import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';

const API_BASE = "http://localhost:5000/api/documents";

const getDocumentType = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) {
    return 'word';
  } else if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return 'cell';
  } else if (['ppt', 'pptx', 'odp'].includes(ext)) {
    return 'slide';
  } else if (['pdf'].includes(ext)) {
    return 'word'; // PDF ko word type se open karte hain
  }
  
  return 'word'; // default
};

export const OnlyOfficeEditor = ({ doc, callbackUrl, token,onClose }) => {
  const editorRef = useRef(null);
  const docEditorRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  console.log('OnlyOfficeEditor doc:', doc);
  console.log('callbackUrl:', callbackUrl);

  // Load OnlyOffice script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://onlyoffice-docserver-hxf6cbcbfufzebfa.centralindia-01.azurewebsites.net/web-apps/apps/api/documents/api.js';
    script.async = true;
    
    script.onload = () => {
      console.log('✅ OnlyOffice script loaded successfully');
      console.log('window.DocsAPI available:', !!window.DocsAPI);
      setScriptLoaded(true);
    };
    
    script.onerror = () => {
      console.error('❌ Failed to load OnlyOffice script');
      setError('Failed to load OnlyOffice script');
    };
    
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Initialize editor when script is loaded and doc is available
  useEffect(() => {
    if (!doc || !scriptLoaded || !window.DocsAPI) {
      console.log('Waiting for:', {
        doc: !!doc,
        scriptLoaded,
        DocsAPI: !!window.DocsAPI
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    // Destroy previous editor instance
    if (docEditorRef.current) {
      try {
        docEditorRef.current.destroyEditor();
        console.log('Previous editor destroyed');
      } catch (e) {
        console.log('Editor destroy error:', e);
      }
      docEditorRef.current = null;
    }

    // Clear the container
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }

    async function initializeEditor() {
      try {
        console.log('🔄 Fetching SAS URL for doc:', doc.id);
        
        // Fetch the SAS URL first
        const sasRes = await fetch(`${API_BASE}/files/${doc.id}/previewoff`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!sasRes.ok) {
          throw new Error(`Failed to fetch document URL: ${sasRes.status}`);
        }
        
        const { sasUrl } = await sasRes.json();
        console.log('✅ Fetched sasUrl:', sasUrl);
        
        if (!sasUrl) {
          throw new Error("SAS URL is empty");
        }
        const permRes = await fetch(`${API_BASE}/check-permission/${doc.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!permRes.ok) throw new Error("Permission check failed");
        const { can_edit } = await permRes.json();
        const documentType = getDocumentType(doc.original_filename);
        const fileType = doc.original_filename.split('.').pop()?.toLowerCase() || 'docx';
        
        console.log('Document details:', {
          documentType,
          fileType,
          filename: doc.original_filename
        });
        
        const config = {
          document: {
            fileType: fileType,
            key: String(doc.id),
            title: doc.original_filename,
            url: sasUrl,
            permissions: {
              edit: true,
              download: true,
              print: true,
              review: true,
            },
          },
          documentType: documentType,
          editorConfig: {
            mode: can_edit ? "edit" : "view",
            callbackUrl: callbackUrl,
            customization: {
              autosave: false,
              forcesave: true,
              comments: true,
              chat: false,
              compactHeader: false,
              compactToolbar: false,
              help: true,
              hideRightMenu: false,
              plugins: true,
              reviewDisplay: 'original',
              toolbarNoTabs: false,
              zoom: 100,
            },
            user: {
              id: 'local-user',
              name: 'Local User',
            },
          },
          events: {
            onDocumentReady: () => {
              console.log('✅ Document is ready for editing');
              setIsLoading(false);
            },
            onDownloadAs: () => {
              console.log('Download triggered');
            },
            onError: (event) => {
              console.error('❌ OnlyOffice error:', event);
              setError(`OnlyOffice error: ${JSON.stringify(event)}`);
              setIsLoading(false);
            },
            onRequestSaveAs: (event) => {
              console.log('Save as requested:', event);
            },
          },
          width: '100%',
          height: '100%',
        };

        console.log('🚀 Initializing OnlyOffice DocEditor with config:', config);
        
        // Check if container exists
        const container = document.getElementById('onlyoffice-editor');
        if (!container) {
          throw new Error('Editor container not found');
        }
        
        docEditorRef.current = new window.DocsAPI.DocEditor('onlyoffice-editor', config);
        console.log('✅ DocEditor instance created');
        
      } catch (error) {
        console.error('❌ Error initializing OnlyOffice:', error);
        setError(error.message);
        setIsLoading(false);
      }
    }

    initializeEditor();

    return () => {
      if (docEditorRef.current) {
        try {
          docEditorRef.current.destroyEditor();
        } catch (e) {
          console.log('Cleanup error:', e);
        }
      }
    };
  }, [doc, callbackUrl, token, scriptLoaded]);

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center text-muted-foreground">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No document selected</p>
          <p className="text-sm">Select a document from the list to start editing</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center text-red-500">
          <FileText className="w-16 h-16 mx-auto mb-4" />
          <p className="text-lg font-medium">Error loading editor</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-background relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <div className="text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading editor...</p>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Editing: {doc.original_filename}</h2>
        <button
          onClick={onClose}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
        >
          Close
        </button>
      </div>
      <div id="onlyoffice-editor" ref={editorRef} className="h-full w-full" />
    </div>
  );
};