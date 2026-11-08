import re

# Strip dangerous script protocols while safely preserving legitimate base64 image data URIs
DANGEROUS_PROTOCOLS = re.compile(
    r'(?i)\b(?:javascript|vbscript|data:(?!image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,)):?'
)
SCRIPT_TAGS = re.compile(r'(?i)<\s*script[^>]*>[\s\S]*?<\s*/\s*script\s*>')
DANGEROUS_TAGS = re.compile(
    r'(?i)<\s*(?:iframe|object|embed|applet|meta|link|style)[^>]*>[\s\S]*?<\s*/\s*(?:iframe|object|embed|applet|meta|link|style)\s*>'
)
EVENT_HANDLERS = re.compile(r'(?i)\bon\w+\s*=\s*(?:\'[^\']*\'|"[^"]*"|[^\s>]+)')
HTML_TAGS = re.compile(r'<[^>]*>')
PASSWORD_KEY_REGEX = re.compile(
    r'(?i)(password|current_password|new_password|confirm_password|pwd|token|secret|signature)'
)
IMAGE_KEY_REGEX = re.compile(r'(?i)(image|photo|avatar|logo|cover|picture|poster|icon)')
SAFE_DATA_IMAGE_REGEX = re.compile(
    r'^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]+$'
)


def sanitize_string(val):
    """
    Cleans a string by stripping null bytes, dangerous script/protocol tags,
    and HTML markup, while trimming outer whitespace.
    """
    if not isinstance(val, str):
        return val

    # Preserve valid base64 image data URIs intact
    if SAFE_DATA_IMAGE_REGEX.match(val.strip()):
        return val.strip()

    # Strip null bytes
    clean = val.replace('\x00', '')
    # Strip dangerous protocols and script execution vectors
    clean = DANGEROUS_PROTOCOLS.sub('', clean)
    clean = SCRIPT_TAGS.sub('', clean)
    clean = DANGEROUS_TAGS.sub('', clean)
    clean = EVENT_HANDLERS.sub('', clean)
    # Strip remaining HTML tags
    clean = HTML_TAGS.sub('', clean)

    return clean.strip()


def sanitize_data(data):
    """
    Recursively traverses dictionaries, lists, and primitives,
    sanitizing all string values except sensitive credential fields (passwords)
    and valid image payloads (data URIs or URLs).
    """
    if data is None:
        return None

    if isinstance(data, str):
        return sanitize_string(data)

    if isinstance(data, list):
        return [sanitize_data(item) for item in data]

    if isinstance(data, dict):
        sanitized = {}
        for key, val in data.items():
            if isinstance(key, str):
                if PASSWORD_KEY_REGEX.search(key):
                    # Preserve password fields unmodified
                    sanitized[key] = val
                    continue
                if IMAGE_KEY_REGEX.search(key) and isinstance(val, str):
                    val_str = val.strip()
                    # Preserve safe image data URIs or standard web URLs
                    if SAFE_DATA_IMAGE_REGEX.match(val_str) or val_str.startswith(('http://', 'https://', '/')):
                        sanitized[key] = val_str
                        continue
            sanitized[key] = sanitize_data(val)
        return sanitized

    return data
