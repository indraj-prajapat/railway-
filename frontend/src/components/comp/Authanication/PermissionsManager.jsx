// PermissionsManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:5000/api/documents";

function PermissionsManager({ token, darkMode }) {
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedContractor, setSelectedContractor] = useState("");
  const [currentPerm, setCurrentPerm] = useState({ can_view: false, can_edit: false });
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ username: "", email: "", role: "" });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPermission, setSelectedPermission] = useState('');
  const [addresses, setAddresses] = useState({});

  const axiosInstance = useMemo(() => {
    return axios.create({
      baseURL: API_BASE,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }, [token]);

  // --- Fetch all data ---
  useEffect(() => {
    if (!token) return;
    fetchDocs();
    fetchUsers();
    fetchContractors();
  }, [token]);

  // Fetch folder address for a given folder_id
  const fetchAddress = async (folderId) => {
    if (addresses[folderId]) return; // already cached

    try {
      const res = await axios.get(`${API_BASE}/folder/address/${folderId}`);
      setAddresses((prev) => ({
        ...prev,
        [folderId]: res.data.address,
      }));
    } catch (error) {
      console.error("Error fetching folder address:", error);
    }
  };

  // Fetch addresses for all folder_ids when documents change
  useEffect(() => {
    if (Array.isArray(documents)) {
      documents.forEach((d) => {
        if (d.folder_id) {
          fetchAddress(d.folder_id);
        }
      });
    }
  }, [documents]);

  const fetchDocs = async () => {
    try {
      const res = await axiosInstance.get("/all-documents");
      setDocuments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setDocuments([]);
      setError("Failed to load documents");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axiosInstance.get("/users");
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setUsers([]);
      setError("Failed to load users");
    }
  };

  const fetchContractors = async () => {
    try {
      const res = await axiosInstance.get("/all-contractors");
      setContractors(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("fetchContractors error", err);
      setContractors([]);
    }
  };

  const fetchPermission = async (docId, userId) => {
    if (!docId || !userId) return setCurrentPerm({ can_view: false, can_edit: false });
    try {
      const res = await axiosInstance.get(`/${docId}/permissions`);
      const perms = Array.isArray(res.data) ? res.data : [];
      const row = perms.find((p) => String(p.user_id) === String(userId));
      setCurrentPerm(row ? { can_view: !!row.can_view, can_edit: !!row.can_edit } : { can_view: false, can_edit: false });
    } catch (err) {
      console.warn(err);
      setCurrentPerm({ can_view: false, can_edit: false });
    }
  };

  useEffect(() => {
    fetchPermission(selectedDocId, selectedUserId);
  }, [selectedDocId, selectedUserId]);

  // --- Permission actions ---
  const handleSetPermission = async () => {
    if (!selectedDocId || !selectedUserId) return setMessage("Select document and user");
    try {
      await axiosInstance.post("/permissions", {
        document_id: Number(selectedDocId),
        user_id: selectedUserId, // UUID
        can_view: currentPerm.can_view,
        can_edit: currentPerm.can_edit,
      });
      setMessage("✅ Permission saved successfully");
      fetchDocs();
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.error || "Failed to save permission");
    }
  };

  const handleRevoke = async () => {
    if (!selectedDocId || !selectedUserId) return setMessage("Select document and user");
    try {
      await axiosInstance.delete("/permissions", {
        data: { document_id: Number(selectedDocId), user_id: selectedUserId },
      });
      setCurrentPerm({ can_view: false, can_edit: false });
      setMessage("❌ Permission revoked");
      fetchDocs();
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.error || "Failed to revoke permission");
    }
  };

  const handleAssignContractor = async () => {
    if (!selectedUserId || !selectedContractor || !selectedPermission) {
      return setMessage("Select user, contractor, and permission");
    }
    try {
      await axiosInstance.post(`/users/${selectedUserId}/contractors`, { 
        contractor: selectedContractor,
        permission: selectedPermission, // "view" or "edit"
      });
      setMessage(`✅ Contractor '${selectedContractor}' assigned with '${selectedPermission}' permission`);
      setSelectedContractor("");
      setSelectedPermission("");
      fetchUsers();
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.error || "Failed to assign Department");
    }
  };

  // --- User edit ---
  const handleEditUser = (user) => {
    setEditingUser(user);
    setEditForm({ username: user.username, email: user.email, role: user.role });
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    try {
      // UUID-safe PUT
      await axiosInstance.put(`/users/${editingUser.id}`, editForm);
      setMessage("✅ User updated successfully");
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
      // Handle uniqueness errors
      const backendMsg = err.response?.data?.error;
      if (backendMsg && backendMsg.includes("exists")) {
        setMessage("⚠️ Username or Email already exists");
      } else {
        setMessage(backendMsg || "Failed to update user");
      }
    }
  };

  return (
    <div className={`shadow-2xl p-8 rounded-2xl border mx-auto space-y-8 ${
      darkMode 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-200'
    }`}>
      <h2 className={`text-3xl font-bold flex items-center gap-3 border-b pb-4 ${
        darkMode 
          ? 'text-white border-gray-700' 
          : 'text-gray-800 border-gray-200'
      }`}>
        🔐 Permissions & User Manager
      </h2>

      {error && (
        <div className={`font-medium p-3 rounded-lg ${
          darkMode 
            ? 'text-red-400 bg-red-900/30' 
            : 'text-red-600 bg-red-50'
        }`}>
          {error}
        </div>
      )}
      
      {message && (
        <div className={`font-medium p-3 rounded-lg ${
          darkMode 
            ? 'text-green-400 bg-green-900/30' 
            : 'text-green-600 bg-green-50'
        }`}>
          {message}
        </div>
      )}

      {/* --- Permissions Section --- */}
      <div className={`p-6 border rounded-xl shadow-sm space-y-4 ${
        darkMode 
          ? 'bg-gray-750 border-gray-600' 
          : 'bg-gray-50 border-gray-200'
      }`}>
        <h3 className={`font-semibold text-lg ${
          darkMode ? 'text-gray-200' : 'text-gray-700'
        }`}>
          📄 Document Permissions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select 
            className={`border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
          >
            <option value="">-- Select Document --</option>
            {Array.isArray(documents) &&
              [...new Map(
                documents.map((d) => [`${d.original_filename}-${d.folder_id}`, d])
              ).values()].map((d) => (
                <option key={d.id} value={d.id}>
                  {d.original_filename} ({addresses[d.folder_id] || "root"})
                </option>
              ))}
          </select>
          <select 
            className={`border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            value={selectedUserId} 
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">-- Select User --</option>
            {Array.isArray(users) && users.map((u) => (
              <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
            ))}
          </select>
        </div>
        <div className="flex gap-6 items-center mt-3">
          <label className={`flex items-center gap-2 cursor-pointer ${
            darkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <input 
              type="checkbox" 
              className="w-4 h-4 cursor-pointer" 
              checked={currentPerm.can_view} 
              onChange={(e) => setCurrentPerm({ ...currentPerm, can_view: e.target.checked })} 
            />
            Can View
          </label>
          <label className={`flex items-center gap-2 cursor-pointer ${
            darkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <input 
              type="checkbox" 
              className="w-4 h-4 cursor-pointer" 
              checked={currentPerm.can_edit} 
              onChange={(e) => setCurrentPerm({ ...currentPerm, can_edit: e.target.checked })} 
            />
            Can Edit
          </label>
        </div>
        <div className="flex gap-3 mt-4">
          <button 
            className={`border px-4 py-2 rounded-lg transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
              darkMode 
                ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700' 
                : 'bg-white border-gray-300 text-black hover:bg-gray-200'
            }`}
            onClick={handleSetPermission} 
            disabled={!selectedDocId || !selectedUserId}
          >
            💾 Save
          </button>
          <button 
            className={`border px-4 py-2 rounded-lg transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
              darkMode 
                ? 'bg-red-600 border-red-500 text-white hover:bg-red-700' 
                : 'bg-white border-gray-300 text-black hover:bg-gray-200'
            }`}
            onClick={handleRevoke} 
            disabled={!selectedDocId || !selectedUserId}
          >
            🗑️ Revoke
          </button>
        </div>
      </div>

      {/* --- Contractor Section --- */}
      <div className={`p-6 border rounded-xl shadow-sm space-y-4 ${
        darkMode 
          ? 'bg-gray-750 border-gray-600' 
          : 'bg-gray-50 border-gray-200'
      }`}>
        <h3 className={`font-semibold text-lg ${
          darkMode ? 'text-gray-200' : 'text-gray-700'
        }`}>
          🏢 Assign Department
        </h3>
        <div className="flex flex-col md:flex-row gap-3">
          <select 
            className={`border p-3 rounded-lg flex-1 focus:ring-2 focus:ring-green-500 focus:outline-none ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            value={selectedUserId} 
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">-- Select User --</option>
            {Array.isArray(users) && users.map((u) => (
              <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
            ))}
          </select>
          <select 
            className={`border p-3 rounded-lg flex-1 focus:ring-2 focus:ring-green-500 focus:outline-none ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            value={selectedContractor} 
            onChange={(e) => setSelectedContractor(e.target.value)}
          >
            <option value="">-- Select Department --</option>
            {Array.isArray(contractors) && contractors.map((c, idx) => (
              <option key={idx} value={c}>{c}</option>
            ))}
          </select>
          <select 
            className={`border p-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            value={selectedPermission} 
            onChange={(e) => setSelectedPermission(e.target.value)}
          >
            <option value="">-- Select Permission --</option>
            <option value="view">View Only</option>
            <option value="edit">Edit</option>
          </select>
          <button 
            className={`border px-4 py-2 rounded-lg transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
              darkMode 
                ? 'bg-green-600 border-green-500 text-white hover:bg-green-700' 
                : 'bg-white border-gray-300 text-black hover:bg-gray-200'
            }`}
            onClick={handleAssignContractor} 
            disabled={!selectedUserId || !selectedContractor}
          >
            ➕ Assign
          </button>
        </div>
      </div>

      {/* --- User Edit Section --- */}
      <div className={`p-6 border rounded-xl shadow-sm space-y-4 ${
        darkMode 
          ? 'bg-gray-750 border-gray-600' 
          : 'bg-gray-50 border-gray-200'
      }`}>
        <h3 className={`font-semibold text-lg ${
          darkMode ? 'text-gray-200' : 'text-gray-700'
        }`}>
          ✏️ Edit User Profile
        </h3>
        {!editingUser ? (
          <div className="flex gap-3">
            <select 
              className={`border p-3 rounded-lg flex-1 focus:ring-2 focus:ring-gray-500 focus:outline-none ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              value={selectedUserId} 
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">-- Select User --</option>
              {Array.isArray(users) && users.map((u) => (
                <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
              ))}
            </select>
            <button
              className={`border px-4 py-2 rounded-lg transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                darkMode 
                  ? 'bg-gray-600 border-gray-500 text-white hover:bg-gray-700' 
                  : 'bg-white border-gray-300 text-black hover:bg-gray-200'
              }`}
              disabled={!selectedUserId}
              onClick={() => {
                const u = users.find((u) => String(u.id) === String(selectedUserId));
                if (u) handleEditUser(u);
              }}
            >
              ✏️ Edit
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input 
              type="text" 
              className={`border p-3 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
              placeholder="Username" 
              value={editForm.username} 
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} 
            />
            <input 
              type="email" 
              className={`border p-3 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
              placeholder="Email" 
              value={editForm.email} 
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} 
            />
            <select 
              className={`border p-3 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              value={editForm.role} 
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            >
              <option value="">-- Select Role --</option>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
              <option value="user">User</option>
            </select>
            <div className="flex gap-3">
              <button 
                className={`border px-4 py-2 rounded-lg transition hover:scale-105 ${
                  darkMode 
                    ? 'bg-green-600 border-green-500 text-white hover:bg-green-700' 
                    : 'bg-white border-gray-300 text-black hover:bg-gray-200'
                }`}
                onClick={handleSaveUser}
              >
                💾 Save
              </button>
              <button 
                className={`border px-4 py-2 rounded-lg transition hover:scale-105 ${
                  darkMode 
                    ? 'bg-gray-600 border-gray-500 text-white hover:bg-gray-700' 
                    : 'bg-white border-gray-300 text-black hover:bg-gray-200'
                }`}
                onClick={() => setEditingUser(null)}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PermissionsManager;