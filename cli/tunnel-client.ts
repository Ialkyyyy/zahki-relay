import WebSocket from 'ws';

interface TunnelClientOptions {
  port: number;
  serverUrl: string;
  subdomain?: string;
}

interface TunnelRequest {
  type: 'request';
  id: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
}

export class TunnelClient {
  private ws: WebSocket | null = null;
  private apiKey: string | null = null;
  private subdomain: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private readonly options: TunnelClientOptions;

  constructor(options: TunnelClientOptions) {
    this.options = options;
  }

  async connect() {
    // First, create a tunnel via the API to get an API key
    if (!this.apiKey) {
      try {
        const createUrl = `${this.options.serverUrl}/api/tunnels`;
        const body: Record<string, string> = {};
        if (this.options.subdomain) {
          body.subdomain = this.options.subdomain;
        }

        const response = await fetch(createUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const err = await response.json();
          console.error(`  Error creating tunnel: ${err.error || response.statusText}`);
          process.exit(1);
        }

        const data = await response.json() as { id: string; subdomain: string; apiKey: string };
        this.apiKey = data.apiKey;
        this.subdomain = data.subdomain;
      } catch (err) {
        console.error(`  Error connecting to server: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    }

    // Connect via WebSocket
    const wsUrl = this.options.serverUrl.replace(/^http/, 'ws') + '/ws';
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      this.ws!.send(JSON.stringify({ type: 'auth', apiKey: this.apiKey }));
    });

    this.ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'auth_ok') {
          console.log(`  Connected! Tunnel active.`);
          console.log(`  Public URL: ${this.options.serverUrl}/t/${msg.subdomain}`);
          console.log(`  Forwarding to: http://localhost:${this.options.port}\n`);
          console.log(`  ${'Method'.padEnd(8)} ${'Path'.padEnd(40)} ${'Status'.padEnd(8)} Time`);
          console.log(`  ${'─'.repeat(8)} ${'─'.repeat(40)} ${'─'.repeat(8)} ${'─'.repeat(8)}`);
        } else if (msg.type === 'auth_error') {
          console.error(`  Authentication failed: ${msg.error}`);
          this.shouldReconnect = false;
        } else if (msg.type === 'request') {
          await this.handleRequest(msg as TunnelRequest);
        }
      } catch {
        // Ignore malformed messages
      }
    });

    this.ws.on('close', (code) => {
      if (this.shouldReconnect && code !== 4003) {
        console.log('\n  Connection lost. Reconnecting in 3s...');
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    });

    this.ws.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
        console.error(`  Cannot connect to server at ${this.options.serverUrl}`);
      }
      // The 'close' event will fire after this and handle reconnection
    });
  }

  private async handleRequest(req: TunnelRequest) {
    const startTime = Date.now();
    const localUrl = `http://localhost:${this.options.port}${req.path}`;

    try {
      const fetchOptions: RequestInit = {
        method: req.method,
        headers: req.headers,
      };

      // Only attach body for methods that support it
      if (req.body && !['GET', 'HEAD'].includes(req.method.toUpperCase())) {
        fetchOptions.body = req.body;
      }

      // Remove headers that would cause issues with local fetch
      const headers = { ...req.headers };
      delete headers['host'];
      delete headers['connection'];
      fetchOptions.headers = headers;

      const response = await fetch(localUrl, fetchOptions);
      const responseBody = await response.text();
      const elapsed = Date.now() - startTime;

      // Collect response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Send response back to relay server
      this.ws?.send(JSON.stringify({
        type: 'response',
        id: req.id,
        status: response.status,
        headers: responseHeaders,
        body: responseBody,
      }));

      // Log to terminal
      const statusColor = response.status < 300 ? '\x1b[32m' : response.status < 400 ? '\x1b[33m' : '\x1b[31m';
      const reset = '\x1b[0m';
      const methodStr = req.method.padEnd(8);
      const pathStr = req.path.length > 40 ? req.path.substring(0, 37) + '...' : req.path.padEnd(40);
      const statusStr = `${statusColor}${response.status}${reset}`.padEnd(8 + statusColor.length + reset.length);
      console.log(`  ${methodStr} ${pathStr} ${statusStr} ${elapsed}ms`);
    } catch (err) {
      const elapsed = Date.now() - startTime;

      // Send error response back
      this.ws?.send(JSON.stringify({
        type: 'response',
        id: req.id,
        status: 502,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to reach local server', detail: err instanceof Error ? err.message : 'Unknown error' }),
      }));

      const pathStr = req.path.length > 40 ? req.path.substring(0, 37) + '...' : req.path.padEnd(40);
      console.log(`  ${req.method.padEnd(8)} ${pathStr} \x1b[31m502\x1b[0m      ${elapsed}ms  (local server unreachable)`);
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close(1000, 'Client shutting down');
      this.ws = null;
    }
  }
}
