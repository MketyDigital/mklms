import test from 'node:test';
import assert from 'node:assert/strict';

import { uploadBlobWithProgress } from '../src/features/media/components/upload-transport.ts';

class FakeXMLHttpRequest {
  static instances = [];

  uploadListeners = new Map();
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

    xhr.uploadListeners.set('progress', (event) => progress.push({ loaded: event.loaded, total: event.total }));
    xhr.emitProgress(5, 11);
    xhr.status = 200;
    xhr.emit('load');

    const response = await upload;
    assert.deepEqual(progress, [{ loaded: 5, total: 11 }, { loaded: 5, total: 11 }]);
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
