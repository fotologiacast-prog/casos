// --- SUPABASE CONFIGURATION ---
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// --- GOOGLE DRIVE CONFIGURATION ---
// Public identifiers are safe here. The service account JSON key must stay only on the backend.
export const DRIVE_ROOT_FOLDER_ID = import.meta.env.VITE_DRIVE_ROOT_FOLDER_ID || '1aUtI6yDclwJVxIktMKsewuwnrAgSLWLX';
export const DRIVE_SERVICE_ACCOUNT_EMAIL = import.meta.env.VITE_DRIVE_SERVICE_ACCOUNT_EMAIL || 'drive-uploader@smash-balloon-479213.iam.gserviceaccount.com';
export const DEFAULT_MONDAY_CASE_BOARD_ID = '18054403734';
