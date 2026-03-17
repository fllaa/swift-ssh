#!/usr/bin/env python3
"""
SwiftSSH SFTP sidecar — manages an SFTP session with request/response protocol.

Communication protocol:
- Receives host config via --host-json CLI arg
- Reads JSON-line commands from stdin
- Writes JSON-line responses to stdout
- Each request has an "id" field for correlation
- Progress events emitted during file transfers
"""

import argparse
import json
import os
import stat
import sys
import tempfile
import time
import traceback

import paramiko


def log(msg: str):
    """Write debug log to stderr (picked up by Rust stderr reader)."""
    sys.stderr.write(f"[sftp-sidecar] {msg}\n")
    sys.stderr.flush()


def emit(data: dict):
    """Write a JSON line to stdout."""
    sys.stdout.write(json.dumps(data) + "\n")
    sys.stdout.flush()


def emit_result(req_id: str, payload):
    """Emit a successful result for a request."""
    emit({"id": req_id, "type": "result", "payload": payload})


def emit_error(req_id: str, message: str):
    """Emit an error result for a request."""
    emit({"id": req_id, "type": "error", "payload": message})


def emit_progress(req_id: str, bytes_transferred: int, total_bytes: int):
    """Emit a transfer progress update."""
    emit({"id": req_id, "type": "progress", "payload": {"bytes": bytes_transferred, "total": total_bytes}})


def emit_status(msg: str):
    """Emit a status message (not tied to a request)."""
    emit({"type": "status", "payload": msg})
    log(f"emit_status: {msg}")


def format_permissions(mode: int) -> str:
    """Convert numeric mode to rwx string like -rw-r--r--."""
    is_dir = "d" if stat.S_ISDIR(mode) else "-"
    is_link = "l" if stat.S_ISLNK(mode) else is_dir

    perms = ""
    for who in range(2, -1, -1):
        shift = who * 3
        perms += "r" if mode & (4 << shift) else "-"
        perms += "w" if mode & (2 << shift) else "-"
        perms += "x" if mode & (1 << shift) else "-"

    return is_link + perms


def handle_ls(sftp: paramiko.SFTPClient, req_id: str, path: str):
    """List directory entries."""
    try:
        entries = []
        for attr in sftp.listdir_attr(path):
            mode = attr.st_mode or 0
            entries.append({
                "name": attr.filename,
                "size": attr.st_size or 0,
                "permissions": oct(stat.S_IMODE(mode)) if mode else "0000",
                "permStr": format_permissions(mode) if mode else "----------",
                "mtime": attr.st_mtime or 0,
                "isDir": stat.S_ISDIR(mode) if mode else False,
                "isSymlink": stat.S_ISLNK(mode) if mode else False,
            })
        emit_result(req_id, {"path": path, "entries": entries})
    except PermissionError as e:
        emit_error(req_id, f"Permission denied: {path}")
    except FileNotFoundError:
        emit_error(req_id, f"Directory not found: {path}")
    except Exception as e:
        emit_error(req_id, str(e))


def handle_download(sftp: paramiko.SFTPClient, req_id: str, remote_path: str, local_path: str):
    """Download a remote file to a local path with progress reporting."""
    try:
        # Get file size for progress
        remote_stat = sftp.stat(remote_path)
        total = remote_stat.st_size or 0

        def progress_callback(transferred, total_bytes):
            emit_progress(req_id, transferred, total_bytes)

        sftp.get(remote_path, local_path, callback=progress_callback)
        emit_result(req_id, {"localPath": local_path})
    except FileNotFoundError:
        emit_error(req_id, f"Remote file not found: {remote_path}")
    except PermissionError:
        emit_error(req_id, f"Permission denied: {remote_path}")
    except Exception as e:
        emit_error(req_id, str(e))


def handle_upload(sftp: paramiko.SFTPClient, req_id: str, local_path: str, remote_path: str):
    """Upload a local file to a remote path with progress reporting."""
    try:
        # Get local file size for progress
        total = os.path.getsize(local_path)

        def progress_callback(transferred, total_bytes):
            emit_progress(req_id, transferred, total_bytes)

        sftp.put(local_path, remote_path, callback=progress_callback)
        emit_result(req_id, {"remotePath": remote_path})
    except FileNotFoundError:
        emit_error(req_id, f"Local file not found: {local_path}")
    except PermissionError:
        emit_error(req_id, f"Permission denied")
    except Exception as e:
        emit_error(req_id, str(e))


def handle_mkdir(sftp: paramiko.SFTPClient, req_id: str, path: str):
    """Create a remote directory."""
    try:
        sftp.mkdir(path)
        emit_result(req_id, {"path": path})
    except Exception as e:
        emit_error(req_id, str(e))


def handle_rm(sftp: paramiko.SFTPClient, req_id: str, path: str):
    """Delete a remote file."""
    try:
        sftp.remove(path)
        emit_result(req_id, {"path": path})
    except Exception as e:
        emit_error(req_id, str(e))


def _rmdir_recursive(sftp: paramiko.SFTPClient, path: str):
    """Recursively delete a remote directory."""
    for attr in sftp.listdir_attr(path):
        child = path.rstrip("/") + "/" + attr.filename
        mode = attr.st_mode or 0
        if stat.S_ISDIR(mode):
            _rmdir_recursive(sftp, child)
        else:
            sftp.remove(child)
    sftp.rmdir(path)


def handle_rmdir(sftp: paramiko.SFTPClient, req_id: str, path: str):
    """Delete a remote directory recursively."""
    try:
        _rmdir_recursive(sftp, path)
        emit_result(req_id, {"path": path})
    except Exception as e:
        emit_error(req_id, str(e))


def handle_rename(sftp: paramiko.SFTPClient, req_id: str, old_path: str, new_path: str):
    """Rename/move a remote file or directory."""
    try:
        sftp.rename(old_path, new_path)
        emit_result(req_id, {"oldPath": old_path, "newPath": new_path})
    except Exception as e:
        emit_error(req_id, str(e))


def handle_chmod(sftp: paramiko.SFTPClient, req_id: str, path: str, mode: int):
    """Change permissions on a remote file."""
    try:
        sftp.chmod(path, mode)
        emit_result(req_id, {"path": path, "mode": oct(mode)})
    except Exception as e:
        emit_error(req_id, str(e))


def handle_stat(sftp: paramiko.SFTPClient, req_id: str, path: str):
    """Get file/directory info."""
    try:
        attr = sftp.stat(path)
        mode = attr.st_mode or 0
        emit_result(req_id, {
            "name": os.path.basename(path),
            "size": attr.st_size or 0,
            "permissions": oct(stat.S_IMODE(mode)) if mode else "0000",
            "permStr": format_permissions(mode) if mode else "----------",
            "mtime": attr.st_mtime or 0,
            "isDir": stat.S_ISDIR(mode) if mode else False,
            "isSymlink": stat.S_ISLNK(mode) if mode else False,
        })
    except FileNotFoundError:
        emit_error(req_id, f"Not found: {path}")
    except Exception as e:
        emit_error(req_id, str(e))


def main():
    log("sftp sidecar starting")

    parser = argparse.ArgumentParser()
    parser.add_argument("--host-json", required=True, help="JSON host profile")
    parser.add_argument("--session-id", required=True, help="Session ID")
    parser.add_argument("--key-content", default=None, help="Private key content")
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
                pkey = paramiko.RSAKey.from_private_key_file(tmp.name)
            except paramiko.ssh_exception.SSHException:
                try:
                    pkey = paramiko.Ed25519Key.from_private_key_file(tmp.name)
                except Exception:
                    pkey = paramiko.ECDSAKey.from_private_key_file(tmp.name)
            os.unlink(tmp.name)
            connect_kwargs["pkey"] = pkey
        else:
            connect_kwargs["password"] = password

        client.connect(**connect_kwargs)
        log("SSH connected, opening SFTP channel")

        sftp = client.open_sftp()
        log("SFTP channel opened")

        # Emit connected status
        emit_status("connected")

        # Get initial remote home directory
        try:
            home = sftp.normalize(".")
            log(f"remote home directory: {home}")
        except Exception:
            home = "/"

        # Main request loop — read JSON commands from stdin
        log("waiting for commands on stdin...")
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            try:
                req = json.loads(line)
            except json.JSONDecodeError as e:
                log(f"invalid JSON from stdin: {e}")
                continue

            req_id = req.get("id", "unknown")
            cmd = req.get("cmd", "")

            log(f"received cmd={cmd} id={req_id}")

            try:
                if cmd == "ls":
                    handle_ls(sftp, req_id, req.get("path", home))
                elif cmd == "download":
                    handle_download(sftp, req_id, req["remotePath"], req["localPath"])
                elif cmd == "upload":
                    handle_upload(sftp, req_id, req["localPath"], req["remotePath"])
                elif cmd == "mkdir":
                    handle_mkdir(sftp, req_id, req["path"])
                elif cmd == "rm":
                    handle_rm(sftp, req_id, req["path"])
                elif cmd == "rmdir":
                    handle_rmdir(sftp, req_id, req["path"])
                elif cmd == "rename":
                    handle_rename(sftp, req_id, req["oldPath"], req["newPath"])
                elif cmd == "chmod":
                    handle_chmod(sftp, req_id, req["path"], int(req["mode"]))
                elif cmd == "stat":
                    handle_stat(sftp, req_id, req["path"])
                elif cmd == "home":
                    emit_result(req_id, {"path": home})
                else:
                    emit_error(req_id, f"Unknown command: {cmd}")
            except KeyError as e:
                emit_error(req_id, f"Missing required field: {e}")
            except Exception as e:
                log(f"command error: {e}")
                log(traceback.format_exc())
                emit_error(req_id, str(e))

    except paramiko.AuthenticationException:
        log("Authentication failed")
        emit_status("error:Authentication failed")
    except paramiko.SSHException as e:
        log(f"SSH exception: {e}")
        emit_status(f"error:{e}")
    except Exception as e:
        log(f"Unexpected exception: {e}")
        log(traceback.format_exc())
        emit_status(f"error:{e}")
    finally:
        log("closing client")
        emit_status("disconnected")
        client.close()


if __name__ == "__main__":
    main()
