import hashlib
from typing import Optional, List, Tuple, Any

def format_audit_ts(ts: Any) -> str:
    if hasattr(ts, "strftime"):
        return ts.strftime("%Y-%m-%d %H:%M:%S")
    s = str(ts)
    return s[:19].replace("T", " ")

def compute_audit_hash(
    ts_str: Any,
    actor: str,
    role: str,
    action: str,
    obj: str,
    detail: str,
    prev_hash: str
) -> str:
    """
    Computes cryptographic SHA-256 hash for audit chain:
    hash = SHA-256 of ts|actor|role|action|object|detail|prev_hash
    """
    clean_ts = format_audit_ts(ts_str)
    raw_payload = f"{clean_ts}|{actor}|{role}|{action}|{obj}|{detail}|{prev_hash}"
    return hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()

def verify_audit_chain(entries: List[Any]) -> Tuple[bool, Optional[int]]:
    """
    Verifies the cryptographic integrity of the entire audit chain.
    Returns: (is_intact: bool, first_broken_entry_id: Optional[int])
    """
    expected_prev = "GENESIS"
    
    for entry in entries:
        actor = entry.actor or ""
        role = entry.role or ""
        action = entry.action or ""
        obj = entry.object or ""
        detail = entry.detail or ""
        prev_hash = entry.prev_hash or ""
        current_hash = entry.hash or ""
        
        # Verify link to previous entry
        if prev_hash != expected_prev:
            return False, entry.id
            
        # Recompute hash and verify match
        recomputed = compute_audit_hash(entry.ts, actor, role, action, obj, detail, prev_hash)
        if recomputed != current_hash:
            return False, entry.id
            
        expected_prev = current_hash
        
    return True, None
