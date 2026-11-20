import { describe, expect, it } from 'vitest';
import { sessionMediaUploadSchema } from '../booking';
import { peerMediaUploadSchema } from '../peer-messages';

// Chrome: MediaRecorder.mimeType = "audio/webm;codecs=opus" -> sebelumnya ditolak (voice note gagal terkirim).
describe.each([
  ['sessionMediaUploadSchema', sessionMediaUploadSchema],
  ['peerMediaUploadSchema', peerMediaUploadSchema],
])('%s', (_name, schema) => {
  const voice = (file_type: string) => schema.safeParse({ file_name: 'v.webm', file_type, kind: 'voice' });

  it('menerima audio/webm;codecs=opus dan menormalkannya ke audio/webm', () => {
    const r = voice('audio/webm;codecs=opus');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.file_type).toBe('audio/webm');
  });

  it('tetap menerima audio/mp4 (Safari) dan menolak tipe non-audio', () => {
    expect(voice('audio/mp4').success).toBe(true);
    expect(voice('application/x-msdownload;codecs=audio').success).toBe(false);
  });
});
