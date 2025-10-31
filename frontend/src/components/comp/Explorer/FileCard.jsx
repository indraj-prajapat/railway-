import { Card } from '../../ui/card'
import { 
  Download, 
  Trash2, 
  MoreVertical, 
  Info, 
  File,
  Eye,
  FileText,
  FileSpreadsheet,
  File as FileGeneric
} from 'lucide-react'

import { Button } from '../../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { useState } from 'react'

const getFileIcon = (filename, className = "h-6 w-6") => {
  if (!filename) return <FileGeneric className={`${className} text-gray-500`} />

  const ext = filename.split('.').pop().toLowerCase()

  switch (ext) {
    case "pdf":
      return <FileText className={`${className} text-red-500`} />   // PDF
    case "doc":
    case "docx":
      return <FileText className={`${className} text-blue-600`} />  // Word
    case "xls":
    case "xlsx":
    case "csv":
      return <FileSpreadsheet className={`${className} text-green-600`} /> // Excel/CSV
    case "ppt":
    case "pptx":
      return <File className={`${className} text-orange-500`} /> // PowerPoint
    case "txt":
      return <FileText className={`${className} text-gray-700`} />  // Text
    default:
      return <FileGeneric className={`${className} text-gray-500`} /> // Unknown
  }
}

export default function FileCard({ 
  file, 
  onpreview, 
  onDelete, 
  onDownload, 
  fetchVersions, 
  closeVersions, 
  expandedFileId,
  darkMode 
}) {
  const [openInfo, setOpenInfo] = useState(false)

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Card
      className={`p-3 hover:shadow-lg transition-shadow border 
        ${darkMode 
          ? 'bg-[#1f2937] border-gray-700 hover:shadow-gray-700/40' 
          : 'bg-white border-gray-200 hover:shadow-gray-300/60'
        }`}
    >
      {/* Row layout */}
      <div className="flex items-center justify-between gap-3">
        {/* File icon + filename */}
        <div className="flex items-center gap-2 min-w-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex-shrink-0 cursor-pointer">
                  {getFileIcon(file.original_filename, "h-6 w-6 flex-shrink-0 cursor-pointer")}
                </div>
              </TooltipTrigger>
              <TooltipContent className={`${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'} text-xs`}>
                <p>Size: {formatFileSize(file.file_size)}</p>
                <p>Type: {file.file_type}</p>
                <p>Date: {new Date(file.upload_date).toLocaleDateString()}</p>
                {file.contractor && <p>Branch: {file.contractor}</p>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* File name */}
          <div
            className={`truncate text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}
            title={file.original_filename}
          >
            {file.original_filename}
          </div>
        </div>

        {/* 3-dot menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className={`${darkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className={`${darkMode ? 'bg-gray-800 text-gray-100 border-gray-700' : ''}`}>
            <DropdownMenuItem
              onClick={() => expandedFileId === file.id ? closeVersions() : fetchVersions(file.id)}
              className={`${darkMode ? 'hover:bg-gray-700' : ''}`}
            >
              Version V{file.version}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownload} className={`${darkMode ? 'hover:bg-gray-700' : ''}`}>
              <Download className="h-4 w-4 mr-2" /> Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className={`${darkMode ? 'hover:bg-gray-700' : ''}`}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onpreview} className={`${darkMode ? 'hover:bg-gray-700' : ''}`}>
              <Eye className="h-4 w-4 mr-2" /> Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpenInfo(true)} className={`${darkMode ? 'hover:bg-gray-700' : ''}`}>
              <Info className="h-4 w-4 mr-2" /> Info
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Info Dialog */}
      <Dialog open={openInfo} onOpenChange={setOpenInfo}>
        <DialogContent className={`${darkMode ? 'bg-gray-900 text-gray-100 border-gray-700' : ''}`}>
          <DialogHeader>
            <DialogTitle className={`${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>File Information</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-1">
            <p><strong>Name:</strong> {file.original_filename}</p>
            <p><strong>Size:</strong> {formatFileSize(file.file_size)}</p>
            <p><strong>Type:</strong> {file.file_type}</p>
            <p><strong>Modified:</strong> {new Date(file.upload_date).toLocaleString()}</p>
            {file.contractor && <p><strong>Branch:</strong> {file.contractor}</p>}
            {file.version && <p><strong>Version:</strong> v{file.version}</p>}
            {file.mime_type && <p><strong>MIME:</strong> {file.mime_type}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
