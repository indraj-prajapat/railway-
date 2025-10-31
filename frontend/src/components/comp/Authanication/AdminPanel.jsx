import React, { useEffect, useState } from "react";
import axios from "axios";
import PermissionsManager from "./PermissionsManager";

function AdminPanel({ token, closePanel, darkMode }) {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    role: "viewer",
  });

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const res = await axios.get("http://localhost:5000/api/documents/user-contractors", authHeaders);
    setUsers(res.data);
  };

  const handleCreateUser = async () => {
    await axios.post("http://localhost:5000/api/documents/register", newUser, authHeaders);
    fetchUsers();
    setNewUser({ username: "", email: "", password: "", role: "viewer" });
  };

  const handleUpdateRole = async (id, role) => {
    await axios.put(`http://localhost:5000/api/documents/update-role/${id}`, { role }, authHeaders);
    fetchUsers();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className={`w-full max-w-7xl max-h-[90vh] overflow-y-auto m-4 rounded-2xl shadow-2xl ${
        darkMode ? 'bg-gray-900' : 'bg-white'
      }`}>
        <div className="p-6 relative">
          {/* Close button */}
          <button
            onClick={closePanel}
            className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              darkMode 
                ? 'bg-gray-800 hover:bg-gray-700 text-white' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h1 className={`text-3xl text-center font-bold mb-8 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            ⚙️ Admin Panel
          </h1>

          {/* User List */}
          <div className={`shadow-xl p-6 rounded-2xl border ${
            darkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <h2 className={`text-2xl font-bold mb-6 flex items-center gap-2 ${
              darkMode ? 'text-white' : 'text-gray-800'
            }`}>
              👥 Users
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className={`text-sm uppercase tracking-wider ${
                    darkMode 
                      ? 'bg-gray-700 text-gray-300' 
                      : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700'
                  }`}>
                    <th className="p-3 text-left">Username</th>
                    <th className="p-3 text-left">Email</th>
                    <th className="p-3 text-left">Role</th>
                    <th className="p-3 text-left">Departments</th>
                    <th className="p-3 text-left">Change Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, idx) => (
                    <tr
                      key={u.id}
                      className={`transition ${
                        darkMode
                          ? idx % 2 === 0 ? 'bg-gray-800 hover:bg-gray-750' : 'bg-gray-850 hover:bg-gray-750'
                          : idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <td className={`p-3 font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{u.username}</td>
                      <td className={`p-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{u.email}</td>
                      <td className="p-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            u.role === "admin"
                              ? "bg-red-100 text-red-700"
                              : u.role === "editor"
                              ? "bg-blue-100 text-blue-700"
                              : u.role === "viewer"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className={`p-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{u.contractors}</td>
                      <td className="p-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                          className={`border px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create User */}
          <div className={`mt-8 p-6 rounded-2xl shadow-lg border ${
            darkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <h2 className={`text-2xl font-bold mb-6 flex items-center gap-2 ${
              darkMode ? 'text-white' : 'text-gray-800'
            }`}>
              ➕ Create New User
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

              {/* Username */}
              <div className="flex flex-col">
                <label className={`mb-1 text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Username</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter username"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className={`w-full border px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                  <span className={`absolute right-3 top-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    <i className="fas fa-user"></i>
                  </span>
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col">
                <label className={`mb-1 text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Email</label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="Enter email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className={`w-full border px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                  <span className={`absolute right-3 top-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    <i className="fas fa-envelope"></i>
                  </span>
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col">
                <label className={`mb-1 text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Password</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className={`w-full border px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                  <span className={`absolute right-3 top-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    <i className="fas fa-lock"></i>
                  </span>
                </div>
              </div>

              {/* Role */}
              <div className="flex flex-col">
                <label className={`mb-1 text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className={`w-full border px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Button */}
              <div className="flex items-end">
                <button
                  onClick={handleCreateUser}
                  className={`w-full px-6 py-3 rounded-lg font-semibold shadow-md hover:scale-105 hover:shadow-lg transition transform ${
                    darkMode 
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600' 
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                  }`}
                >
                  🚀 Create User
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <PermissionsManager token={token} darkMode={darkMode} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;