/**
 * Debug logging utility for frontend
 * 
 * Enable debug logging by setting VITE_DEBUG=true in your .env file
 * 
 * Usage:
 *   import { debug } from '../scripts/debug';
 *   debug.log('message');
 *   debug.log('label', { data: 'value' });
 */

const isDebugEnabled = import.meta.env.VITE_DEBUG === 'true';

export const debug = {
    /**
     * Log a debug message (only when VITE_DEBUG=true)
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
export const debugDashboard = debug.namespace('dashboard');
