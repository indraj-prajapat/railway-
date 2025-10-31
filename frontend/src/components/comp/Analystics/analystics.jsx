import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Upload,
  Files,
  HardDrive,
  FileText,
  X,
  TrendingUp,
  Activity,
  FolderOpen,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

export default function DashboardCards({ token, darkMode }) {
  const [analytics, setAnalytics] = useState(null);
  const [uploadStatus, setUploadStatus] = useState([]);
  const [storageDetails, setStorageDetails] = useState(null);
  const [showStorageDetails, setShowStorageDetails] = useState(false);
  const [showUploadStatus, setShowUploadStatus] = useState(false);
  const API_BASE = "http://localhost:5000/api";

  useEffect(() => {
    loadAnalytics();
    loadUploadStatus();
  }, []);

  const loadAnalytics = async () => {
    try {
      const response = await fetch(`${API_BASE}/documents/analytics`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error("Error loading analytics:", error);
    }
  };

  const loadUploadStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/documents/upload-status`);
      const data = await response.json();
      setUploadStatus(data.upload_status || []);
    } catch (error) {
      console.error("Error loading upload status:", error);
    }
  };

  const loadStorageDetails = async () => {
    try {
      const response = await fetch(`${API_BASE}/documents/storage-details`);
      const data = await response.json();
      setStorageDetails(data);
    } catch (error) {
      console.error("Error loading storage details:", error);
    }
  };

  const completedUploads = uploadStatus.filter((s) => s.status === "completed").length;
  const failedUploads = uploadStatus.filter((s) => s.status === "failed").length;
  const processingUploads = uploadStatus.filter((s) => s.status === "processing").length;

  return (
    <>
      <div className="space-y-6">
        {/* Hero Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className={`group hover:shadow-xl transition-all duration-300 border-l-4 border-l-blue-500 ${
            darkMode ? "bg-gray-800 hover:bg-gray-750 text-white" : "bg-white hover:bg-gray-50"
          }`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Files</CardTitle>
              <div className={`p-2 rounded-lg ${darkMode ? "bg-blue-500/20" : "bg-blue-100"}`}>
                <Files className="h-5 w-5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics?.total_files || 0}</div>
              <div className="flex items-center text-xs mt-2">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-green-500">Documents stored</span>
              </div>
            </CardContent>
          </Card>

          <Card className={`group hover:shadow-xl transition-all duration-300 border-l-4 border-l-purple-500 ${
            darkMode ? "bg-gray-800 hover:bg-gray-750 text-white" : "bg-white hover:bg-gray-50"
          }`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <div className={`p-2 rounded-lg ${darkMode ? "bg-purple-500/20" : "bg-purple-100"}`}>
                <HardDrive className="h-5 w-5 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatFileSize(analytics?.total_storage || 0)}
              </div>
              <button
                onClick={() => {
                  setShowStorageDetails(true);
                  loadStorageDetails();
                }}
                className="text-xs text-purple-500 hover:underline mt-2"
              >
                View breakdown →
              </button>
            </CardContent>
          </Card>

          <Card className={`group hover:shadow-xl transition-all duration-300 border-l-4 border-l-amber-500 ${
            darkMode ? "bg-gray-800 hover:bg-gray-750 text-white" : "bg-white hover:bg-gray-50"
          }`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">File Types</CardTitle>
              <div className={`p-2 rounded-lg ${darkMode ? "bg-amber-500/20" : "bg-amber-100"}`}>
                <FileText className="h-5 w-5 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {analytics?.file_types?.length || 0}
              </div>
              <div className={`text-xs mt-2 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                Different formats
              </div>
            </CardContent>
          </Card>

          <Card className={`group hover:shadow-xl transition-all duration-300 border-l-4 border-l-green-500 ${
            darkMode ? "bg-gray-800 hover:bg-gray-750 text-white" : "bg-white hover:bg-gray-50"
          }`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <div className={`p-2 rounded-lg ${darkMode ? "bg-green-500/20" : "bg-green-100"}`}>
                <Upload className="h-5 w-5 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{completedUploads}</div>
              <button
                onClick={() => {
                  setShowUploadStatus(true);
                  loadUploadStatus();
                }}
                className="text-xs text-green-500 hover:underline mt-2"
              >
                View all uploads →
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Upload Status Overview */}
        {uploadStatus.length > 0 && (
          <Card className={darkMode ? "bg-gray-800 text-white" : "bg-white"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Upload Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg ${darkMode ? "bg-green-500/10" : "bg-green-50"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        Completed
                      </div>
                      <div className="text-2xl font-bold text-green-500">
                        {completedUploads}
                      </div>
                    </div>
                    <div className={`p-3 rounded-full ${darkMode ? "bg-green-500/20" : "bg-green-100"}`}>
                      <Upload className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-lg ${darkMode ? "bg-yellow-500/10" : "bg-yellow-50"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        Processing
                      </div>
                      <div className="text-2xl font-bold text-yellow-500">
                        {processingUploads}
                      </div>
                    </div>
                    <div className={`p-3 rounded-full ${darkMode ? "bg-yellow-500/20" : "bg-yellow-100"}`}>
                      <Clock className="h-6 w-6 text-yellow-500" />
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-lg ${darkMode ? "bg-red-500/10" : "bg-red-50"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        Failed
                      </div>
                      <div className="text-2xl font-bold text-red-500">
                        {failedUploads}
                      </div>
                    </div>
                    <div className={`p-3 rounded-full ${darkMode ? "bg-red-500/20" : "bg-red-100"}`}>
                      <X className="h-6 w-6 text-red-500" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        {uploadStatus.length > 0 && (
          <Card className={darkMode ? "bg-gray-800 text-white" : "bg-white"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {uploadStatus.slice(0, 5).map((status) => (
                  <div
                    key={status.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      darkMode ? "bg-gray-700/50" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`p-2 rounded ${
                        status.status === "completed"
                          ? darkMode ? "bg-green-500/20" : "bg-green-100"
                          : status.status === "failed"
                            ? darkMode ? "bg-red-500/20" : "bg-red-100"
                            : darkMode ? "bg-yellow-500/20" : "bg-yellow-100"
                      }`}>
                        <FolderOpen className={`h-4 w-4 ${
                          status.status === "completed"
                            ? "text-green-500"
                            : status.status === "failed"
                              ? "text-red-500"
                              : "text-yellow-500"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{status.filename}</div>
                        <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                          {new Date(status.updated_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={
                        status.status === "completed"
                          ? "default"
                          : status.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {status.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Storage Details Modal */}
      {showStorageDetails && storageDetails && (
        <StorageDetailsModal
          onClose={() => setShowStorageDetails(false)}
          storageDetails={storageDetails}
          darkMode={darkMode}
        />
      )}

      {/* Upload Status Modal */}
      {showUploadStatus && (
        <UploadStatusModal
          onClose={() => setShowUploadStatus(false)}
          uploadStatus={uploadStatus}
          darkMode={darkMode}
        />
      )}
    </>
  );
}

// Storage Details Modal
const StorageDetailsModal = ({ onClose, storageDetails, darkMode }) => {
  const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
  
  return (
    <div className="fixed inset-0  bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-lg w-full max-w-6xl max-h-[90vh] overflow-auto ${
        darkMode ? "bg-gray-800" : "bg-white"
      }`}>
        <div className={`flex items-center justify-between p-6 border-b sticky top-0 z-10 ${
          darkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200"
        }`}>
          <h2 className="text-2xl font-bold">Storage Analytics</h2>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className={darkMode ? "bg-gray-700 text-white" : "bg-white"}>
              <CardHeader>
                <CardTitle>Storage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={storageDetails.storage_by_type}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ file_type, percent }) => 
                        `${file_type} ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total_size"
                      nameKey="file_type"
                    >
                      {storageDetails.storage_by_type.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatFileSize(value)}
                      contentStyle={{
                        backgroundColor: darkMode ? '#374151' : '#fff',
                        border: darkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className={darkMode ? "bg-gray-700 text-white" : "bg-white"}>
              <CardHeader>
                <CardTitle>Storage by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={storageDetails.storage_by_type}>
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#374151" : "#e5e7eb"} />
                    <XAxis 
                      dataKey="file_type" 
                      stroke={darkMode ? "#9ca3af" : "#6b7280"}
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke={darkMode ? "#9ca3af" : "#6b7280"}
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      formatter={(value) => [formatFileSize(value), "Storage"]}
                      contentStyle={{
                        backgroundColor: darkMode ? '#374151' : '#fff',
                        border: darkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="total_size" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className={`mt-6 ${darkMode ? "bg-gray-700 text-white" : "bg-white"}`}>
            <CardHeader>
              <CardTitle>Largest Files</CardTitle>
              <CardDescription>Top 10 files by size</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {storageDetails.largest_files.slice(0, 10).map((file, index) => (
                  <div
                    key={file.id}
                    className={`flex justify-between items-center p-4 rounded-lg transition-colors ${
                      darkMode ? "bg-gray-600 hover:bg-gray-550 text-white" : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        darkMode ? "bg-gray-700 text-white" : "bg-white"
                      }`}>
                        {index + 1}
                      </div>
                      <div className="truncate flex-1">
                        <div className="font-medium truncate">
                          {file.original_filename}
                        </div>
                        <div className={`text-xs ${darkMode ? "text-gray-400 " : "text-gray-500"}`}>
                          {file.file_type}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="ml-4">
                      {formatFileSize(file.file_size)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Upload Status Modal
const UploadStatusModal = ({ onClose, uploadStatus, darkMode }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className={`rounded-lg w-full max-w-4xl max-h-[90vh] overflow-auto ${
      darkMode ? "bg-gray-800 text-white" : "bg-white"
    }`}>
      <div className={`flex items-center justify-between p-6 border-b sticky top-0 z-10 ${
        darkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200"
      }`}>
        <h2 className="text-2xl font-bold">Upload History</h2>
        <Button variant="outline" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {uploadStatus.map((status) => (
            <Card key={status.id} className={`overflow-hidden ${
              darkMode ? "bg-gray-700 text-white" : "bg-white"
            }`}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded ${
                      status.status === "completed"
                        ? darkMode ? "bg-green-500/20" : "bg-green-100"
                        : status.status === "failed"
                          ? darkMode ? "bg-red-500/20" : "bg-red-100"
                          : darkMode ? "bg-yellow-500/20" : "bg-yellow-100"
                    }`}>
                      <FolderOpen className={`h-4 w-4 ${
                        status.status === "completed"
                          ? "text-green-500"
                          : status.status === "failed"
                            ? "text-red-500"
                            : "text-yellow-500"
                      }`} />
                    </div>
                    <div className="font-medium">{status.filename}</div>
                  </div>
                  <Badge
                    variant={
                      status.status === "completed"
                        ? "default"
                        : status.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {status.status}
                  </Badge>
                </div>
                <Progress value={status.progress} className="mb-2" />
                <div className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                  {status.message}
                </div>
                <div className={`text-xs mt-2 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  {new Date(status.updated_at).toLocaleString()}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};