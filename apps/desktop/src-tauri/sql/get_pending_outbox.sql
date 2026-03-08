SELECT
  local_seq,
  item_type,
  payload AS payload_text,
  created_at,
  status
FROM outbox
WHERE local_seq > ? AND status='pending'
ORDER BY local_seq ASC