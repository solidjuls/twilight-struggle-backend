WITH ordered_player_ratings AS
(
    SELECT 
        ROW_NUMBER() OVER(PARTITION BY player_id ORDER BY rh.created_at DESC) desc_player_rating_count,
        rating,
        player_id
    FROM ratings_history rh
    INNER JOIN game_results gr ON gr.id = rh.game_result_id
    WHERE gr.game_date > DATE_SUB(NOW(), INTERVAL 2 YEAR)
)

SELECT
    users.id,
    first_name,
    last_name,
    last_login_at,
    tld_code,
    rating,
    ROW_NUMBER() OVER (ORDER BY rating DESC) AS ranking,
    COUNT(*) OVER() as total_players
FROM ordered_player_ratings
INNER JOIN users
    ON users.id = ordered_player_ratings.player_id
LEFT JOIN countries
    ON users.country_id = countries.id
WHERE desc_player_rating_count = 1
ORDER BY rating DESC
LIMIT ?
OFFSET ?;