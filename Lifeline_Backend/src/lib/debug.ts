/**
 * Debug logging utility
 * 
 * Enable debug logging by setting DEBUG=true in your .env file
 * 
 * Usage:
 *   import { debug } from '../lib/debug';
 *   debug.log('message');
 *   debug.log('label', { data: 'value' });
 */

const isDebugEnabled = process.env.DEBUG === 'true';

export const debug = {
    /**
     * Log a debug message (only when DEBUG=true)
     */
    log: (...args: unknown[]) => {
        if (isDebugEnabled) {
            console.log('[DEBUG]', ...args);
        }
    },

    /**
     * Log a debug message with a specific namespace/label
     */
    namespace: (namespace: string) => ({
        log: (...args: unknown[]) => {
            if (isDebugEnabled) {
                console.log(`[DEBUG:${namespace}]`, ...args);
            }
        },
    }),

    /**
     * Check if debug mode is enabled
     */
    isEnabled: () => isDebugEnabled,
};

// Pre-configured namespaces for common areas
export const debugMedia = debug.namespace('media');
export const debugAuth = debug.namespace('auth');
export const debugWs = debug.namespace('websocket');
export const debugDb = debug.namespace('db');
