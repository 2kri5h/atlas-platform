"""SSRF (Server-Side Request Forgery) protection utilities.

Prevents attacker-controlled outbound HTTP requests from reaching:
- Cloud instance metadata services (e.g., AWS/GCP 169.254.169.254, metadata.google.internal)
- Internal VPC / RFC-1918 private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Loopback / localhost addresses in production (127.0.0.0/8, ::1)
- Link-local, multicast, and unspecified addresses
"""

import ipaddress
import socket
import urllib.parse
from typing import Optional, Tuple


BLOCKED_HOSTNAMES = {
    "metadata.google.internal",
    "metadata.internal",
    "instance-data",
    "169.254.169.254",
}


def validate_safe_url(url: str, allow_localhost: bool = False) -> Tuple[bool, Optional[str]]:
    """
    Validate that an outbound target URL is safe to fetch.

    :param url: The target URL to test.
    :param allow_localhost: If True (e.g. dev mode), permits loopback and LAN endpoints.
    :return: (is_safe, error_message)
    """
    if not url or not isinstance(url, str):
        return False, "URL is empty or invalid."

    url = url.strip()
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception as e:
        return False, f"Invalid URL format: {e}"

    if parsed.scheme.lower() not in ("http", "https"):
        return False, f"Invalid URL scheme '{parsed.scheme}'. Only http and https are permitted."

    hostname = parsed.hostname
    if not hostname:
        return False, "URL missing valid hostname."

    hostname_lower = hostname.lower().strip(".")
    if hostname_lower in BLOCKED_HOSTNAMES:
        return False, f"Requests to '{hostname}' are blocked for security (cloud metadata protection)."

    # Resolve IP addresses for hostname
    try:
        addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as e:
        return False, f"Failed to resolve hostname '{hostname}': {e}"
    except Exception as e:
        return False, f"DNS resolution error for '{hostname}': {e}"

    if not addr_info:
        return False, f"No IP addresses resolved for hostname '{hostname}'."

    for family, socktype, proto, canonname, sockaddr in addr_info:
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            return False, f"Invalid resolved IP address '{ip_str}'."

        # Always block link-local (cloud metadata is 169.254.169.254)
        if ip.is_link_local:
            return False, f"Access to link-local address '{ip_str}' is blocked."

        if ip.is_multicast or ip.is_unspecified or ip.is_reserved:
            return False, f"Access to special/reserved address '{ip_str}' is blocked."

        if ip.is_loopback:
            if not allow_localhost:
                return False, "Access to localhost/loopback addresses is forbidden in this environment."

        if ip.is_private:
            if not allow_localhost:
                return False, f"Access to private internal network address '{ip_str}' is forbidden."

    return True, None
