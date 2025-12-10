WITH ordered_player_ratings AS
(
    SELECT 
        ROW_NUMBER() OVER(PARTITION BY player_id ORDER BY created_at DESC) desc_player_rating_count,
        rating,
        player_id
    FROM ratings_history
)

, get_all_player_rankings AS
(
    SELECT
        users.id,
        first_name,
        last_name,
        last_login_at,
        tld_code,
        rating,
        ROW_NUMBER() OVER (ORDER BY rating DESC) AS ranking,
        COUNT(*) OVER() as total_players
    FROM users
    LEFT JOIN ordered_player_ratings
        ON users.id = ordered_player_ratings.player_id
    LEFT JOIN countries
        ON users.country_id = countries.id
    WHERE (desc_player_rating_count = 1 OR desc_player_rating_count IS NULL)
)

SELECT 
    *,
    TRUE AS is_truncated
FROM get_all_player_rankings
WHERE FIND_IN_SET (id, ?)
ORDER BY rating DESC
LIMIT ?
OFFSET ?;