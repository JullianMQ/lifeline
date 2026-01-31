import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';

// File type definitions
export type MediaType = 'picture' | 'video' | 'voice_recording';

export interface UploadResult {
    fileId: string;
    fileName: string;
    mimeType: string;
    webViewLink: string;
    webContentLink: string;
    size: number;
}

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    webViewLink: string;
    webContentLink: string;
    createdTime: string;
    size: string;
}

// MIME type mappings
const ALLOWED_MIME_TYPES: Record<MediaType, string[]> = {
    picture: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'],
    video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/3gpp'],
    voice_recording: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/m4a', 'audio/x-m4a']
};

// File size limits in bytes
const FILE_SIZE_LIMITS: Record<MediaType, number> = {
    picture: 10 * 1024 * 1024,      // 10MB
    video: 50 * 1024 * 1024,         // 50MB
    voice_recording: 50 * 1024 * 1024 // 50MB
};

// Folder name mappings
const FOLDER_NAMES: Record<MediaType, string> = {
    picture: 'pictures',
    video: 'videos',
    voice_recording: 'recordings'
};

class GoogleDriveService {
    private drive: drive_v3.Drive;
    private rootFolderId: string;
    private folderCache: Map<string, string> = new Map();
    private oauth2Client: OAuth2Client;

    constructor() {
        // OAuth2 credentials (using your personal Google account)
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
        const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        if (!clientId || !clientSecret) {
            throw new Error('Missing Google OAuth credentials. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
        }

        if (!refreshToken) {
            throw new Error('Missing GOOGLE_DRIVE_REFRESH_TOKEN. Run the token generation script to obtain a refresh token for your Google account.');
        }

        if (!rootFolderId) {
            throw new Error('Missing GOOGLE_DRIVE_FOLDER_ID. Create a folder in Google Drive and set its ID as this environment variable.');
        }

        // Create OAuth2 client with refresh token
        this.oauth2Client = new OAuth2Client(clientId, clientSecret);
        this.oauth2Client.setCredentials({
            refresh_token: refreshToken,
        });

        this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
        this.rootFolderId = rootFolderId;
    }

    /**
     * Validates the file type against allowed MIME types
     */
    validateMimeType(mimeType: string, mediaType: MediaType): boolean {
        return ALLOWED_MIME_TYPES[mediaType].includes(mimeType);
    }

    /**
     * Validates the file size against limits
     */
    validateFileSize(size: number, mediaType: MediaType): boolean {
        return size <= FILE_SIZE_LIMITS[mediaType];
    }

    /**
     * Gets the file size limit for a media type
     */
    getFileSizeLimit(mediaType: MediaType): number {
        return FILE_SIZE_LIMITS[mediaType];
    }

    /**
     * Gets or creates a folder for the user
     */
    private async getOrCreateUserFolder(userId: string): Promise<string> {
        const cacheKey = `user_${userId}`;
        
        if (this.folderCache.has(cacheKey)) {
            return this.folderCache.get(cacheKey)!;
        }

        // Search for existing folder
        const response = await this.drive.files.list({
            q: `name='${userId}' and '${this.rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
        });

        if (response.data.files && response.data.files.length > 0) {
            const folderId = response.data.files[0].id!;
            this.folderCache.set(cacheKey, folderId);
            return folderId;
        }

        // Create new folder
        const folderMetadata = {
            name: userId,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [this.rootFolderId],
        };

        const folder = await this.drive.files.create({
            requestBody: folderMetadata,
            fields: 'id',
        });

        const folderId = folder.data.id!;
        this.folderCache.set(cacheKey, folderId);
        return folderId;
    }

    /**
     * Gets or creates a subfolder for a specific media type
     */
    private async getOrCreateMediaFolder(userId: string, mediaType: MediaType): Promise<string> {
        const userFolderId = await this.getOrCreateUserFolder(userId);
        const folderName = FOLDER_NAMES[mediaType];
        const cacheKey = `${userId}_${mediaType}`;

        if (this.folderCache.has(cacheKey)) {
            return this.folderCache.get(cacheKey)!;
        }

        // Search for existing folder
        const response = await this.drive.files.list({
            q: `name='${folderName}' and '${userFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
        });

        if (response.data.files && response.data.files.length > 0) {
            const folderId = response.data.files[0].id!;
            this.folderCache.set(cacheKey, folderId);
            return folderId;
        }

        // Create new folder
        const folderMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [userFolderId],
        };

        const folder = await this.drive.files.create({
            requestBody: folderMetadata,
            fields: 'id',
        });

        const folderId = folder.data.id!;
        this.folderCache.set(cacheKey, folderId);
        return folderId;
    }

    /**
     * Uploads a file to Google Drive
     */
    async uploadFile(
        userId: string,
        mediaType: MediaType,
        fileBuffer: Buffer,
        fileName: string,
        mimeType: string
    ): Promise<UploadResult> {
        // Validate MIME type
        if (!this.validateMimeType(mimeType, mediaType)) {
            throw new Error(`Invalid file type. Allowed types for ${mediaType}: ${ALLOWED_MIME_TYPES[mediaType].join(', ')}`);
        }

        // Validate file size
        if (!this.validateFileSize(fileBuffer.length, mediaType)) {
            const limitMB = FILE_SIZE_LIMITS[mediaType] / (1024 * 1024);
            throw new Error(`File size exceeds the ${limitMB}MB limit for ${mediaType}`);
        }

        const folderId = await this.getOrCreateMediaFolder(userId, mediaType);

        // Generate unique filename with timestamp
        const timestamp = Date.now();
        const uniqueFileName = `${timestamp}_${fileName}`;

        const fileMetadata = {
            name: uniqueFileName,
            parents: [folderId],
        };

        const media = {
            mimeType: mimeType,
            body: Readable.from(fileBuffer),
        };

        const response = await this.drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, mimeType, webViewLink, webContentLink, size',
        });

        const file = response.data;

        return {
            fileId: file.id!,
            fileName: file.name!,
            mimeType: file.mimeType!,
            webViewLink: file.webViewLink || '',
            webContentLink: file.webContentLink || '',
            size: parseInt(file.size || '0', 10),
        };
    }

    /**
     * Gets file metadata by ID
     */
    async getFile(fileId: string): Promise<DriveFile | null> {
        try {
            const response = await this.drive.files.get({
                fileId: fileId,
                fields: 'id, name, mimeType, webViewLink, webContentLink, createdTime, size',
            });

            const file = response.data;
            return {
                id: file.id!,
                name: file.name!,
                mimeType: file.mimeType!,
                webViewLink: file.webViewLink || '',
                webContentLink: file.webContentLink || '',
                createdTime: file.createdTime || '',
                size: file.size || '0',
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Gets file content as a stream
     */
    async getFileContent(fileId: string): Promise<Readable | null> {
        try {
            const response = await this.drive.files.get({
                fileId: fileId,
                alt: 'media',
            }, {
                responseType: 'stream',
            });

            return response.data as Readable;
        } catch (error) {
            return null;
        }
    }

    /**
     * Deletes a file from Google Drive
     */
    async deleteFile(fileId: string): Promise<boolean> {
        try {
            await this.drive.files.delete({
                fileId: fileId,
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Lists files in a user's media folder
     */
    async listUserFiles(userId: string, mediaType?: MediaType): Promise<DriveFile[]> {
        try {
            let folderId: string;
            
            if (mediaType) {
                folderId = await this.getOrCreateMediaFolder(userId, mediaType);
            } else {
                folderId = await this.getOrCreateUserFolder(userId);
            }

            const query = mediaType 
                ? `'${folderId}' in parents and trashed=false`
                : `'${folderId}' in parents and trashed=false`;

            const response = await this.drive.files.list({
                q: query,
                fields: 'files(id, name, mimeType, webViewLink, webContentLink, createdTime, size)',
                orderBy: 'createdTime desc',
            });

            return (response.data.files || []).map(file => ({
                id: file.id!,
                name: file.name!,
                mimeType: file.mimeType!,
                webViewLink: file.webViewLink || '',
                webContentLink: file.webContentLink || '',
                createdTime: file.createdTime || '',
                size: file.size || '0',
            }));
        } catch (error) {
            return [];
        }
    }
}

// Singleton instance
let driveService: GoogleDriveService | null = null;

export function getGoogleDriveService(): GoogleDriveService {
    if (!driveService) {
        driveService = new GoogleDriveService();
    }
    return driveService;
}

export { GoogleDriveService, ALLOWED_MIME_TYPES, FILE_SIZE_LIMITS };
