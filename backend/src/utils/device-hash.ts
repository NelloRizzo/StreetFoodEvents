import crypto from 'crypto';

export function hashDeviceId(deviceId: string | undefined): string {
  if (!deviceId) return '';
  return crypto.createHash('sha256').update(deviceId).digest('hex');
}
