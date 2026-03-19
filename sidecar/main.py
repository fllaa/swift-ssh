#!/usr/bin/env python3
"""
SwiftSSH Python sidecar — manages an interactive SSH session.

Communication protocol:
- Receives host config via --host-json CLI arg
- Reads raw bytes from stdin → sends to SSH channel
- Writes SSH channel output as base64-encoded chunks to stdout (one per line)
- Each stdout line is a JSON object: {"type":"data","payload":"<base64>"} or {"type":"status","payload":"<msg>"}
"""

import os
import tempfile
import sys
import json
import base64
import threading
import time
import traceback
import argparse
import paramiko
from paramiko.agent import AgentRequestHandler
import socket
import socketserver
import select


def log(msg: str):
    """Write debug log to stderr (picked up by Rust stderr reader)."""
    sys.stderr.write(f"[sidecar] {msg}\n")
    sys.stderr.flush()


def emit_data(raw_bytes: bytes):
    """Write base64-encoded SSH output as a JSON line."""
    encoded = base64.b64encode(raw_bytes).decode("ascii")
    line = json.dumps({"type": "data", "payload": encoded})
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def emit_status(msg: str):
    """Write a status message as a JSON line."""
    log(f"emit_status: {msg}")


class ForwardServer(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        try:
            chan = self.ssh_transport.open_channel(
                "direct-tcpip",
                (self.chain_host, self.chain_port),
                self.request.getpeername(),
            )
        except Exception as e:
            log(f"Incoming request to {self.chain_host}:{self.chain_port} failed: {e}")
            return

        if chan is None:
            log(f"Incoming request to {self.chain_host}:{self.chain_port} was rejected by the SSH server.")
            return

        log(f"Connected! Tunnel open {self.request.getpeername()} -> {chan.getpeername()} -> {(self.chain_host, self.chain_port)}")
        while True:
            r, _, _ = select.select([self.request, chan], [], [])
            if self.request in r:
                data = self.request.recv(1024)
                if len(data) == 0:
                    break
                chan.send(data)
            if chan in r:
                data = chan.recv(1024)
                if len(data) == 0:
                    break
                self.request.send(data)
        chan.close()
        self.request.close()
        log(f"Tunnel closed from {self.request.getpeername()}")


def forward_local_port(local_port, remote_host, remote_port, transport):
    # This entire class is constructed each time a new connection is made
    class SubHandler(Handler):
        chain_host = remote_host
        chain_port = remote_port
        ssh_transport = transport

    server = ForwardServer(("", local_port), SubHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def reverse_forward_handler(chan, host, port, transport):
    log(f"Incoming reverse tunnel request to {host}:{port}")
    try:
        sock = socket.socket()
        sock.connect((host, port))
    except Exception as e:
        log(f"Reverse forward to {host}:{port} failed: {e}")
        return

    log(f"Connected! Reverse tunnel open {chan.getpeername()} -> {chan.getpeername()} -> {(host, port)}")
    while True:
        try:
            r, _, _ = select.select([sock, chan], [], [], 1.0)
            if not r:
                if not transport.is_active(): break
                continue
            if sock in r:
                data = sock.recv(1024)
                if len(data) == 0: break
                chan.send(data)
            if chan in r:
                data = chan.recv(1024)
                if len(data) == 0: break
                sock.send(data)
        except Exception:
            break
    chan.close()
    sock.close()
    log(f"Reverse tunnel closed to {host}:{port}")


def main():
    log("sidecar starting")

    parser = argparse.ArgumentParser()
    parser.add_argument("--host-json", required=True, help="JSON host profile")
    parser.add_argument("--forwarding-json", default=None, help="JSON forwarding rules")
    parser.add_argument("--session-id", required=True, help="Session ID")
    parser.add_argument("--key-content", default=None, help="Private key content")
    parser.add_argument("--test", action="store_true", help="Test connection only")
    parser.add_argument("--detect-distro", action="store_true", help="Detect OS distro only")
    parser.add_argument("--no-shell", action="store_true", help="Start forwarding only, no interactive shell")
    args = parser.parse_args()

    host = json.loads(args.host_json)
    hostname = host.get("hostname", "localhost")
    port = int(host.get("port", 22))
    username = host.get("username", "root")
    auth_method = host.get("authMethod", "password")
    password = host.get("password", "")
    agent_forwarding = host.get("agentForwarding", False)

    forwarding_rules = []
    if args.forwarding_json:
        try:
            forwarding_rules = json.loads(args.forwarding_json)
        except Exception as e:
            log(f"Error parsing forwarding JSON: {e}")

    log(f"connecting to {username}@{hostname}:{port} auth={auth_method} agent_fw={agent_forwarding} tunnels={len(forwarding_rules)}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        connect_kwargs = {
            "hostname": hostname,
            "port": port,
            "username": username,
            "timeout": 15,
            "allow_agent": agent_forwarding,
            "look_for_keys": False,
        }

        if auth_method == "key" and args.key_content:
            tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".pem", delete=False)
            tmp.write(args.key_content)
            tmp.close()
            try:
                try:
                    pkey = paramiko.RSAKey.from_private_key_file(tmp.name)
                except paramiko.ssh_exception.PasswordRequiredException:
                    raise
                except paramiko.ssh_exception.SSHException:
                    try:
                        pkey = paramiko.Ed25519Key.from_private_key_file(tmp.name)
                    except paramiko.ssh_exception.PasswordRequiredException:
                        raise
                    except Exception:
                        try:
                            pkey = paramiko.ECDSAKey.from_private_key_file(tmp.name)
                        except paramiko.ssh_exception.PasswordRequiredException:
                            raise
                        except Exception:
                            raise Exception("Invalid private key format")
                os.unlink(tmp.name)
                connect_kwargs["pkey"] = pkey
            except paramiko.ssh_exception.PasswordRequiredException:
                os.unlink(tmp.name)
                log("Key requires a passphrase")
                if args.test:
                    sys.stdout.write("FAIL:Key requires a passphrase (unsupported)\n")
                    sys.stdout.flush()
                    sys.exit(1)
                emit_status("error:Key requires a passphrase (unsupported)")
                sys.exit(1)
            except Exception as e:
                os.unlink(tmp.name)
                log(f"Key format error: {str(e)}")
                if args.test:
                    sys.stdout.write("FAIL:Invalid private key format\n")
                    sys.stdout.flush()
                    sys.exit(1)
                emit_status("error:Invalid private key format")
                sys.exit(1)
        else:
            connect_kwargs["password"] = password

        client.connect(**connect_kwargs)
        log("SSH connected successfully")

        if args.detect_distro:
            try:
                _, stdout_stream, _ = client.exec_command("cat /etc/os-release 2>/dev/null || uname -s", timeout=10)
                output = stdout_stream.read().decode("utf-8", errors="replace")
                distro_id = ""
                for line in output.splitlines():
                    if line.startswith("ID="):
                        distro_id = line[3:].strip().strip('"').lower()
                        break
                if not distro_id:
                    # Fallback: uname output
                    distro_id = output.strip().lower()
                sys.stdout.write(distro_id + "\n")
                sys.stdout.flush()
                log(f"detect_distro: id={distro_id}")
            except Exception as e:
                log(f"detect_distro error: {e}")
                sys.stdout.write("\n")
                sys.stdout.flush()
            client.close()
            sys.exit(0)

        if args.test:
            transport = client.get_transport()
            if transport and transport.is_active():
                sys.stdout.write("OK\n")
                sys.stdout.flush()
            else:
                sys.stdout.write("FAIL:Connection established but transport inactive\n")
                sys.stdout.flush()
            client.close()
            sys.exit(0)

        channel = None
        if not args.no_shell:
            channel = client.invoke_shell(term="xterm-256color", width=120, height=40)
            channel.settimeout(0.1)
            log("shell channel opened")
        else:
            log("no-shell mode: skipping shell initialization")

        transport = client.get_transport()

        # State for live updates
        active_local_servers = {} # rule_id -> server_obj
        active_remote_ports = set() # set of remote_port numbers
        current_forwarding_rules = []

        def apply_forwarding_rules(rules):
            nonlocal current_forwarding_rules
            log(f"Applying {len(rules)} forwarding rules")
            
            # 1. Handle Local Forwarding (L)
            new_local_rule_ids = {r['id'] for r in rules if r.get('type') == 'local' and r.get('enabled')}
            
            # Shutdown removed or disabled local servers
            to_stop = [rid for rid in active_local_servers if rid not in new_local_rule_ids]
            for rid in to_stop:
                log(f"Stopping local tunnel for rule {rid}")
                active_local_servers[rid].shutdown()
                del active_local_servers[rid]
            
            # Start new local servers
            for rule in rules:
                rid = rule['id']
                if rule.get('type') == 'local' and rule.get('enabled') and rid not in active_local_servers:
                    lport = int(rule.get('localPort', 0))
                    rhost = rule.get('remoteHost', '127.0.0.1')
                    rport = int(rule.get('remotePort', 0))
                    if lport > 0:
                        try:
                            srv = forward_local_port(lport, rhost, rport, transport)
                            active_local_servers[rid] = srv
                            log(f"Started local tunnel {rid}: localhost:{lport} -> {rhost}:{rport}")
                        except Exception as e:
                            log(f"Failed to start local tunnel {rid}: {e}")

            # 2. Handle Remote Forwarding (R)
            new_remote_rules = [r for r in rules if r.get('type') == 'remote' and r.get('enabled')]
            new_remote_ports = {int(r['localPort']) for r in new_remote_rules if int(r.get('localPort', 0)) > 0}
            
            # Cancel removed remote forwards
            to_cancel = active_remote_ports - new_remote_ports
            for port in to_cancel:
                log(f"Cancelling remote forward on port {port}")
                try:
                    transport.cancel_port_forward("", port)
                except Exception as e:
                    log(f"Error cancelling port forward {port}: {e}")
            
            # Request new remote forwards
            for rule in new_remote_rules:
                port = int(rule['localPort'])
                if port not in active_remote_ports:
                    log(f"Requesting remote forward on port {port}")
                    try:
                        transport.request_port_forward("", port)
                        active_remote_ports.add(port)
                    except Exception as e:
                        log(f"Error requesting port forward {port}: {e}")
            
            active_remote_ports.intersection_update(new_remote_ports)
            current_forwarding_rules[:] = rules

        # Initial apply
        apply_forwarding_rules(forwarding_rules)

        def reverse_listener_loop():
            while transport.is_active():
                try:
                    new_chan = transport.accept(1)
                    if new_chan is None: continue
                    
                    # Match incoming request to a rule
                    # Paramiko accept() doesn't easily tell us WHICH port was hit.
                    # We look at get_name() if available, but usually we just use the first match
                    # simple heuristic: use the first enabled remote rule
                    remote_rule = next((r for r in current_forwarding_rules if r.get("type") == "remote" and r.get("enabled")), None)
                    if remote_rule:
                        threading.Thread(
                            target=reverse_forward_handler,
                            args=(new_chan, remote_rule['remoteHost'], remote_rule['remotePort'], transport),
                            daemon=True
                        ).start()
                    else:
                        new_chan.close()
                except Exception:
                    break

        threading.Thread(target=reverse_listener_loop, daemon=True).start()

        if agent_forwarding and channel:
            AgentRequestHandler(channel)
            log("agent forwarding handler started")

        if not args.no_shell:
            def read_channel():
                while not channel.closed:
                    try:
                        if channel.recv_ready():
                            data = channel.recv(4096)
                            if data: emit_data(data)
                        else:
                            time.sleep(0.02)
                    except Exception: break
                emit_status("disconnected")
                sys.exit(0)
            threading.Thread(target=read_channel, daemon=True).start()

        log("waiting for stdin input...")
        for line in sys.stdin:
            line = line.strip()
            if not line: continue
            
            if line.startswith("{"):
                try:
                    msg = json.loads(line)
                    if msg.get("type") == "update_forwarding":
                        apply_forwarding_rules(msg.get("rules", []))
                    elif msg.get("type") == "resize":
                        cols = msg.get("cols", 120)
                        rows = msg.get("rows", 40)
                        if channel and not channel.closed:
                            log(f"Resizing PTY to {cols}x{rows}")
                            channel.resize_pty(width=cols, height=rows)
                    continue
                except Exception as e:
                    log(f"JSON control error: {e}")
            
            if channel and not channel.closed:
                try:
                    raw = base64.b64decode(line)
                    channel.send(raw)
                except Exception as e:
                    log(f"stdin decode/send error: {e}")
            elif args.no_shell:
                # In no-shell mode, we just ignore non-JSON stdin
                pass
            else:
                break

    except paramiko.AuthenticationException:
        log("Authentication failed")
        if args.test:
            sys.stdout.write("FAIL:Authentication failed\n")
            sys.stdout.flush()
            sys.exit(1)
        emit_status("error:Authentication failed")
    except paramiko.SSHException as e:
        log(f"SSH exception: {e}")
        if args.test:
            sys.stdout.write(f"FAIL:{e}\n")
            sys.stdout.flush()
            sys.exit(1)
        emit_status(f"error:{e}")
    except Exception as e:
        log(f"Unexpected exception: {e}")
        log(traceback.format_exc())
        if args.test:
            sys.stdout.write(f"FAIL:{e}\n")
            sys.stdout.flush()
            sys.exit(1)
        emit_status(f"error:{e}")
    finally:
        log("closing client")
        for s in local_servers:
            s.shutdown()
        client.close()


if __name__ == "__main__":
    main()
