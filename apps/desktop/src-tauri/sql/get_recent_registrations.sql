SELECT
  r.registration_id,
  COALESCE(c.last_name || ' ' || c.first_name,'Unknown') AS competitor_name,
  COALESCE(co.name,'Unknown course') AS course_name,
  r.price_cents,
  r.created_at_device
FROM registrations r
LEFT JOIN competitors c ON c.competitor_id = r.competitor_id
LEFT JOIN courses co ON co.course_id = r.course_id
ORDER BY r.local_seq DESC
LIMIT ?