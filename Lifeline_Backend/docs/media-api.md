# Media API Documentation

**Project**: Lifeline Emergency Monitoring System  
**Feature**: Media File Storage (Pictures, Videos, Voice Recordings)  
**Storage Backend**: Google Drive (via OAuth2)

---

## 1. Overview

The Media API allows users to upload, retrieve, and manage media files (pictures, videos, and voice recordings) that are stored in Google Drive. Files are organized by user and media type, with access control based on emergency contact relationships.

### Key Features

- **File Upload**: Upload pictures, videos, and voice recordings
- **Access Control**: Files are accessible to the owner and their emergency/dependent contacts
- **Google Drive Storage**: Files are stored in the app owner's Google Drive using OAuth2
- **File Organization**: Automatic folder structure per user and media type

---

## 2. Storage Architecture

```
Google Drive (App Owner's Account)
└── Lifeline Media (Root Folder - GOOGLE_DRIVE_FOLDER_ID)
    ├── {user_id_1}/
    │   ├── pictures/
    │   ├── videos/
    │   └── recordings/
    ├── {user_id_2}/
    │   ├── pictures/
    │   ├── videos/
    │   └── recordings/
    └── ...
```

### Authentication Flow

The backend uses OAuth2 with a refresh token from the app owner's Google account. This means:

1. All user files are stored in a single Google Drive account (the app owner's)
2. The backend manages folder organization per user
3. Access control is handled at the application level, not Google Drive level

---

## 3. Media Types & Constraints

| Media Type       | Allowed MIME Types                                                        | Max Size |
|------------------|---------------------------------------------------------------------------|----------|
| `picture`        | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/heic`, `image/heif` | 10 MB    |
| `video`          | `video/mp4`, `video/quicktime`, `video/x-msvideo`, `video/webm`, `video/3gpp`    | 50 MB    |
| `voice_recording`| `audio/mpeg`, `audio/mp4`, `audio/wav`, `audio/ogg`, `audio/webm`, `audio/aac`, `audio/m4a`, `audio/x-m4a` | 50 MB    |

---

## 4. API Endpoints

### 4.1 Upload File

**POST** `/api/media/upload`

Upload a media file to Google Drive.

#### Request

- **Content-Type**: `multipart/form-data`
- **Authentication**: Required (session cookie)

| Field        | Type   | Required | Description                                      |
|--------------|--------|----------|--------------------------------------------------|
| `file`       | File   | Yes      | The file to upload                               |
| `media_type` | String | Yes      | One of: `picture`, `video`, `voice_recording`    |
| `description`| String | No       | Optional description for the file                |

#### Example (cURL)

```bash
curl --location 'http://localhost:3000/api/media/upload' \
  --header 'Cookie: better-auth.session_token=YOUR_SESSION_TOKEN' \
  --form 'file=@"/path/to/photo.jpg"' \
  --form 'media_type="picture"' \
  --form 'description="Emergency photo"'
```

#### Example (JavaScript/Fetch)

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('media_type', 'picture');
formData.append('description', 'Emergency photo');

const response = await fetch('/api/media/upload', {
  method: 'POST',
  body: formData,
  credentials: 'include', // Include session cookie
});

const result = await response.json();
```

#### Example (React Native/Expo)

```javascript
import * as FileSystem from 'expo-file-system';

const uploadFile = async (fileUri, mediaType, description) => {
  const formData = new FormData();
  
  formData.append('file', {
    uri: fileUri,
    type: 'image/jpeg', // or appropriate MIME type
    name: 'photo.jpg',
  });
  formData.append('media_type', mediaType);
  formData.append('description', description);

  const response = await fetch('https://your-api.com/api/media/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'Cookie': `better-auth.session_token=${sessionToken}`,
    },
  });

  return response.json();
};
```

#### Response (201 Created)

```json
{
  "success": true,
  "file": {
    "id": 1,
    "drive_file_id": "1abc123def456",
    "file_name": "1706123456789_photo.jpg",
    "original_name": "photo.jpg",
    "mime_type": "image/jpeg",
    "media_type": "picture",
    "file_size": 245678,
    "web_view_link": "https://drive.google.com/file/d/1abc123def456/view",
    "web_content_link": "https://drive.google.com/uc?id=1abc123def456&export=download",
    "description": "Emergency photo",
    "createdAt": "2024-01-25T10:30:00.000Z"
  }
}
```

#### Error Responses

| Status | Error                          | Description                           |
|--------|--------------------------------|---------------------------------------|
| 400    | `No file provided`             | Missing file in form data             |
| 400    | `Invalid media_type`           | media_type not picture/video/voice_recording |
| 400    | `Invalid file type for {type}` | MIME type not allowed for media type  |
| 400    | `File size exceeds limit`      | File larger than allowed size         |
| 401    | `Unauthorized`                 | No valid session                      |
| 500    | `Failed to upload file`        | Google Drive upload error             |

---

### 4.2 List All Accessible Files

**GET** `/api/media/files`

Get all files accessible to the current user (own files + connected users' files).

#### Query Parameters

| Parameter    | Type   | Required | Description                                |
|--------------|--------|----------|--------------------------------------------|
| `media_type` | String | No       | Filter by: `picture`, `video`, `voice_recording` |
| `user_id`    | String | No       | Filter by specific user (must have access) |

#### Example

```bash
# Get all accessible files
curl 'http://localhost:3000/api/media/files' \
  --header 'Cookie: better-auth.session_token=YOUR_SESSION_TOKEN'

# Get only pictures
curl 'http://localhost:3000/api/media/files?media_type=picture' \
  --header 'Cookie: better-auth.session_token=YOUR_SESSION_TOKEN'

# Get files from a specific user
curl 'http://localhost:3000/api/media/files?user_id=user123' \
  --header 'Cookie: better-auth.session_token=YOUR_SESSION_TOKEN'
```

#### Response (200 OK)

```json
{
  "files": [
    {
      "id": 1,
      "user_id": "user123",
      "drive_file_id": "1abc123def456",
      "file_name": "1706123456789_photo.jpg",
      "original_name": "photo.jpg",
      "mime_type": "image/jpeg",
      "media_type": "picture",
      "file_size": 245678,
      "web_view_link": "https://drive.google.com/file/d/1abc123def456/view",
      "web_content_link": "https://drive.google.com/uc?id=1abc123def456&export=download",
      "description": "Emergency photo",
      "createdAt": "2024-01-25T10:30:00.000Z",
      "updatedAt": "2024-01-25T10:30:00.000Z",
      "owner_name": "John Doe",
      "owner_email": "john@example.com",
      "owner_phone": "+1234567890"
    }
  ]
}
```

---

### 4.3 List Own Files Only

**GET** `/api/media/files/own`

Get only the current user's own files.

#### Query Parameters

| Parameter    | Type   | Required | Description                                |
|--------------|--------|----------|--------------------------------------------|
| `media_type` | String | No       | Filter by: `picture`, `video`, `voice_recording` |

#### Response (200 OK)

```json
{
  "files": [
    {
      "id": 1,
      "user_id": "user123",
      "drive_file_id": "1abc123def456",
      "file_name": "1706123456789_photo.jpg",
      "original_name": "photo.jpg",
      "mime_type": "image/jpeg",
      "media_type": "picture",
      "file_size": 245678,
      "web_view_link": "https://drive.google.com/file/d/1abc123def456/view",
      "web_content_link": "https://drive.google.com/uc?id=1abc123def456&export=download",
      "description": "Emergency photo",
      "createdAt": "2024-01-25T10:30:00.000Z",
      "updatedAt": "2024-01-25T10:30:00.000Z"
    }
  ]
}
```

---

### 4.4 Get Single File

**GET** `/api/media/files/:id`

Get metadata for a specific file by database ID.

#### Example

```bash
curl 'http://localhost:3000/api/media/files/1' \
  --header 'Cookie: better-auth.session_token=YOUR_SESSION_TOKEN'
```

#### Response (200 OK)

```json
{
  "file": {
    "id": 1,
    "user_id": "user123",
    "drive_file_id": "1abc123def456",
    "file_name": "1706123456789_photo.jpg",
    "original_name": "photo.jpg",
    "mime_type": "image/jpeg",
    "media_type": "picture",
    "file_size": 245678,
    "web_view_link": "https://drive.google.com/file/d/1abc123def456/view",
    "web_content_link": "https://drive.google.com/uc?id=1abc123def456&export=download",
    "description": "Emergency photo",
    "createdAt": "2024-01-25T10:30:00.000Z",
    "updatedAt": "2024-01-25T10:30:00.000Z",
    "owner_name": "John Doe",
    "owner_email": "john@example.com",
    "owner_phone": "+1234567890"
  }
}
```

#### Error Responses

| Status | Error                      | Description                    |
|--------|----------------------------|--------------------------------|
| 400    | `Invalid file ID`          | ID is not a valid number       |
| 403    | `Access denied to this file` | User doesn't have access     |
| 404    | `File not found`           | File doesn't exist             |

---

### 4.5 Download File

**GET** `/api/media/files/:id/download`

Download/stream a file's content.

#### Example

```bash
curl 'http://localhost:3000/api/media/files/1/download' \
  --header 'Cookie: better-auth.session_token=YOUR_SESSION_TOKEN' \
  --output downloaded_photo.jpg
```

#### Example (JavaScript - Display Image)

```javascript
// For images, you can use the URL directly
const imageUrl = `/api/media/files/${fileId}/download`;

// In React/HTML
<img src={imageUrl} alt="Media file" />

// For programmatic download
const response = await fetch(`/api/media/files/${fileId}/download`, {
  credentials: 'include',
});
const blob = await response.blob();
const url = URL.createObjectURL(blob);
```

#### Example (React Native)

```javascript
import * as FileSystem from 'expo-file-system';

const downloadFile = async (fileId, fileName) => {
  const downloadUrl = `https://your-api.com/api/media/files/${fileId}/download`;
  const fileUri = FileSystem.documentDirectory + fileName;
  
  const downloadResult = await FileSystem.downloadAsync(
    downloadUrl,
    fileUri,
    {
      headers: {
        'Cookie': `better-auth.session_token=${sessionToken}`,
      },
    }
  );
  
  return downloadResult.uri;
};
```

#### Response

- **Content-Type**: Original file MIME type
- **Content-Disposition**: `attachment; filename="original_name.ext"`
- **Body**: File binary content

---

### 4.6 Delete File

**DELETE** `/api/media/files/:id`

Delete a file (owner only).

#### Example

```bash
curl -X DELETE 'http://localhost:3000/api/media/files/1' \
  --header 'Cookie: better-auth.session_token=YOUR_SESSION_TOKEN'
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

#### Error Responses

| Status | Error                              | Description              |
|--------|------------------------------------|--------------------------|
| 403    | `Only the file owner can delete`   | Not the file owner       |
| 404    | `File not found`                   | File doesn't exist       |

---

### 4.7 Update File Metadata

**PUT** `/api/media/files/:id`

Update file description (owner only).

#### Request Body

```json
{
  "description": "Updated description"
}
```

#### Example

```bash
curl -X PUT 'http://localhost:3000/api/media/files/1' \
  --header 'Cookie: better-auth.session_token=YOUR_SESSION_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{"description": "Updated emergency photo description"}'
```

#### Response (200 OK)

```json
{
  "success": true,
  "file": {
    "id": 1,
    "description": "Updated emergency photo description",
    "updatedAt": "2024-01-25T11:00:00.000Z"
  }
}
```

---

### 4.8 Get Connected Users

**GET** `/api/media/connected-users`

Get list of users whose files the current user can access.

#### Example

```bash
curl 'http://localhost:3000/api/media/connected-users' \
  --header 'Cookie: better-auth.session_token=YOUR_SESSION_TOKEN'
```

#### Response (200 OK)

```json
{
  "users": [
    {
      "id": "user456",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone_no": "+0987654321",
      "role": "dependent",
      "image": "https://example.com/avatar.jpg"
    }
  ]
}
```

---

### 4.9 Get File Statistics

**GET** `/api/media/stats`

Get file statistics for the current user.

#### Example

```bash
curl 'http://localhost:3000/api/media/stats' \
  --header 'Cookie: better-auth.session_token=YOUR_SESSION_TOKEN'
```

#### Response (200 OK)

```json
{
  "stats": {
    "picture": {
      "count": 15,
      "total_size": 12345678
    },
    "video": {
      "count": 3,
      "total_size": 98765432
    },
    "voice_recording": {
      "count": 7,
      "total_size": 5432100
    }
  },
  "total": {
    "count": 25,
    "size": 116543210
  }
}
```

---

## 5. Access Control

### Who Can Access Which Files?

A user can access another user's files if ANY of these conditions are true:

1. **They are the file owner**
2. **They are in the file owner's `emergency_contacts`**
3. **They are in the file owner's `dependent_contacts`**
4. **The file owner is in their `emergency_contacts`**
5. **The file owner is in their `dependent_contacts`**

### Permissions Matrix

| Action         | Owner | Emergency Contact | Dependent Contact | Others |
|----------------|-------|-------------------|-------------------|--------|
| View/Download  | ✅    | ✅                | ✅                | ❌     |
| Upload (own)   | ✅    | ✅                | ✅                | ✅     |
| Delete         | ✅    | ❌                | ❌                | ❌     |
| Update         | ✅    | ❌                | ❌                | ❌     |

---

## 6. Frontend Integration Examples

### 6.1 React/Next.js File Upload Component

```typescript
import { useState } from 'react';

type MediaType = 'picture' | 'video' | 'voice_recording';

interface UploadResult {
  success: boolean;
  file?: {
    id: number;
    original_name: string;
    web_view_link: string;
  };
  error?: string;
}

export function FileUploader() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (
    file: File,
    mediaType: MediaType,
    description?: string
  ): Promise<UploadResult> => {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', mediaType);
    if (description) {
      formData.append('description', description);
    }

    try {
      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Determine media type from file
    let mediaType: MediaType;
    if (file.type.startsWith('image/')) {
      mediaType = 'picture';
    } else if (file.type.startsWith('video/')) {
      mediaType = 'video';
    } else if (file.type.startsWith('audio/')) {
      mediaType = 'voice_recording';
    } else {
      setError('Unsupported file type');
      return;
    }

    const result = await uploadFile(file, mediaType);
    if (result.success) {
      console.log('Uploaded:', result.file);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={handleFileSelect}
        accept="image/*,video/*,audio/*"
        disabled={uploading}
      />
      {uploading && <p>Uploading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

### 6.2 React Native/Expo Upload with Camera

```typescript
import * as ImagePicker from 'expo-image-picker';

const uploadFromCamera = async (sessionToken: string) => {
  // Request camera permission
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    alert('Camera permission required');
    return;
  }

  // Take photo
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: 0.8,
  });

  if (result.canceled) return;

  const asset = result.assets[0];
  
  // Prepare form data
  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    type: asset.mimeType || 'image/jpeg',
    name: asset.fileName || 'photo.jpg',
  } as any);
  formData.append('media_type', asset.type === 'video' ? 'video' : 'picture');
  formData.append('description', 'Captured from camera');

  // Upload
  const response = await fetch('https://your-api.com/api/media/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'Cookie': `better-auth.session_token=${sessionToken}`,
    },
  });

  return response.json();
};
```

### 6.3 Displaying Media Gallery

```typescript
interface MediaFile {
  id: number;
  original_name: string;
  mime_type: string;
  media_type: 'picture' | 'video' | 'voice_recording';
  owner_name: string;
}

export function MediaGallery() {
  const [files, setFiles] = useState<MediaFile[]>([]);

  useEffect(() => {
    fetch('/api/media/files', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setFiles(data.files));
  }, []);

  return (
    <div className="gallery">
      {files.map(file => (
        <div key={file.id} className="media-item">
          {file.media_type === 'picture' && (
            <img 
              src={`/api/media/files/${file.id}/download`} 
              alt={file.original_name}
            />
          )}
          {file.media_type === 'video' && (
            <video 
              src={`/api/media/files/${file.id}/download`} 
              controls
            />
          )}
          {file.media_type === 'voice_recording' && (
            <audio 
              src={`/api/media/files/${file.id}/download`} 
              controls
            />
          )}
          <p>Uploaded by: {file.owner_name}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## 7. Environment Setup

### Required Environment Variables

```bash
# Google OAuth (same as user authentication)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Google Drive Storage
GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
```

### Getting the Refresh Token

1. Add `http://localhost:3000/callback` to your Google Cloud OAuth redirect URIs
2. Run the token generation script:
   ```bash
   bun run scripts/get-drive-token.ts
   ```
3. Open the URL in your browser and authorize the app
4. Copy the refresh token from the terminal output

### Getting the Folder ID

1. Create a folder in Google Drive for Lifeline media storage
2. Open the folder in Google Drive
3. Copy the ID from the URL: `https://drive.google.com/drive/folders/{FOLDER_ID}`

---

## 8. Database Schema

The `media_files` table stores metadata for uploaded files:

```sql
CREATE TABLE media_files (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES "user"(id),
    drive_file_id VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('picture', 'video', 'voice_recording')),
    file_size BIGINT NOT NULL,
    web_view_link TEXT,
    web_content_link TEXT,
    description TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_files_user_id ON media_files(user_id);
CREATE INDEX idx_media_files_media_type ON media_files(media_type);
```

---

## 9. Error Handling

### Common Error Codes

| HTTP Status | Meaning                    | Action                              |
|-------------|----------------------------|-------------------------------------|
| 400         | Bad Request                | Check request format/parameters     |
| 401         | Unauthorized               | Re-authenticate user                |
| 403         | Forbidden                  | User lacks permission               |
| 404         | Not Found                  | File doesn't exist                  |
| 500         | Server Error               | Retry or contact support            |

### Error Response Format

```json
{
  "error": "Human-readable error message"
}
```

---

## 10. Best Practices

### For Mobile Apps

1. **Compress images** before upload to reduce bandwidth
2. **Use background upload** for large files
3. **Cache downloaded files** locally
4. **Handle offline scenarios** gracefully

### For Web Apps

1. **Show upload progress** for better UX
2. **Preview files** before upload
3. **Lazy load** media in galleries
4. **Use appropriate image sizes** for thumbnails vs full view

### Security Considerations

1. **Never expose** `drive_file_id` to unauthorized users
2. **Always validate** media_type on upload
3. **Check file access** before every download
4. **Use HTTPS** in production
