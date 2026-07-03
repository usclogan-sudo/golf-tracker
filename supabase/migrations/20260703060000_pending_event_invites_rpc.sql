-- E3 support: a pending event invitee cannot read the events row (RLS requires an
-- accepted participant), so the client can't join event_participants -> events for
-- display. This SECURITY DEFINER RPC returns the caller's own pending event invites
-- with the event name + round, for the "Pending invites" surface. Accept/decline
-- still goes through respond_to_event_invite(event_id, accept).

begin;

create or replace function public.get_my_pending_event_invites()
  returns jsonb
  language plpgsql security definer stable
  as $$
  declare
    v_caller uuid := auth.uid();
    v_result jsonb;
  begin
    if v_caller is null then
      raise exception 'Not authenticated';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'event_id', ep.event_id,
      'event_name', e.name,
      'round_id', e.round_id,
      'player_id', ep.player_id,
      'invited_at', ep.invited_at
    ) order by ep.invited_at desc nulls last), '[]'::jsonb)
    into v_result
    from event_participants ep
    join events e on e.id = ep.event_id
    where ep.user_id = v_caller and ep.status = 'pending';
    return v_result;
  end;
  $$;

commit;
