# Feature: Create a tournament that is related to another tournament

## Context
The playoff should be a sub tournament of the main tournament. For example, if we have a tournament with id 1, the playoff tournament should have a parent_id of 1.

## Goal
Add a new endpoint to the tournament controller that:
- Creates a tournament of type playoff, and has a parent_id of the main tournament
- Create the database table for sub tournaments:
    id,
    parent_id,
    tournament_name,
    description,
    starting_date,
    created_at,
    updated_at


## Requirements
- Subtournaments behave exactly like tournaments
- Subtournaments have a parent_id
- The difference with normal tournaments is that the endpoint /api/games?toFilter=333 should include the subtournament data. For example, if 333 has a child tournament 334, the endpoint should return games from both 333 and 334.
