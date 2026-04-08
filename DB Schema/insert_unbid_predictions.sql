CREATE OR REPLACE FUNCTION public.insert_unbid_predictions(
    p_matchnumber smallint,
    p_userEmail varchar
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN

-- Insert missing predictions into prediction table
INSERT INTO prediction (
    email,
    matchnumber,
    selectedvalue,
    bgroup,
    bid,
    name
)
SELECT
    m.email,
    p_matchnumber,
    'unbid',
    m.bgroup,
    m.amount,
    m.name
FROM members m

LEFT JOIN (
    SELECT email, bgroup
    FROM prediction
    WHERE matchnumber = p_matchnumber
    GROUP BY email, bgroup
) p
ON m.email = p.email
AND m.bgroup = p.bgroup

WHERE p.email IS NULL;


-- Delete previous predictions in final_prediction
DELETE FROM final_prediction
WHERE matchnumber = p_matchnumber;


-- Insert latest unique predictions into final_prediction
INSERT INTO final_prediction (
    email,
    matchnumber,
    selectedvalue,
    bgroup,
    bid,
    name,
    triggered_by
)
SELECT DISTINCT ON (email,bgroup,matchnumber)
    email,
    matchnumber,
    selectedvalue,
    bgroup,
    bid,
    name,
    p_userEmail
FROM prediction
WHERE matchnumber = p_matchnumber
ORDER BY email, bgroup, matchnumber, created_at DESC;

END;
$$;