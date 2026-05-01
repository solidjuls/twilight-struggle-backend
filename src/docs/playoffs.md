# Feature: Playoff Bracket

## Context
We are building a flow to create a tournament of type playoff.

## Goal
Implement a playoff controller and service that:
- Reads an array of data from a playoffs POST endpoint
- Returns the playoff bracket from a GET endpoint (params: tournamentId)


## Requirements
- Creates a Schedule object for each matchup. The matchups are created by searching for the nextSquare value inside the array. When 2 opponents have the same nextSquare value, they are matched together.
- The due date for each matchup is calculated by adding 7 days to the current date. Use a constant so it is easy to change.
- Insert the newly created schedules to the database
- Inserts the playoff bracket data to the playoff table in the database

## Data Model
Playoff Type
    - tournamentId: number
    - nextSquare: string
    - playoffSquare: string
    - userId: number
    - seed: number


