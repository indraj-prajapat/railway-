import { useEffect, useRef ,useState} from 'react';
import { FileText } from 'lucide-react';
import { getCurrentUser } from "../currentUser";
// Simple global singleton loader
const API_BASE = "http://localhost:5000/api/documents";
let onlyOfficeScriptPromise = null;
function loadOnlyOfficeScriptOnce() {
  if (onlyOfficeScriptPromise) return onlyOfficeScriptPromise;

  onlyOfficeScriptPromise = new Promise((resolve, reject) => {
    if (window.DocsAPI) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://onlyoffice-docserver-hxf6cbcbfufzebfa.centralindia-01.azurewebsites.net/web-apps/apps/api/documents/api.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.body.appendChild(script);
  });

  return onlyOfficeScriptPromise;
}

export default function OnlyOfficeEditor ({ callbackUrl,doc,token})  {
  const editorRef = useRef(null);
  const docEditorRef = useRef(null);
  const [sasUrl, setSasUrl] = useState(null);
  // Create/destroy editor when doc changes, but script loads only once globally
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!doc) return;

      // Ensure DocsAPI is available once globally
      try {
        await loadOnlyOfficeScriptOnce();
      } catch (e) {
        console.error('Failed to load ONLYOFFICE DocsAPI:', e);
        return;
      }
      if (cancelled || !window.DocsAPI) return;

      // Clean previous instance safely
      if (docEditorRef.current) {
        try {
          // Ask editor to close first to avoid data loss dialogs
          if (typeof docEditorRef.current.requestClose === 'function') {
            docEditorRef.current.requestClose();
          }
          docEditorRef.current.destroyEditor();
        } catch (e) {
          console.log('Editor destroy error:', e);
        }
        docEditorRef.current = null;
      }

      // Clear container
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      const user = getCurrentUser();
      const documentType = getDocumentType(doc.original_filename);
      const fileType = (doc.original_filename.split('.').pop() || 'docx').toLowerCase();
      const url = await getSasUrlByFileId(doc.id, token);
      setSasUrl(url);
      const config = {
        document: {
          fileType: fileType,
          key: doc.id,               // ensure this changes when content/version changes
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
          mode: 'edit',
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
            console.log('Document is ready for editing');
          },
          onDownloadAs: () => {
            console.log('Download triggered');
          },
          onError: (event) => {
            console.error('OnlyOffice error:', event);
          },
          onRequestSaveAs: (event) => {
            console.log('Save as requested:', event);
          },
        },
        width: '100%',
        height: '100%',
      };

      try {
        // Mount into element with id below
        docEditorRef.current = new window.DocsAPI.DocEditor('onlyoffice-editor', config);
      } catch (error) {
        console.error('Error initializing OnlyOffice:', error);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (docEditorRef.current) {
        try {
          if (typeof docEditorRef.current.requestClose === 'function') {
            docEditorRef.current.requestClose();
          }
          docEditorRef.current.destroyEditor();
        } catch (e) {
          console.log('Cleanup error:', e);
        }
      }
    };
  }, [doc, callbackUrl]);

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center text-muted-foreground">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No document selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-background">
      <div id="onlyoffice-editor" ref={editorRef} className="h-full w-full" />
    </div>
  );
};




const getDocumentType = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) {
    return 'word';
  } else if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return 'cell';
  } else if (['ppt', 'pptx', 'odp'].includes(ext)) {
    return 'slide';
  }
  
  return 'word'; // default
};




async function getSasUrlByFileId(fileId, token) {
  if (!fileId) throw new Error('fileId is required'); 
  if (!token) throw new Error('token (Bearer) is required');

  const res = await fetch(`${API_BASE}/files/${fileId}/previewoff`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch SAS URL (${res.status}): ${text}`); 
  }

  const data = await res.json();
  if (!data?.sasUrl) {
    throw new Error('Response missing sasUrl'); 
  }

  return data.sasUrl;
}