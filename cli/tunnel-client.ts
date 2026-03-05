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

const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

export class TunnelClient {
  private ws: WebSocket | null = null;
  private apiKey: string | null = null;
  private subdomain: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private readonly options: TunnelClientOptions;
  private requestCount = 0;
  private connectedAt: number | null = null;

  constructor(options: TunnelClientOptions) {
    this.options = options;
  }

  async connect() {
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
          console.error(`  ${red('Error:')} ${err.error || response.statusText}`);
          process.exit(1);
        }

        const data = await response.json() as { id: string; subdomain: string; apiKey: string };
        this.apiKey = data.apiKey;
        this.subdomain = data.subdomain;
      } catch (err) {
        console.error(`  ${red('Error:')} ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    }

    const wsUrl = this.options.serverUrl.replace(/^http/, 'ws') + '/ws';
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      this.ws!.send(JSON.stringify({ type: 'auth', apiKey: this.apiKey }));
    });

    this.ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'auth_ok') {
          this.connectedAt = Date.now();
          const publicUrl = `${this.options.serverUrl}/t/${msg.subdomain}`;
          console.log(`  ${green('●')} Tunnel active\n`);
          console.log(`  ${dim('Public URL:')}  ${cyan(publicUrl)}`);
          console.log(`  ${dim('Forwarding:')}  http://localhost:${this.options.port}`);
          console.log(`  ${dim('Dashboard:')}   ${this.options.serverUrl}\n`);
          console.log(`  ${dim('Method'.padEnd(8))} ${dim('Path'.padEnd(40))} ${dim('Status'.padEnd(8))} ${dim('Time')}`);
          console.log(`  ${dim('─'.repeat(70))}`);
        } else if (msg.type === 'auth_error') {
          console.error(`  ${red('●')} Authentication failed: ${msg.error}`);
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
        const uptime = this.connectedAt ? this.formatUptime(Date.now() - this.connectedAt) : '';
        console.log(`\n  ${yellow('●')} Connection lost${uptime ? ` (uptime: ${uptime})` : ''}. Reconnecting in 3s...`);
        this.connectedAt = null;
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    });

    this.ws.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
        console.error(`  ${red('●')} Cannot connect to server at ${this.options.serverUrl}`);
      }
    });
  }

  private async handleRequest(req: TunnelRequest) {
    const startTime = Date.now();
    const localUrl = `http://localhost:${this.options.port}${req.path}`;
    this.requestCount++;

    try {
      const fetchOptions: RequestInit = {
        method: req.method,
        headers: req.headers,
      };

      if (req.body && !['GET', 'HEAD'].includes(req.method.toUpperCase())) {
        fetchOptions.body = req.body;
      }

      const headers = { ...req.headers };
      delete headers['host'];
      delete headers['connection'];
      fetchOptions.headers = headers;

      const response = await fetch(localUrl, fetchOptions);
      const responseBody = await response.text();
      const elapsed = Date.now() - startTime;

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      this.ws?.send(JSON.stringify({
        type: 'response',
        id: req.id,
        status: response.status,
        headers: responseHeaders,
        body: responseBody,
      }));

      const colorStatus = response.status < 300 ? green : response.status < 400 ? yellow : red;
      const methodStr = req.method.padEnd(8);
      const pathStr = req.path.length > 40 ? req.path.substring(0, 37) + '...' : req.path.padEnd(40);
      console.log(`  ${methodStr} ${pathStr} ${colorStatus(String(response.status).padEnd(8))} ${dim(elapsed + 'ms')}`);
    } catch (err) {
      const elapsed = Date.now() - startTime;

      this.ws?.send(JSON.stringify({
        type: 'response',
        id: req.id,
        status: 502,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to reach local server', detail: err instanceof Error ? err.message : 'Unknown error' }),
      }));

      const pathStr = req.path.length > 40 ? req.path.substring(0, 37) + '...' : req.path.padEnd(40);
      console.log(`  ${req.method.padEnd(8)} ${pathStr} ${red('502'.padEnd(8))} ${dim(elapsed + 'ms')}  ${dim('(local server unreachable)')}`);
    }
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
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
    if (this.requestCount > 0) {
      console.log(`\n  ${dim(`${this.requestCount} request${this.requestCount !== 1 ? 's' : ''} forwarded`)}`);
    }
  }
}
