import { File } from 'expo-file-system';
import { supabase } from './supabase';
import type { WaaBucket } from './types';

/**
 * All four WAA buckets are private, so nothing here returns a public URL.
 * We store the *object path* (e.g. `<worker_id>/selfie-169...jpg`) in the
 * database column and mint a short-lived signed URL whenever we need to
 * actually display the file.
 */

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

function guessContentType(uri: string, fallback: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'heic':
      return 'image/heic';
    case 'webp':
      return 'image/webp';
    case 'pdf':
      return 'application/pdf';
    default:
      return fallback;
  }
}

/**
 * Uploads a local file (a `file://` URI from expo-image-picker or the document
 * picker) into a private bucket under the `{worker_id}/{filename}` convention
 * the RLS storage policies expect.
 *
 * @returns the object path to persist in the corresponding table column.
 */
export async function uploadToBucket(
  bucket: WaaBucket,
  workerId: string,
  localUri: string,
  namePrefix: string,
  fallbackContentType = 'image/jpeg'
): Promise<string> {
  const contentType = guessContentType(localUri, fallbackContentType);
  const extension = localUri.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${workerId}/${namePrefix}-${Date.now()}.${extension}`;

  // `File` from expo-file-system extends Blob, so arrayBuffer() gives us bytes
  // the storage client can upload directly. (fetch(file://) is unreliable on
  // Android, which is why we don't use it here.)
  const bytes = await new File(localUri).arrayBuffer();

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw error;

  return path;
}

/**
 * Uploads to an explicit object path, for buckets whose RLS policies key off
 * something other than the `{worker_id}/…` convention above. The payroll-proofs
 * bucket is the only such case today: its worker-read policy matches
 * `payslip/{worker_id}/…`, and cash advance proofs live under
 * `cash-advance/{cash_advance_id}/…`.
 *
 * @param prefix the folder path, without a trailing slash.
 * @returns the object path to persist in the corresponding table column.
 */
export async function uploadToPath(
  bucket: WaaBucket,
  prefix: string,
  localUri: string,
  namePrefix: string,
  fallbackContentType = 'image/jpeg'
): Promise<string> {
  const contentType = guessContentType(localUri, fallbackContentType);
  const extension = localUri.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${prefix}/${namePrefix}-${Date.now()}.${extension}`;

  const bytes = await new File(localUri).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw error;

  return path;
}

/**
 * Mints a temporary readable URL for a private object.
 * Returns null (rather than throwing) so callers can fall back to a
 * placeholder instead of blowing up a whole list render.
 */
export async function getSignedUrl(
  bucket: WaaBucket,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}
