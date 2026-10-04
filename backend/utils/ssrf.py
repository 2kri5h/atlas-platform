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
from typing import Collection, Optional, Tuple

import requests


BLOCKED_HOSTNAMES = {
    "metadata.google.internal",
    "metadata.internal",
    "instance-data",
    "169.254.169.254",
}


class UnsafeOutboundURLError(ValueError):
    """Raised when an outbound request violates the network policy."""


def validate_safe_url(
    url: str,
    allow_localhost: bool = False,
    allowed_hosts: Optional[Collection[str]] = None,
    require_https: bool = False,
) -> Tuple[bool, Optional[str]]:
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
    if require_https and parsed.scheme.lower() != "https":
        return False, "HTTPS is required for outbound requests in this environment."
    if parsed.username or parsed.password:
        return False, "Credentials embedded in endpoint URLs are not permitted."

    hostname = parsed.hostname
    if not hostname:
        return False, "URL missing valid hostname."

    hostname_lower = hostname.lower().strip(".")
    if hostname_lower in BLOCKED_HOSTNAMES:
        return False, f"Requests to '{hostname}' are blocked for security (cloud metadata protection)."
    if allowed_hosts:
        normalized = {item.lower().strip(".") for item in allowed_hosts}
        if not any(hostname_lower == item or hostname_lower.endswith(f".{item}") for item in normalized):
            return False, f"Outbound hostname '{hostname}' is not allowlisted."

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

        # Unpack IPv4-mapped IPv6 addresses (e.g. ::ffff:169.254.169.254) to their underlying IPv4
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped

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


def request_with_safe_redirects(
    method: str,
    url: str,
    *,
    allow_localhost: bool = False,
    allowed_hosts: Optional[Collection[str]] = None,
    require_https: bool = False,
    max_redirects: int = 3,
    **kwargs,
) -> requests.Response:
    """Issue a request while validating DNS and every redirect destination.

    Redirects that would rewrite a non-GET request are rejected. API credentials
    and request bodies must never be forwarded to a different destination by an
    implicit 301/302/303 method rewrite.
    """
    current_url = url
    request_method = method.upper()
    kwargs.pop("allow_redirects", None)

    for redirect_count in range(max_redirects + 1):
        is_safe, error = validate_safe_url(
            current_url,
            allow_localhost=allow_localhost,
            allowed_hosts=allowed_hosts,
            require_https=require_https,
        )
        if not is_safe:
            raise UnsafeOutboundURLError(error or "Outbound URL rejected")

        response = requests.request(request_method, current_url, allow_redirects=False, **kwargs)
        if response.status_code not in (301, 302, 303, 307, 308):
            return response

        location = response.headers.get("Location")
        response.close()
        if not location:
            raise UnsafeOutboundURLError("Provider returned a redirect without a destination.")
        if redirect_count >= max_redirects:
            raise UnsafeOutboundURLError("Provider exceeded the outbound redirect limit.")
        if request_method not in ("GET", "HEAD") and response.status_code not in (307, 308):
            raise UnsafeOutboundURLError("Provider attempted an unsafe request-method redirect.")
        current_url = urllib.parse.urljoin(current_url, location)

    raise UnsafeOutboundURLError("Provider exceeded the outbound redirect limit.")
