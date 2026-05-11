CREATE OR REPLACE FUNCTION get_bids_today(user_email text)
RETURNS TABLE (
  email text,
  selectedvalue text,
  bid double precision,
  bgroup text,
  matchnumber smallint,
  name text
)
LANGUAGE plpgsql
AS $$
BEGIN

RETURN QUERY

SELECT DISTINCT ON (p.email, p.bgroup, p.matchnumber)
  p.email,
  p.selectedvalue,
  p.bid,
  p.bgroup,
  p.matchnumber,
  p.name
FROM prediction p
JOIN fixtures f
  ON p.matchnumber = f.matchnumber
WHERE DATE(f.dateutc) = CURRENT_DATE
AND (
  f.matchstarted = 'Y'
  OR p.email = user_email
)
ORDER BY p.email, p.bgroup, p.matchnumber, p.created_at DESC;

END;
$$;
