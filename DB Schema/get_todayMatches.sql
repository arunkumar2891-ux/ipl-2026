CREATE OR REPLACE FUNCTION get_todayMatches()
  RETURNS TABLE (
  matchnumber smallint,
	team ,
  )
  LANGUAGE sql
  AS $$
  SELECT 
    f.matchnumber,
    th.shortname as home_shortname,
    ta.shortname as away_shortname
  FROM fixtures f
  JOIN teams th ON f.home = th.fullname
  JOIN teams ta ON f.away = ta.fullname
  WHERE DATE(f.dateutc::timestamp) = CURRENT_DATE
  ORDER BY f.matchnumber;
$$;