/**
 * Google Drive OAuth2 Refresh Token Generator
 * 
 * This script helps you obtain a refresh token for your personal Google account
 * so the app can upload files to your Google Drive.
 * 
 * Prerequisites:
 * 1. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file
 * 2. In Google Cloud Console, add http://localhost:3000/callback to your OAuth redirect URIs
 * 
 * Usage:
 *   bun run scripts/get-drive-token.ts
 * 
 * Then open the URL in your browser, authorize the app, and copy the refresh token.
 */

import { OAuth2Client } from 'google-auth-library';
import { createServer } from 'http';

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
    console.error('Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
    process.exit(1);
}

const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const oauth2Client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent screen to get refresh token
});

console.log('\n=== Google Drive Token Generator ===\n');
console.log('1. Make sure http://localhost:3000/callback is added as an authorized redirect URI');
console.log('   in your Google Cloud Console OAuth 2.0 credentials.\n');
console.log('2. Open this URL in your browser:\n');
console.log(`   ${authUrl}\n`);
console.log('3. Authorize the app with your Google account.\n');
console.log('Waiting for authorization callback...\n');

const server = createServer(async (req, res) => {
    if (req.url?.startsWith('/callback')) {
        const url = new URL(req.url, `http://localhost:3000`);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<h1>Error</h1><p>${escapeHtml(error)}</p>`);
            console.error('Authorization error:', error);
            server.close();
            process.exit(1);
        }

        if (code) {
            try {
                const { tokens } = await oauth2Client.getToken(code);
                
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <h1>Success!</h1>
                    <p>Your refresh token has been generated. Check the terminal for the token.</p>
                    <p>You can close this window.</p>
                `);

                console.log('\n=== SUCCESS! ===\n');
                console.log('Add this to your .env file:\n');
                console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
                
                if (!tokens.refresh_token) {
                    console.log('\nWARNING: No refresh token received.');
                    console.log('This happens if you previously authorized this app.');
                    console.log('Go to https://myaccount.google.com/permissions and revoke access,');
                    console.log('then run this script again.\n');
                }

                server.close();
                process.exit(0);
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`<h1>Error</h1><p>Failed to exchange code for tokens</p>`);
                console.error('Token exchange error:', err);
                server.close();
                process.exit(1);
            }
        }
    }
});

server.listen(3000, () => {
    console.log('Server listening on http://localhost:3000');
});
