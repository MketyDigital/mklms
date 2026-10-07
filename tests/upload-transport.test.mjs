import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { uploadBlobWithProgress } from '../src/features/media/components/upload-transport.ts';

class FakeXMLHttpRequest {
  static instances = [];

  uploadListeners = new Map();
  upload = { addEventListener: (name, listener) => this.uploadListeners.set(name, listener) };
  listeners = new Map();
  headers = {};
  status = 0;
  sentBody = null;
  responseHeaders = { etag: '"part-etag"' };

  constructor() {
    FakeXMLHttpRequest.instances.push(this);
  }

  open(method, url) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name, value) {
    this.headers[name] = value;
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  send(body) {
    this.sentBody = body;
  }

  getResponseHeader(name) {
    return this.responseHeaders[name.toLowerCase()] ?? null;
  }

  emitProgress(loaded, total) {
    this.uploadListeners.get('progress')?.({ lengthComputable: true, loaded, total });
  }

  emit(name) {
    this.listeners.get(name)?.();
  }
}

test('upload transport reports transferred bytes and returns response headers', async () => {
  const previous = globalThis.XMLHttpRequest;
  FakeXMLHttpRequest.instances = [];
  globalThis.XMLHttpRequest = FakeXMLHttpRequest;

  try {
    const progress = [];
    const body = new Blob(['video bytes'], { type: 'video/mp4' });
    const upload = uploadBlobWithProgress('https://upload.example/signed', body, (loaded, total) => {
      progress.push({ loaded, total });
    }, 'video/mp4');
    const xhr = FakeXMLHttpRequest.instances[0];

    assert.equal(xhr.method, 'PUT');
    assert.equal(xhr.url, 'https://upload.example/signed');
    assert.equal(xhr.headers['Content-Type'], 'video/mp4');
    assert.equal(xhr.sentBody, body);

    xhr.emitProgress(5, 11);
    xhr.status = 200;
    xhr.emit('load');

    const response = await upload;
    assert.deepEqual(progress, [{ loaded: 5, total: 11 }]);
    assert.equal(response.etag, '"part-etag"');
  } finally {
    globalThis.XMLHttpRequest = previous;
  }
});

test('upload transport rejects failed HTTP responses without exposing provider details', async () => {
  const previous = globalThis.XMLHttpRequest;
  FakeXMLHttpRequest.instances = [];
  globalThis.XMLHttpRequest = FakeXMLHttpRequest;

  try {
    const upload = uploadBlobWithProgress('https://upload.example/signed', new Blob(['video']));
    const xhr = FakeXMLHttpRequest.instances[0];
    xhr.status = 403;
    xhr.emit('load');
    await assert.rejects(upload, /upload request failed/i);
    assert.doesNotMatch((await upload.catch((error) => error.message)), /R2|Cloudflare/i);
  } finally {
    globalThis.XMLHttpRequest = previous;
  }
});

test('upload panel uses Streaming Storage wording and reports transfer and save states', () => {
  const panel = readFileSync('src/features/media/components/media-upload-panel.tsx', 'utf8');
  assert.match(panel, /Streaming Storage/);
  assert.match(panel, /Confirming save in the media library/);
  assert.match(panel, /Upload complete and saved to the media library/);
  assert.doesNotMatch(panel, /R2|Cloudflare/i);
});
