SELECT competitor_id, eol_number, first_name, last_name, club
FROM competitors
WHERE UPPER(last_name) LIKE UPPER(? || '%')
ORDER BY last_name ASC, first_name ASC
LIMIT 300