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

-- Case 1: Match within 15 minutes or already started → show all bids
IF EXISTS (
  SELECT 1
  FROM fixtures f
  WHERE DATE(f.dateutc) = CURRENT_DATE
  AND CURRENT_TIMESTAMP >= (f.dateutc - INTERVAL '15 minutes')
) THEN

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
  ORDER BY p.email, p.bgroup, p.matchnumber, p.created_at DESC;

-- Case 2: Match not yet within 15 minutes → show only the user's bids
ELSE

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
  AND p.email = user_email
  ORDER BY p.email, p.bgroup, p.matchnumber, p.created_at DESC;

END IF;

END;
$$;