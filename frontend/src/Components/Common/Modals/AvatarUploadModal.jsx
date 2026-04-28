import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import userService from '@/api/userService'
import useAuthStore from '@/store/authStore'

export default function AvatarUploadModal({ open, onClose, avatarUrl, displayName }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setSelectedFile(null)
      setPreviewUrl(null)
      setUploading(false)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleSelectFile = (file) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setSelectedFile(file)
    setPreviewUrl(url)
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0]
    handleSelectFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please choose an image to upload')
      return
    }

    setUploading(true)
    try {
      const response = await userService.uploadAvatar(selectedFile)
      const uploadedAvatar = response?.data ?? response
      const currentUser = useAuthStore.getState().user

      if (currentUser) {
        useAuthStore.setState({
          user: {
            ...currentUser,
            avatar: uploadedAvatar,
          },
        })
      }

      toast.success('Avatar updated')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err?.response?.data?.message || 'Avatar upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Change profile picture</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-28 w-28 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              {previewUrl ? (
                <img src={previewUrl} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              )}
            </div>
          </div>

          <div className="w-full">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              Upload from Device
            </button>
          </div>

          <div className="mt-2 flex w-full gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              {uploading ? 'Uploading…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
