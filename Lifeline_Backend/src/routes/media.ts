import { Hono } from "hono";
import { auth } from "../lib/auth";
import { dbPool } from "../lib/db";
import { getGoogleDriveService, MediaType, ALLOWED_MIME_TYPES, FILE_SIZE_LIMITS } from "../lib/googleDrive";
import { debugMedia } from "../lib/debug";
import { z } from "zod";
import { Readable } from 'stream';

type User = NonNullable<typeof auth.$Infer.Session.user>;

interface MediaFile {
    id: number;
    user_id: string;
    drive_file_id: string;
    file_name: string;
    original_name: string;
    mime_type: string;
    media_type: MediaType;
    file_size: number;
    web_view_link: string | null;
    web_content_link: string | null;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}

interface MediaFileWithOwner extends MediaFile {
    owner_name: string;
    owner_email: string;
    owner_phone: string | null;
}

const mediaTypeSchema = z.enum(['picture', 'video', 'voice_recording']);

const router = new Hono<{ Variables: { user: User } }>({
    strict: false,
});

// Auth middleware
router.use("*", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("user", session.user);
    return next();
});

/**
 * Check if the requesting user has access to another user's files
 * Access is granted if:
 * 1. The requesting user is the file owner
 * 2. The requesting user is in the file owner's emergency_contacts
 * 3. The requesting user is in the file owner's dependent_contacts
 * 4. The file owner is in the requesting user's emergency_contacts
 * 5. The file owner is in the requesting user's dependent_contacts
 */
async function hasAccessToUserFiles(requestingUserId: string, requestingUserPhone: string | null, fileOwnerId: string): Promise<boolean> {
    debugMedia.log("=== hasAccessToUserFiles ===");
    debugMedia.log("requestingUserId:", requestingUserId);
    debugMedia.log("requestingUserPhone:", requestingUserPhone);
    debugMedia.log("fileOwnerId:", fileOwnerId);
    
    // Owner always has access
    if (requestingUserId === fileOwnerId) {
        debugMedia.log("Access granted: same user (owner)");
        return true;
    }

    if (!requestingUserPhone) {
        debugMedia.log("Access denied: requesting user has no phone number");
        return false;
    }

    // Check if requesting user is in file owner's contacts
    const ownerContactsResult = await dbPool.query(
        `SELECT emergency_contacts, dependent_contacts FROM contacts WHERE user_id = $1`,
        [fileOwnerId]
    );

    debugMedia.log("Owner contacts query result rows:", ownerContactsResult.rows.length);
    
    if (ownerContactsResult.rows.length > 0) {
        const ownerContacts = ownerContactsResult.rows[0];
        const emergencyContacts: string[] = ownerContacts.emergency_contacts || [];
        const dependentContacts: string[] = ownerContacts.dependent_contacts || [];

        debugMedia.log("File owner's emergency_contacts:", emergencyContacts);
        debugMedia.log("File owner's dependent_contacts:", dependentContacts);

        if (emergencyContacts.includes(requestingUserPhone) || dependentContacts.includes(requestingUserPhone)) {
            debugMedia.log("Access granted: requesting user is in file owner's contacts");
            return true;
        }
    }

    // Check if file owner is in requesting user's contacts
    const fileOwnerResult = await dbPool.query(
        `SELECT phone_no FROM "user" WHERE id = $1`,
        [fileOwnerId]
    );

    debugMedia.log("File owner user query result rows:", fileOwnerResult.rows.length);

    if (fileOwnerResult.rows.length > 0) {
        const fileOwnerPhone = fileOwnerResult.rows[0].phone_no;
        debugMedia.log("File owner's phone_no:", fileOwnerPhone);

        if (fileOwnerPhone) {
            const requesterContactsResult = await dbPool.query(
                `SELECT emergency_contacts, dependent_contacts FROM contacts WHERE user_id = $1`,
                [requestingUserId]
            );

            debugMedia.log("Requester contacts query result rows:", requesterContactsResult.rows.length);

            if (requesterContactsResult.rows.length > 0) {
                const requesterContacts = requesterContactsResult.rows[0];
                const emergencyContacts: string[] = requesterContacts.emergency_contacts || [];
                const dependentContacts: string[] = requesterContacts.dependent_contacts || [];

                debugMedia.log("Requesting user's emergency_contacts:", emergencyContacts);
                debugMedia.log("Requesting user's dependent_contacts:", dependentContacts);

                if (emergencyContacts.includes(fileOwnerPhone) || dependentContacts.includes(fileOwnerPhone)) {
                    debugMedia.log("Access granted: file owner is in requesting user's contacts");
                    return true;
                }
            }
        }
    }

    debugMedia.log("Access denied: no matching contact relationship found");
    return false;
}

/**
 * Get list of user IDs that the requesting user has access to
 */
async function getAccessibleUserIds(requestingUserId: string, requestingUserPhone: string | null): Promise<string[]> {
    const accessibleIds: Set<string> = new Set([requestingUserId]);

    if (!requestingUserPhone) {
        return Array.from(accessibleIds);
    }

    // Get requesting user's contacts
    const requesterContactsResult = await dbPool.query(
        `SELECT emergency_contacts, dependent_contacts FROM contacts WHERE user_id = $1`,
        [requestingUserId]
    );

    if (requesterContactsResult.rows.length > 0) {
        const contacts = requesterContactsResult.rows[0];
        const allContactPhones: string[] = [
            ...(contacts.emergency_contacts || []),
            ...(contacts.dependent_contacts || [])
        ];

        if (allContactPhones.length > 0) {
            // Get user IDs for all contact phone numbers
            const contactUsersResult = await dbPool.query(
                `SELECT id FROM "user" WHERE phone_no = ANY($1)`,
                [allContactPhones]
            );

            contactUsersResult.rows.forEach(row => {
                accessibleIds.add(row.id);
            });
        }
    }

    // Get users who have the requesting user in their contacts
    const reverseContactsResult = await dbPool.query(
        `SELECT user_id FROM contacts WHERE $1 = ANY(emergency_contacts) OR $1 = ANY(dependent_contacts)`,
        [requestingUserPhone]
    );

    reverseContactsResult.rows.forEach(row => {
        accessibleIds.add(row.user_id);
    });

    return Array.from(accessibleIds);
}

async function cleanupOldMediaFiles(
    userId: string,
    mediaType: MediaType,
    currentCreatedAt: Date,
    driveService: ReturnType<typeof getGoogleDriveService>
): Promise<void> {
    const filesToDeleteResult = await dbPool.query(
        `SELECT id, drive_file_id
         FROM media_files
         WHERE user_id = $1
           AND media_type = $2
           AND date_trunc('day', "createdAt") <> date_trunc('day', $3::timestamptz)`,
        [userId, mediaType, currentCreatedAt]
    );

    for (const row of filesToDeleteResult.rows as Array<{ id: number; drive_file_id: string }>) {
        try {
            await dbPool.query(`UPDATE media_files SET deleting = TRUE WHERE id = $1`, [row.id]);
            let deleted = false;
            let attempts = 0;
            while (!deleted && attempts < 3) {
                attempts += 1;
                deleted = await driveService.deleteFile(row.drive_file_id);
                if (!deleted && attempts < 3) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            if (!deleted) {
                throw new Error("Failed to delete file from storage after retries");
            }
            await dbPool.query(`DELETE FROM media_files WHERE id = $1`, [row.id]);
        } catch (error) {
            try {
                await dbPool.query(`UPDATE media_files SET deleting = FALSE WHERE id = $1`, [row.id]);
            } catch (rollbackError) {
                console.error('Failed to rollback deleting flag:', rollbackError);
            }
            console.error('Error deleting previous media file:', error);
        }
    }
}

// POST /media/upload - Upload a file
router.post("/media/upload", async (c) => {
    const user = c.get("user");

    try {
        const formData = await c.req.formData();
        const file = formData.get('file');
        const mediaTypeValue = formData.get('media_type');
        const description = formData.get('description');

        if (!file || !(file instanceof File)) {
            return c.json({ error: "No file provided" }, 400);
        }

        const mediaTypeParsed = mediaTypeSchema.safeParse(mediaTypeValue);
        if (!mediaTypeParsed.success) {
            return c.json({ 
                error: "Invalid media_type. Must be 'picture', 'video', or 'voice_recording'" 
            }, 400);
        }

        const mediaType = mediaTypeParsed.data;
        const mimeType = file.type;
        const fileSize = file.size;
        const originalName = file.name;

        // Validate MIME type
        if (!ALLOWED_MIME_TYPES[mediaType].includes(mimeType)) {
            return c.json({ 
                error: `Invalid file type for ${mediaType}. Allowed types: ${ALLOWED_MIME_TYPES[mediaType].join(', ')}` 
            }, 400);
        }

        // Validate file size
        const sizeLimit = FILE_SIZE_LIMITS[mediaType];
        if (fileSize > sizeLimit) {
            const limitMB = sizeLimit / (1024 * 1024);
            return c.json({ 
                error: `File size exceeds the ${limitMB}MB limit for ${mediaType}` 
            }, 400);
        }

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Google Drive
        const driveService = getGoogleDriveService();
        const uploadResult = await driveService.uploadFile(
            user.id,
            mediaType,
            buffer,
            originalName,
            mimeType
        );

        // Store file metadata in database
        let dbResult;
        try {
            dbResult = await dbPool.query(
                `INSERT INTO media_files (
                    user_id, drive_file_id, file_name, original_name, 
                    mime_type, media_type, file_size, web_view_link, 
                    web_content_link, description
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *`,
                [
                    user.id,
                    uploadResult.fileId,
                    uploadResult.fileName,
                    originalName,
                    mimeType,
                    mediaType,
                    fileSize,
                    uploadResult.webViewLink,
                    uploadResult.webContentLink,
                    description || null
                ]
            );
        } catch (dbError) {
            if (uploadResult?.fileId) {
                try {
                    const deleted = await driveService.deleteFile(uploadResult.fileId);
                    if (!deleted) {
                        console.error('Failed to cleanup orphaned Drive file:', uploadResult.fileId);
                    }
                } catch (cleanupError) {
                    console.error('Failed to cleanup orphaned Drive file:', cleanupError);
                }
            }
            throw dbError;
        }

        const savedFile = dbResult.rows[0] as MediaFile;

        await cleanupOldMediaFiles(user.id, mediaType, savedFile.createdAt, driveService);

        return c.json({
            success: true,
            file: {
                id: savedFile.id,
                drive_file_id: savedFile.drive_file_id,
                file_name: savedFile.file_name,
                original_name: savedFile.original_name,
                mime_type: savedFile.mime_type,
                media_type: savedFile.media_type,
                file_size: savedFile.file_size,
                web_view_link: savedFile.web_view_link,
                web_content_link: savedFile.web_content_link,
                description: savedFile.description,
                createdAt: savedFile.createdAt
            }
        }, 201);

    } catch (error) {
        console.error('Upload error:', error);
        const message = error instanceof Error ? error.message : 'Failed to upload file';
        return c.json({ error: message }, 500);
    }
});

// GET /media/files - Get all accessible files (own + connected users)
router.get("/media/files", async (c) => {
    const user = c.get("user");
    const mediaType = c.req.query('media_type');
    const userIdOrPhone = c.req.query('user_id'); // Can be user ID or phone number

    debugMedia.log("=== GET /media/files ===");
    debugMedia.log("Authenticated user:", { id: user.id, phone_no: user.phone_no, name: user.name });
    debugMedia.log("Query params - mediaType:", mediaType, "userIdOrPhone:", userIdOrPhone);

    try {
        // Validate media_type if provided
        if (mediaType) {
            const mediaTypeParsed = mediaTypeSchema.safeParse(mediaType);
            if (!mediaTypeParsed.success) {
                return c.json({ 
                    error: "Invalid media_type. Must be 'picture', 'video', or 'voice_recording'" 
                }, 400);
            }
        }

        // If specific user requested, check access
        if (userIdOrPhone) {
            // Resolve phone number to user ID if needed
            let fileOwnerId = userIdOrPhone;
            
            // Check if it looks like a phone number (starts with 0 or +)
            if (userIdOrPhone.startsWith('0') || userIdOrPhone.startsWith('+')) {
                debugMedia.log("userIdOrPhone appears to be a phone number, looking up user ID...");
                const userLookup = await dbPool.query(
                    `SELECT id FROM "user" WHERE phone_no = $1`,
                    [userIdOrPhone]
                );
                
                if (userLookup.rows.length === 0) {
                    debugMedia.log("No user found with phone number:", userIdOrPhone);
                    return c.json({ error: "User not found" }, 404);
                }
                
                fileOwnerId = userLookup.rows[0].id;
                debugMedia.log("Resolved phone number to user ID:", fileOwnerId);
            }
            
            debugMedia.log("Checking access for fileOwnerId:", fileOwnerId);
            const hasAccess = await hasAccessToUserFiles(user.id, user.phone_no || null, fileOwnerId);
            debugMedia.log("hasAccess result:", hasAccess);
            if (!hasAccess) {
                return c.json({ error: "Access denied to this user's files" }, 403);
            }

            let query = `
                SELECT mf.*, u.name as owner_name, u.email as owner_email, u.phone_no as owner_phone
                FROM media_files mf
                JOIN "user" u ON mf.user_id = u.id
                WHERE mf.user_id = $1
            `;
            const params: (string | undefined)[] = [fileOwnerId];

            if (mediaType) {
                query += ` AND mf.media_type = $2`;
                params.push(mediaType);
            }

            query += ` ORDER BY mf."createdAt" DESC`;

            const result = await dbPool.query(query, params);
            return c.json({ files: result.rows as MediaFileWithOwner[] });
        }

        // Get all accessible user IDs
        const accessibleUserIds = await getAccessibleUserIds(user.id, user.phone_no || null);

        let query = `
            SELECT mf.*, u.name as owner_name, u.email as owner_email, u.phone_no as owner_phone
            FROM media_files mf
            JOIN "user" u ON mf.user_id = u.id
            WHERE mf.user_id = ANY($1)
        `;
        const params: (string[] | string)[] = [accessibleUserIds];

        if (mediaType) {
            query += ` AND mf.media_type = $2`;
            params.push(mediaType);
        }

        query += ` ORDER BY mf."createdAt" DESC`;

        const result = await dbPool.query(query, params);
        return c.json({ files: result.rows as MediaFileWithOwner[] });

    } catch (error) {
        console.error('Error fetching files:', error);
        return c.json({ error: "Failed to fetch files" }, 500);
    }
});

// GET /media/files/own - Get only the user's own files
router.get("/media/files/own", async (c) => {
    const user = c.get("user");
    const mediaType = c.req.query('media_type');

    try {
        // Validate media_type if provided
        if (mediaType) {
            const mediaTypeParsed = mediaTypeSchema.safeParse(mediaType);
            if (!mediaTypeParsed.success) {
                return c.json({ 
                    error: "Invalid media_type. Must be 'picture', 'video', or 'voice_recording'" 
                }, 400);
            }
        }

        let query = `SELECT * FROM media_files WHERE user_id = $1`;
        const params: string[] = [user.id];

        if (mediaType) {
            query += ` AND media_type = $2`;
            params.push(mediaType);
        }

        query += ` ORDER BY "createdAt" DESC`;

        const result = await dbPool.query(query, params);
        return c.json({ files: result.rows as MediaFile[] });

    } catch (error) {
        console.error('Error fetching own files:', error);
        return c.json({ error: "Failed to fetch files" }, 500);
    }
});

// GET /media/files/:id - Get a specific file by ID
router.get("/media/files/:id", async (c) => {
    const user = c.get("user");
    const fileId = parseInt(c.req.param("id"));

    if (isNaN(fileId)) {
        return c.json({ error: "Invalid file ID" }, 400);
    }

    try {
        const result = await dbPool.query(
            `SELECT mf.*, u.name as owner_name, u.email as owner_email, u.phone_no as owner_phone
             FROM media_files mf
             JOIN "user" u ON mf.user_id = u.id
             WHERE mf.id = $1`,
            [fileId]
        );

        if (result.rows.length === 0) {
            return c.json({ error: "File not found" }, 404);
        }

        const file = result.rows[0] as MediaFileWithOwner;

        // Check access
        const hasAccess = await hasAccessToUserFiles(user.id, user.phone_no || null, file.user_id);
        if (!hasAccess) {
            return c.json({ error: "Access denied to this file" }, 403);
        }

        return c.json({ file });

    } catch (error) {
        console.error('Error fetching file:', error);
        return c.json({ error: "Failed to fetch file" }, 500);
    }
});

// GET /media/files/:id/download - Download/stream a file
router.get("/media/files/:id/download", async (c) => {
    const user = c.get("user");
    const fileId = parseInt(c.req.param("id"));

    if (isNaN(fileId)) {
        return c.json({ error: "Invalid file ID" }, 400);
    }

    try {
        const result = await dbPool.query(
            `SELECT * FROM media_files WHERE id = $1`,
            [fileId]
        );

        if (result.rows.length === 0) {
            return c.json({ error: "File not found" }, 404);
        }

        const file = result.rows[0] as MediaFile;

        // Check access
        const hasAccess = await hasAccessToUserFiles(user.id, user.phone_no || null, file.user_id);
        if (!hasAccess) {
            return c.json({ error: "Access denied to this file" }, 403);
        }

        // Get file content from Google Drive
        const driveService = getGoogleDriveService();
        const fileStream = await driveService.getFileContent(file.drive_file_id);

        if (!fileStream) {
            return c.json({ error: "Failed to retrieve file from storage" }, 500);
        }

        // sanitize filename for Content-Disposition header
        const sanitizedName = file.original_name
            .replace(/["\\\r\n]/g, '_')
            .replace(/[\x00-\x1F\x7F]/g, '_')
            .substring(0, 255);
        const encodedName = encodeURIComponent(file.original_name);

        return new Response(Readable.toWeb(fileStream) as unknown as ReadableStream, {
            headers: {
                'Content-Type': file.mime_type,
                'Content-Disposition': `attachment; filename="${sanitizedName}"; filename*=UTF-8''${encodedName}`,
                'Content-Length': file.file_size.toString(),
            },
        });

    } catch (error) {
        console.error('Error downloading file:', error);
        return c.json({ error: "Failed to download file" }, 500);
    }
});

// DELETE /media/files/:id - Delete a file (owner only)
router.delete("/media/files/:id", async (c) => {
    const user = c.get("user");
    const fileId = parseInt(c.req.param("id"));

    if (isNaN(fileId)) {
        return c.json({ error: "Invalid file ID" }, 400);
    }

    try {
        const result = await dbPool.query(
            `SELECT * FROM media_files WHERE id = $1`,
            [fileId]
        );

        if (result.rows.length === 0) {
            return c.json({ error: "File not found" }, 404);
        }

        const file = result.rows[0] as MediaFile;

        // Only owner can delete
        if (file.user_id !== user.id) {
            return c.json({ error: "Only the file owner can delete this file" }, 403);
        }

        const driveService = getGoogleDriveService();

        await dbPool.query(`UPDATE media_files SET deleting = TRUE WHERE id = $1`, [fileId]);

        const deleted = await driveService.deleteFile(file.drive_file_id);
        if (!deleted) {
            throw new Error("Failed to delete file from storage");
        }

        await dbPool.query(`DELETE FROM media_files WHERE id = $1`, [fileId]);

        return c.json({ success: true, message: "File deleted successfully" });

    } catch (error) {
        try {
            await dbPool.query(`UPDATE media_files SET deleting = FALSE WHERE id = $1`, [fileId]);
        } catch (rollbackError) {
            console.error('Failed to rollback deleting flag:', rollbackError);
        }
        console.error('Error deleting file:', error);
        return c.json({ error: "Failed to delete file" }, 500);
    }
});

// PUT /media/files/:id - Update file metadata (owner only)
router.put("/media/files/:id", async (c) => {
    const user = c.get("user");
    const fileId = parseInt(c.req.param("id"));

    if (isNaN(fileId)) {
        return c.json({ error: "Invalid file ID" }, 400);
    }

    try {
        const body = await c.req.json();
        const { description } = body;

        const result = await dbPool.query(
            `SELECT * FROM media_files WHERE id = $1`,
            [fileId]
        );

        if (result.rows.length === 0) {
            return c.json({ error: "File not found" }, 404);
        }

        const file = result.rows[0] as MediaFile;

        // Only owner can update
        if (file.user_id !== user.id) {
            return c.json({ error: "Only the file owner can update this file" }, 403);
        }

        // Update description
        const updateResult = await dbPool.query(
            `UPDATE media_files SET description = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
            [description || null, fileId]
        );

        return c.json({ 
            success: true, 
            file: updateResult.rows[0] as MediaFile 
        });

    } catch (error) {
        console.error('Error updating file:', error);
        return c.json({ error: "Failed to update file" }, 500);
    }
});

// GET /media/connected-users - Get list of users whose files are accessible
router.get("/media/connected-users", async (c) => {
    const user = c.get("user");

    try {
        const accessibleUserIds = await getAccessibleUserIds(user.id, user.phone_no || null);

        // Get user details for all accessible users (excluding self)
        const otherUserIds = accessibleUserIds.filter(id => id !== user.id);

        if (otherUserIds.length === 0) {
            return c.json({ users: [] });
        }

        const result = await dbPool.query(
            `SELECT id, name, email, phone_no, role, image FROM "user" WHERE id = ANY($1)`,
            [otherUserIds]
        );

        return c.json({ users: result.rows });

    } catch (error) {
        console.error('Error fetching connected users:', error);
        return c.json({ error: "Failed to fetch connected users" }, 500);
    }
});

// GET /media/stats - Get file statistics for the user
router.get("/media/stats", async (c) => {
    const user = c.get("user");

    try {
        const result = await dbPool.query(
            `SELECT 
                media_type,
                COUNT(*) as count,
                SUM(file_size) as total_size
             FROM media_files 
             WHERE user_id = $1 
             GROUP BY media_type`,
            [user.id]
        );

        const stats: Record<string, { count: number; total_size: number }> = {
            picture: { count: 0, total_size: 0 },
            video: { count: 0, total_size: 0 },
            voice_recording: { count: 0, total_size: 0 },
        };

        result.rows.forEach(row => {
            stats[row.media_type] = {
                count: parseInt(row.count),
                total_size: parseInt(row.total_size) || 0,
            };
        });

        const totalCount = Object.values(stats).reduce((sum, s) => sum + s.count, 0);
        const totalSize = Object.values(stats).reduce((sum, s) => sum + s.total_size, 0);

        return c.json({
            stats,
            total: {
                count: totalCount,
                size: totalSize,
            }
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        return c.json({ error: "Failed to fetch statistics" }, 500);
    }
});

export default router;
