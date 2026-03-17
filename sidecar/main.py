#!/usr/bin/env python3
"""
SwiftSSH Python sidecar — manages an interactive SSH session.

Communication protocol:
- Receives host config via --host-json CLI arg
- Reads raw bytes from stdin → sends to SSH channel
- Writes SSH channel output as base64-encoded chunks to stdout (one per line)
- Each stdout line is a JSON object: {"type":"data","payload":"<base64>"} or {"type":"status","payload":"<msg>"}
"""

import argparse
import base64
import json
import sys
import tempfile
import threading
import time
import os
import traceback

import paramiko


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
    line = json.dumps({"type": "status", "payload": msg})
    sys.stdout.write(line + "\n")
    sys.stdout.flush()
    log(f"emit_status: {msg}")


def main():
    log("sidecar starting")

    parser = argparse.ArgumentParser()
    parser.add_argument("--host-json", required=True, help="JSON host profile")
    parser.add_argument("--session-id", required=True, help="Session ID")
    parser.add_argument("--key-content", default=None, help="Private key content")
    parser.add_argument("--test", action="store_true", help="Test connection only")
    parser.add_argument("--detect-distro", action="store_true", help="Detect OS distro only")
    args = parser.parse_args()

    host = json.loads(args.host_json)
    hostname = host.get("hostname", "localhost")
    port = int(host.get("port", 22))
    username = host.get("username", "root")
    auth_method = host.get("authMethod", "password")
    password = host.get("password", "")

    log(f"connecting to {username}@{hostname}:{port} auth={auth_method}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        connect_kwargs = {
            "hostname": hostname,
            "port": port,
            "username": username,
            "timeout": 15,
            "allow_agent": False,
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

        channel = client.invoke_shell(term="xterm-256color", width=120, height=40)
        channel.settimeout(0.1)
        log("shell channel opened")

        # Thread: read from SSH channel → stdout as base64 JSON lines
        def read_channel():
            log("read_channel thread started")
            while not channel.closed:
                try:
                    if channel.recv_ready():
                        data = channel.recv(4096)
                        if data:
                            emit_data(data)
                    else:
                        time.sleep(0.02)
                except Exception as e:
                    log(f"read_channel exception: {e}")
                    break
            log("read_channel ended")
            emit_status("disconnected")
            sys.exit(0)

        reader_thread = threading.Thread(target=read_channel, daemon=True)
        reader_thread.start()

        log("waiting for stdin input...")
        # Main thread: read raw bytes from stdin → send to SSH channel
        for line in sys.stdin:
            if channel.closed:
                log("channel closed, breaking stdin loop")
                break
            try:
                raw = base64.b64decode(line.strip())
                channel.send(raw)
            except Exception as e:
                log(f"stdin decode/send error: {e}")

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
        client.close()


if __name__ == "__main__":
    main()
