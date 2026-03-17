import almalinux from "../assets/distros/almalinux.svg";
import alpineLinux from "../assets/distros/alpine-linux.svg";
import amazonLinux from "../assets/distros/amazon-linux-2023.svg";
import centosStream from "../assets/distros/centos-stream.svg";
import clearLinux from "../assets/distros/clear-linux.svg";
import debian from "../assets/distros/debian.svg";
import fedoraCoreos from "../assets/distros/fedora-coreos.svg";
import flatcarLinux from "../assets/distros/flatcar-linux.svg";
import kaliLinux from "../assets/distros/kali-linux.svg";
import opensuse from "../assets/distros/opensuse.svg";
import oracleLinux from "../assets/distros/oracle-linux.svg";
import rhel from "../assets/distros/rhel.svg";
import rockyLinux from "../assets/distros/rocky-linux.svg";
import suseEnterprise from "../assets/distros/suse-enterprise.svg";
import ubuntuServer from "../assets/distros/ubuntu-server.svg";

/** Map from /etc/os-release ID values to imported SVG URLs */
const DISTRO_MAP: Record<string, string> = {
  ubuntu: ubuntuServer,
  debian: debian,
  fedora: fedoraCoreos,
  coreos: fedoraCoreos,
  centos: centosStream,
  "centos-stream": centosStream,
  rhel: rhel,
  almalinux: almalinux,
  rocky: rockyLinux,
  opensuse: opensuse,
  "opensuse-leap": opensuse,
  "opensuse-tumbleweed": opensuse,
  sles: suseEnterprise,
  alpine: alpineLinux,
  amzn: amazonLinux,
  kali: kaliLinux,
  flatcar: flatcarLinux,
  ol: oracleLinux,
  "clear-linux-os": clearLinux,
};

/**
 * Given a raw /etc/os-release ID string (e.g. "ubuntu", "amzn"), returns
 * the matching SVG URL, or null if no icon is available.
 */
export function getDistroIcon(osId: string | undefined): string | null {
  if (!osId) return null;
  return DISTRO_MAP[osId.toLowerCase()] ?? null;
}

/**
 * Given a raw /etc/os-release ID, returns the canonical icon key stored
 * in the host profile (same as the input ID, lowercased).
 */
export function normalizeDistroId(osId: string): string {
  return osId.toLowerCase().trim();
}
