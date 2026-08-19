export interface TournamentRow {
  id: number;
  tournament_name: string;
  parent_id: number | null;
  TournamentStatus: { status_name: string } | null;
  tournament_admins: { users: { discord_user_id: bigint | null } | null }[];
}

export interface TournamentPayload {
  name: string;
  parent_external_id?: string;
  status?: string;
  admins: string[];
}

export function buildTournamentPayload(tournament: TournamentRow): TournamentPayload {
  return {
    name: tournament.tournament_name,
    ...(tournament.parent_id && { parent_external_id: String(tournament.parent_id) }),
    ...(tournament.TournamentStatus && { status: tournament.TournamentStatus.status_name }),
    admins: (tournament.tournament_admins || [])
      .map((admin) => admin.users?.discord_user_id)
      .filter((discordUserId) => discordUserId !== null && discordUserId !== undefined)
      .map(String),
  };
}
