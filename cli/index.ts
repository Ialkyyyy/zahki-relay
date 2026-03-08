#!/usr/bin/env node
import { Command } from 'commander';
import { TunnelClient } from './tunnel-client.js';

const program = new Command();

program
  .name('zahki-relay')
  .description('Webhook relay and localhost tunnel tool')
  .version('1.0.0');

program
  .command('start')
  .description('Start a tunnel to forward traffic to localhost')
  .argument('<port>', 'Local port to forward to', parseInt)
  .option('-s, --server <url>', 'Relay server URL', 'http://localhost:3004')
  .option('-d, --subdomain <name>', 'Request a specific subdomain')
  .action(async (port: number, options: { server: string; subdomain?: string }) => {
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error('Error: Port must be a number between 1 and 65535');
      process.exit(1);
    }

    console.log(`\n  zahki-relay\n`);
    console.log(`  Forwarding to localhost:${port}`);
    console.log(`  Server: ${options.server}\n`);

    const client = new TunnelClient({
      port,
      serverUrl: options.server,
      subdomain: options.subdomain,
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n  Shutting down...');
      client.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      client.disconnect();
      process.exit(0);
    });

    await client.connect();
  });

program.parse();
