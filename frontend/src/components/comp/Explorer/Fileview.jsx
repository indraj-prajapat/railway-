import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { DocumentEditor } from "@onlyoffice/document-editor-react";
import { getCurrentUser } from "../currentUser";

/* Upload helper */
async function uploadFile(blob, file, token, newFileName) {
  const formData = new FormData();
  formData.append("files", blob, newFileName || file.original_filename);
  const metadata = {
    contractor: file.contractor,
    tags: file.tags,
    folder_id: file.folder_id,
  };
  formData.append("metadata", JSON.stringify(metadata));
  const response = await fetch("http://localhost:5000/api/documents/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to upload edited file");
}

/* OnlyOffice Component */
/* OnlyOffice Component */
const OnlyOfficeEditor = forwardRef(({ file, documentUrl, token }, ref) => {
  const [signedConfig, setSignedConfig] = useState(null);
  const editorRef = useRef(null);
  const decoded = getCurrentUser();
  console.log('token is number ',decoded)
  let documentType = "word";
  if (/\.(xlsx|csv)$/i.test(file?.original_filename)) documentType = "cell";
  if (/\.(pptx|ppt)$/i.test(file?.original_filename)) documentType = "slide";
  if (/\.pdf$/i.test(file?.original_filename)) documentType = "word";

  const extension = file?.original_filename
    ?.split(".")
    .pop()
    .toLowerCase();
  const documentServerUrl =
    "https://onlyoffice-docserver-hxf6cbcbfufzebfa.centralindia-01.azurewebsites.net/";

  useEffect(() => {
    const getSignedConfig = async () => {
      try {
        // 🔹 Step 1: Permission check
        const permResp = await fetch(
          `http://localhost:5000/api/documents/check-permission/${file.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!permResp.ok) throw new Error("Permission check failed");
        const permData = await permResp.json();

        // 🔹 Step 2: Build base config
        const baseConfig = {
          document: {
            fileType: extension,
            key: file.id.toString(),
            title: file.original_filename,
            url: documentUrl,
          },
          documentType,
          editorConfig: {
            mode: permData.can_edit ? "edit" : "view", // 🔹 control edit/view
            customization: {
              autosave: false, // ✅ disable autosave
              forcesave: true, // ✅ enable force save
            },
            callbackUrl: `https://4308e1e47ffe.ngrok-free.app/api/documents/onlyoffice/callback/${file.id}?user_id=${decoded.id}`,
          },
        };

        // 🔹 Step 3: Sign config
        const res = await fetch(
          "http://localhost:5000/api/documents/onlyoffice/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(baseConfig),
          }
        );
        const { otoken } = await res.json();
        baseConfig.token = otoken;

        setSignedConfig(baseConfig);
      } catch (err) {
        console.error("Failed to prepare OnlyOffice config:", err);
      }
    };

    if (file && documentUrl) {
      getSignedConfig();
    }
  }, [file, documentUrl, extension, documentType, token]);

  useImperativeHandle(ref, () => ({
    getEditor: () => editorRef.current,
  }));

  return (
    <div style={{ width: "100%", height: "90vh" }}>
      {signedConfig ? (
        <DocumentEditor
          id="ooEditor"
          ref={editorRef}
          documentServerUrl={documentServerUrl}
          config={signedConfig}
          events_onDocumentReady={() => {
            console.log("OnlyOffice editor ready");
          }}
          events_onRequestSaveAs={async (event) => {
            console.log("Save As clicked");

            try {
              const newFileName = event?.data?.title || file.original_filename;

              editorRef.current?.instance?.downloadAs(
                async (blob) => {
                  if (!blob) {
                    console.error("No blob returned from editor");
                    return;
                  }
                  await uploadFile(blob, file, token, newFileName);
                  console.log("Save As upload successful!");
                },
                extension
              );
            } catch (err) {
              console.error("Save As upload failed:", err);
            }
          }}
          events_onError={(err) => {
            console.error("OnlyOffice load error:", err);
          }}
        />
      ) : (
        <p>Loading editor...</p>
      )}
    </div>
  );
});


/* Main FileView2 Component */
export default function FileView2({ file, onClose, token }) {
  const [sasUrl, setSasUrl] = useState(null);

  useEffect(() => {
    const fetchSasUrl = async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/documents/files/${file.id}/previewoff`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) throw new Error("Failed to fetch SAS URL");
        const data = await res.json();
        setSasUrl(data.sasUrl);
      } catch (err) {
        console.error("Error fetching SAS URL:", err);
      }
    };

    if (file?.id) {
      fetchSasUrl();
    }
  }, [file, token]);

  if (!sasUrl) return <p>Loading editor...</p>;

  return (
    <div className="p-4 w-[100vw] h-[90vh]">
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">Editing: {file.original_filename}</h2>
        <button
          onClick={onClose}
          className="bg-red-500 text-white px-3 py-1 rounded"
        >
          X
        </button>
      </div>

      <OnlyOfficeEditor file={file} documentUrl={sasUrl} token={token} />
    </div>
  );
}
