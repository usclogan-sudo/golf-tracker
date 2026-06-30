--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: admin_create_user(text, text, text, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_create_user(user_email text, user_password text, user_display_name text DEFAULT NULL::text, user_handicap double precision DEFAULT NULL::double precision) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'extensions', 'public', 'auth'
    AS $$
  DECLARE
    new_user_id uuid := gen_random_uuid();
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(user_email)) THEN
      RAISE EXCEPTION 'Email already registered';
    END IF;

    -- Insert auth user
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_token, recovery_token,
      email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at
    ) VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated', 'authenticated',
      lower(user_email),
      crypt(user_password, gen_salt('bf')),
      now(), '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false, now(), now()
    );

    -- Insert auth identity (required for login)
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', lower(user_email)),
      'email',
      new_user_id::text,
      now(), now(), now()
    );

    -- Create user profile
    INSERT INTO public.user_profiles (
      user_id, is_admin, admin_only, onboarding_complete, display_name, handicap_index, tee
    ) VALUES (
      new_user_id, false, false, false, user_display_name, user_handicap, 'White'
    );

    RETURN new_user_id;
  END;
  $$;


--
-- Name: admin_delete_round(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_round(target_round_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    DELETE FROM hole_scores WHERE round_id = target_round_id;
    DELETE FROM round_players WHERE round_id = target_round_id;
    DELETE FROM buy_ins WHERE round_id = target_round_id;
    DELETE FROM bbb_points WHERE round_id = target_round_id;
    DELETE FROM settlements WHERE round_id = target_round_id;
    DELETE FROM junk_records WHERE round_id = target_round_id;
    DELETE FROM side_bets WHERE round_id = target_round_id;
    DELETE FROM round_participants WHERE round_id = target_round_id;
    DELETE FROM notifications WHERE round_id = target_round_id;
    DELETE FROM rounds WHERE id = target_round_id;
  END;
  $$;


--
-- Name: admin_delete_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_user(target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    round_ids uuid[];
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    IF target_user_id = auth.uid() THEN
      RAISE EXCEPTION 'Cannot delete your own account from admin panel';
    END IF;
    SELECT array_agg(id) INTO round_ids FROM rounds WHERE user_id = target_user_id;
    IF round_ids IS NOT NULL THEN
      DELETE FROM hole_scores WHERE round_id = ANY(round_ids);
      DELETE FROM round_players WHERE round_id = ANY(round_ids);
      DELETE FROM buy_ins WHERE round_id = ANY(round_ids);
      DELETE FROM bbb_points WHERE round_id = ANY(round_ids);
      DELETE FROM settlements WHERE round_id = ANY(round_ids);
      DELETE FROM junk_records WHERE round_id = ANY(round_ids);
      DELETE FROM side_bets WHERE round_id = ANY(round_ids);
      DELETE FROM round_participants WHERE round_id = ANY(round_ids);
      DELETE FROM notifications WHERE round_id = ANY(round_ids);
      DELETE FROM rounds WHERE user_id = target_user_id;
    END IF;
    DELETE FROM courses WHERE user_id = target_user_id;
    DELETE FROM players WHERE user_id = target_user_id;
    DELETE FROM notifications WHERE user_id = target_user_id;
    DELETE FROM user_profiles WHERE user_id = target_user_id;
    DELETE FROM auth.users WHERE id = target_user_id;
  END;
  $$;


--
-- Name: admin_get_all_players(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_all_players() RETURNS TABLE(id text, user_id uuid, name text, handicap_index double precision, tee text, ghin_number text, is_public boolean, venmo_username text, zelle_identifier text, cashapp_username text, paypal_email text, created_at timestamp with time zone, owner_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    RETURN QUERY
      SELECT p.id, p.user_id, p.name, p.handicap_index, p.tee,
        p.ghin_number, COALESCE(p.is_public, false), p.venmo_username,
        p.zelle_identifier, p.cashapp_username, p.paypal_email,
        p.created_at,
        COALESCE(up.display_name, 'Unknown') AS owner_name
      FROM players p
      LEFT JOIN user_profiles up ON p.user_id = up.user_id
      ORDER BY p.name;
  END;
  $$;


--
-- Name: admin_get_all_rounds(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_all_rounds() RETURNS TABLE(id uuid, course_id uuid, date timestamp with time zone, status text, current_hole integer, players jsonb, game jsonb, course_snapshot jsonb, created_by uuid, user_id uuid, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    RETURN QUERY SELECT r.id, r.course_id, r.date, r.status, r.current_hole,
      r.players, r.game, r.course_snapshot, r.created_by, r.user_id, r.created_at
    FROM rounds r ORDER BY r.date DESC;
  END;
  $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    user_id uuid NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    onboarding_complete boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    display_name text,
    handicap_index double precision,
    tee text DEFAULT 'White'::text NOT NULL,
    venmo_username text,
    zelle_identifier text,
    cashapp_username text,
    paypal_email text,
    preferred_payment text,
    avatar_url text,
    avatar_preset text,
    admin_only boolean DEFAULT false NOT NULL
);


--
-- Name: admin_get_all_users(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_all_users() RETURNS SETOF public.user_profiles
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    RETURN QUERY SELECT * FROM user_profiles ORDER BY display_name;
  END;
  $$;


--
-- Name: admin_get_system_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_system_stats() RETURNS TABLE(total_users bigint, total_rounds bigint, total_courses bigint, total_active_rounds bigint, total_completed_rounds bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    RETURN QUERY SELECT
      (SELECT count(*) FROM user_profiles) AS total_users,
      (SELECT count(*) FROM rounds) AS total_rounds,
      (SELECT count(*) FROM shared_courses) AS total_courses,
      (SELECT count(*) FROM rounds WHERE status = 'active') AS total_active_rounds,
      (SELECT count(*) FROM rounds WHERE status = 'complete') AS total_completed_rounds;
  END;
  $$;


--
-- Name: admin_get_user_details(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_user_details(target_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'admin_get_user_details: not authenticated';
  END IF;

  SELECT is_admin INTO v_is_admin
  FROM public.user_profiles
  WHERE user_id = auth.uid();

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'admin_get_user_details: caller is not an admin';
  END IF;

  INSERT INTO public.admin_audit_log (
    admin_user_id, action, target_type, target_id, target_label
  )
  VALUES (
    auth.uid(),
    'view_user_details',
    'user',
    target_user_id::text,
    (SELECT display_name FROM public.user_profiles WHERE user_id = target_user_id)
  );

  SELECT jsonb_build_object(
    'profile', (
      SELECT to_jsonb(up.*)
      FROM public.user_profiles up
      WHERE up.user_id = target_user_id
    ),
    'recent_rounds', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',           r.id,
          'date',         r.date,
          'status',       r.status,
          'course_name',  r.course_snapshot->>'courseName',
          'player_count', COALESCE(jsonb_array_length(r.players), 0),
          'game_type',    r.game->>'type'
        )
        ORDER BY r.date DESC
      )
      FROM (
        SELECT id, date, status, course_snapshot, players, game
        FROM public.rounds
        WHERE user_id = target_user_id
        ORDER BY date DESC
        LIMIT 10
      ) r
    ), '[]'::jsonb),
    'feedback_count', (
      SELECT COUNT(*)::int
      FROM public.feedback_reports
      WHERE user_id = target_user_id
    ),
    'recent_feedback', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',          f.id,
          'category',    f.category,
          'message',     f.message,
          'status',      f.status,
          'app_version', f.app_version,
          'created_at',  f.created_at
        )
        ORDER BY f.created_at DESC
      )
      FROM (
        SELECT id, category, message, status, app_version, created_at
        FROM public.feedback_reports
        WHERE user_id = target_user_id
        ORDER BY created_at DESC
        LIMIT 5
      ) f
    ), '[]'::jsonb),
    'admin_actions_on_user', (
      SELECT COUNT(*)::int
      FROM public.admin_audit_log
      WHERE target_type = 'user' AND target_id = target_user_id::text
    )
  ) INTO v_result;

  RETURN v_result;
END
$$;


--
-- Name: admin_send_broadcast(text, text, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_send_broadcast(p_title text, p_body text DEFAULT NULL::text, p_target_user_ids uuid[] DEFAULT NULL::uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin   BOOLEAN;
  v_audience   UUID[];
  v_inserted   INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'admin_send_broadcast: not authenticated';
  END IF;

  SELECT is_admin INTO v_is_admin
  FROM public.user_profiles
  WHERE user_id = auth.uid();

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'admin_send_broadcast: caller is not an admin';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'admin_send_broadcast: title is required';
  END IF;

  IF p_target_user_ids IS NULL OR array_length(p_target_user_ids, 1) IS NULL THEN
    SELECT array_agg(user_id) INTO v_audience
    FROM public.user_profiles
    WHERE onboarding_complete = true;
  ELSE
    v_audience := p_target_user_ids;
  END IF;

  IF v_audience IS NULL OR array_length(v_audience, 1) IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notifications (id, user_id, type, title, body, read)
  SELECT gen_random_uuid(), uid, 'broadcast', p_title, p_body, false
  FROM unnest(v_audience) AS uid;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  INSERT INTO public.admin_audit_log (
    admin_user_id, action, target_type, target_label, metadata
  )
  VALUES (
    auth.uid(),
    'send_broadcast',
    'broadcast',
    p_title,
    jsonb_build_object(
      'recipient_count', v_inserted,
      'targeted',        p_target_user_ids IS NOT NULL,
      'body_length',     COALESCE(length(p_body), 0)
    )
  );

  RETURN v_inserted;
END
$$;


--
-- Name: admin_set_user_admin(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_user_admin(target_user_id uuid, make_admin boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND is_admin = true
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    IF target_user_id = auth.uid() AND make_admin = false THEN
      RAISE EXCEPTION 'Cannot remove your own admin access';
    END IF;
    PERFORM set_config('app.admin_bypass', 'true', true);
    UPDATE user_profiles SET is_admin = make_admin WHERE user_id = target_user_id;
    PERFORM set_config('app.admin_bypass', 'false', true);
  END;
  $$;


--
-- Name: admin_update_player(text, text, double precision, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_player(target_player_id text, new_name text DEFAULT NULL::text, new_handicap double precision DEFAULT NULL::double precision, new_tee text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    UPDATE players SET
      name = COALESCE(new_name, name),
      handicap_index = COALESCE(new_handicap, handicap_index),
      tee = COALESCE(new_tee, tee)
    WHERE id = target_player_id;
  END;
  $$;


--
-- Name: admin_update_user_profile(uuid, text, double precision, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_user_profile(target_user_id uuid, new_display_name text DEFAULT NULL::text, new_handicap double precision DEFAULT NULL::double precision, new_venmo text DEFAULT NULL::text, new_zelle text DEFAULT NULL::text, new_cashapp text DEFAULT NULL::text, new_paypal text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    UPDATE user_profiles SET
      display_name = COALESCE(new_display_name, display_name),
      handicap_index = COALESCE(new_handicap, handicap_index),
      venmo_username = COALESCE(new_venmo, venmo_username),
      zelle_identifier = COALESCE(new_zelle, zelle_identifier),
      cashapp_username = COALESCE(new_cashapp, cashapp_username),
      paypal_email = COALESCE(new_paypal, paypal_email)
    WHERE user_id = target_user_id;
  END;
  $$;


--
-- Name: approve_score(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_score(p_score_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    v_round_id text;
    v_event_id text;
    v_role text;
    v_caller uuid := auth.uid();
    v_score_player_id text;
    v_score_group int;
    v_caller_group int;
  BEGIN
    IF v_caller IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;
    SELECT round_id, player_id INTO v_round_id, v_score_player_id
    FROM hole_scores WHERE id = p_score_id;
    SELECT event_id INTO v_event_id FROM rounds WHERE id = v_round_id;
    IF v_event_id IS NULL THEN
      RAISE EXCEPTION 'Round is not part of an event';
    END IF;
    SELECT role, group_number INTO v_role, v_caller_group
    FROM event_participants
    WHERE event_id = v_event_id AND user_id = v_caller;
    IF v_role NOT IN ('manager', 'scorekeeper') THEN
      RAISE EXCEPTION 'Only managers and scorekeepers can approve scores';
    END IF;
    IF v_role = 'scorekeeper' THEN
      SELECT group_number INTO v_score_group
      FROM event_participants
      WHERE event_id = v_event_id AND player_id = v_score_player_id;
      IF v_score_group IS DISTINCT FROM v_caller_group THEN
        RAISE EXCEPTION 'Scorekeepers can only approve scores in their group';
      END IF;
    END IF;
    UPDATE hole_scores SET score_status = 'approved' WHERE id = p_score_id;
  END;
  $$;


--
-- Name: check_invite_rate_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_invite_rate_limit() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                                                                                                                                                                        
  DECLARE                                                          
    v_caller uuid := auth.uid();                                                                                                                                                                               
    v_minute_count int;                                                         
    v_hour_count int;                                                                                                                                                                                          
  BEGIN                                                                         
    IF v_caller IS NULL THEN                                                                                                                                                                                   
      RAISE EXCEPTION 'Not authenticated';                                      
    END IF;                                                                                                                                                                                                    
                                                                   
    SELECT count(*) INTO v_minute_count                                                                                                                                                                        
    FROM invite_attempts                                                        
    WHERE user_id = v_caller AND attempted_at > now() - interval '1 minute';                                                                                                                                   
                                                
    IF v_minute_count >= 10 THEN                                                                                                                                                                               
      RAISE EXCEPTION 'rate_limit_minute' USING ERRCODE = 'P0001';                                                                                                                                             
    END IF;                                                                   
                                                                                                                                                                                                               
    SELECT count(*) INTO v_hour_count                                           
    FROM invite_attempts                                           
    WHERE user_id = v_caller AND attempted_at > now() - interval '1 hour';                                                                                                                                     
                                                                   
    IF v_hour_count >= 30 THEN                                                                                                                                                                                 
      RAISE EXCEPTION 'rate_limit_hour' USING ERRCODE = 'P0001';                
    END IF;                                                                                                                                                                                                    
                                                                                
    INSERT INTO invite_attempts (user_id) VALUES (v_caller);                                                                                                                                                   
                                                                                
    IF random() < 0.05 THEN                                                   
      DELETE FROM invite_attempts WHERE attempted_at < now() - interval '1 hour';                                                                                                                              
    END IF;                                                                   
  END;                                                                                                                                                                                                         
  $$;


--
-- Name: delete_own_round(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_own_round(p_round_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$                                                                                                                                                                                                        
  DECLARE                                                          
    v_caller uuid := auth.uid();                                                                                                                                                                               
  BEGIN                                                                         
    IF v_caller IS NULL THEN                                                                                                                                                                                   
      RAISE EXCEPTION 'Not authenticated';
    END IF;                                                                                                                                                                                                    
                                                                                
    IF NOT EXISTS (SELECT 1 FROM rounds WHERE id = p_round_id AND user_id = v_caller) THEN
      RAISE EXCEPTION 'Not authorized to delete this round';
    END IF;                  
                                                                                                                                                                                                               
    DELETE FROM hole_scores WHERE round_id = p_round_id;                      
    DELETE FROM round_players WHERE round_id = p_round_id;                                                                                                                                                     
    DELETE FROM buy_ins WHERE round_id = p_round_id;                            
    DELETE FROM bbb_points WHERE round_id = p_round_id;            
    DELETE FROM settlements WHERE round_id = p_round_id;                                                                                                                                                       
    DELETE FROM side_bets WHERE round_id = p_round_id;
    DELETE FROM round_participants WHERE round_id = p_round_id;                                                                                                                                                
    DELETE FROM notifications WHERE round_id = p_round_id;                      
                                                                                                                                                                                                               
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'junk_records') THEN
      EXECUTE 'DELETE FROM junk_records WHERE round_id = $1' USING p_round_id;
    END IF;                                                                                                                                                                                                    
                                                                   
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prop_wagers') THEN                                                                                                                  
      EXECUTE 'DELETE FROM prop_wagers WHERE round_id = $1' USING p_round_id;   
    END IF;                                                                                                                                                                                                    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prop_bets') THEN
      EXECUTE 'DELETE FROM prop_bets WHERE round_id = $1' USING p_round_id;                                                                                                                                    
    END IF;                                                                     
                                                                                                                                                                                                               
    DECLARE                                                                     
      v_event_id text;                                                                                                                                                                                         
    BEGIN                                                          
      SELECT event_id INTO v_event_id FROM rounds WHERE id = p_round_id;                                                                                                                                       
      IF v_event_id IS NOT NULL THEN                                            
        DELETE FROM event_participants WHERE event_id = v_event_id;                                                                                                                                            
        DELETE FROM events WHERE id = v_event_id;                               
      END IF;                                                                                                                                                                                                  
    END;                                                                        
                                                                              
    DELETE FROM rounds WHERE id = p_round_id;                                                                                                                                                                  
  END;                       
  $_$;


--
-- Name: delete_round_cascade(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_round_cascade(p_round_id text, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
  BEGIN
    -- Verify ownership
    IF NOT EXISTS (SELECT 1 FROM rounds WHERE id = p_round_id AND user_id = p_user_id) THEN
      RAISE EXCEPTION 'Not authorized to delete this round';
    END IF;

    DELETE FROM prop_wagers WHERE round_id = p_round_id;
    DELETE FROM prop_bets WHERE round_id = p_round_id;
    DELETE FROM hole_scores WHERE round_id = p_round_id;
    DELETE FROM round_players WHERE round_id = p_round_id;
    DELETE FROM buy_ins WHERE round_id = p_round_id;
    DELETE FROM bbb_points WHERE round_id = p_round_id;
    DELETE FROM settlements WHERE round_id = p_round_id;
    DELETE FROM side_bets WHERE round_id = p_round_id;
    DELETE FROM round_participants WHERE round_id = p_round_id;
    DELETE FROM notifications WHERE round_id = p_round_id;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'junk_records') THEN
      EXECUTE 'DELETE FROM junk_records WHERE round_id = $1' USING p_round_id;
    END IF;

    DELETE FROM rounds WHERE id = p_round_id AND user_id = p_user_id;
  END;
  $_$;


--
-- Name: get_event_by_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_event_by_invite(p_invite_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE                                                                                                                                                                                                      
    v_event record;                                                                                                                                                                                            
    v_round jsonb;                                                            
    v_participants jsonb;                                                                                                                                                                                      
  BEGIN                                                                         
    IF auth.uid() IS NULL THEN                                                
      RAISE EXCEPTION 'Not authenticated';                                                                                                                                                                     
    END IF;                                     
                                                                                                                                                                                                               
    PERFORM check_invite_rate_limit();                                                                                                                                                                         
                                                                              
    SELECT * INTO v_event FROM events                                                                                                                                                                          
    WHERE invite_code = upper(trim(p_invite_code)) AND status != 'complete';    
                             
    IF v_event IS NULL THEN                                                                                                                                                                                    
      RAISE EXCEPTION 'Event not found or no longer active';                  
    END IF;                                                                                                                                                                                                    
                                                                                
    SELECT jsonb_build_object(                                     
      'id', r.id,                                                                                                                                                                                              
      'course_snapshot', r.course_snapshot,
      'game', r.game,                                                                                                                                                                                          
      'players', r.players,                                                     
      'current_hole', r.current_hole,                                                                                                                                                                          
      'groups', r.groups                                                        
    ) INTO v_round                                      
    FROM rounds r WHERE r.id = v_event.round_id;                                                                                                                                                               
                                                                   
    SELECT coalesce(jsonb_agg(jsonb_build_object(                                                                                                                                                              
      'id', ep.id,                                                              
      'user_id', ep.user_id,                                                                                                                                                                                   
      'player_id', ep.player_id,                                              
      'role', ep.role,                                                                                                                                                                                         
      'group_number', ep.group_number                                           
    )), '[]'::jsonb) INTO v_participants                                      
    FROM event_participants ep WHERE ep.event_id = v_event.id;                                                                                                                                                 
                             
    RETURN jsonb_build_object(                                                                                                                                                                                 
      'id', v_event.id,                                                                                                                                                                                        
      'name', v_event.name,                                        
      'status', v_event.status,                                                                                                                                                                                
      'round', v_round,                                                         
      'participants', v_participants,                                                                                                                                                                          
      'group_scorekeepers', v_event.group_scorekeepers
    );                                                                                                                                                                                                         
  END;                                                                          
  $$;


--
-- Name: get_round_by_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_round_by_invite(p_invite_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                                         
  DECLARE                                                                                                                                                                                                      
    v_round record;                                                
    v_participants jsonb;                                                                                                                                                                                      
  BEGIN                                                                         
    IF auth.uid() IS NULL THEN                                                                                                                                                                                 
      RAISE EXCEPTION 'Not authenticated';
    END IF;                                                                                                                                                                                                    
                                                                                                                                                                                                               
    PERFORM check_invite_rate_limit();                             
                                                                                                                                                                                                               
    SELECT * INTO v_round FROM rounds WHERE invite_code = p_invite_code AND status = 'active';
    IF NOT FOUND THEN                                                                                                                                                                                          
      RAISE EXCEPTION 'Round not found or no longer active';       
    END IF;                                                                                                                                                                                                    
                                                                                
    SELECT COALESCE(jsonb_agg(jsonb_build_object(                                                                                                                                                              
      'id', rp.id,                                      
      'round_id', rp.round_id,                                                                                                                                                                                 
      'user_id', rp.user_id,                                                                                                                                                                                   
      'player_id', rp.player_id,
      'joined_at', rp.joined_at                                                                                                                                                                                
    )), '[]'::jsonb) INTO v_participants                                                                                                                                                                       
    FROM round_participants rp WHERE rp.round_id = v_round.id;     
                                                                                                                                                                                                               
    RETURN jsonb_build_object(                                                  
      'id', v_round.id,                                                                                                                                                                                        
      'course_id', v_round.course_id,                   
      'date', v_round.date,                                                                                                                                                                                    
      'status', v_round.status,                                                                                                                                                                                
      'current_hole', v_round.current_hole,     
      'course_snapshot', v_round.course_snapshot,                                                                                                                                                              
      'game', v_round.game,                                                                                                                                                                                    
      'players', v_round.players,                                             
      'game_master_id', v_round.game_master_id,                                                                                                                                                                
      'user_id', v_round.user_id,                                               
      'participants', v_participants                                          
    );                                                                                                                                                                                                         
  END;                                                  
  $$;


--
-- Name: is_round_owner(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_round_owner(rid text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    SELECT EXISTS (SELECT 1 FROM rounds WHERE id = rid AND user_id = auth.uid());
  $$;


--
-- Name: is_round_participant(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_round_participant(rid text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$                                                                                                                                                   
    SELECT EXISTS (SELECT 1 FROM round_participants WHERE round_id = rid AND user_id = auth.uid());                                                                                                          
  $$;


--
-- Name: join_event(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_event(p_invite_code text, p_player_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                                                                              
  DECLARE                                                                                                                                                                                                      
    v_event record;                                                                                                                                                                                            
    v_round record;                                                                                                                                                                                            
    v_existing record;                                                          
    v_group_number int;                                                                                                                                                                                        
    v_participant_id text;                                                      
    v_caller uuid := auth.uid();                                                                                                                                                                               
    v_role text := 'player';                            
    v_sk_player_id text;                                                                                                                                                                                       
  BEGIN                                                                         
    IF v_caller IS NULL THEN                                                                                                                                                                                   
      RAISE EXCEPTION 'Not authenticated';                               
    END IF;                                                                                                                                                                                                    
                                                                                
    SELECT * INTO v_event FROM events                   
    WHERE invite_code = upper(trim(p_invite_code)) AND status != 'complete';                                                                                                                                   
                                                                         
    IF v_event IS NULL THEN                                                                                                                                                                                    
      RAISE EXCEPTION 'Event not found or no longer active';                    
    END IF;                                                                                                                                                                                                    
                                                                                
    SELECT * INTO v_existing FROM event_participants                     
    WHERE event_id = v_event.id AND user_id = v_caller;                                                                                                                                                        
                             
    IF v_existing IS NOT NULL THEN                                                                                                                                                                             
      IF v_existing.player_id != p_player_id THEN                               
        UPDATE event_participants SET player_id = p_player_id WHERE id = v_existing.id;                                                                                                                        
      END IF;                                                                                                                                                                                                  
      RETURN jsonb_build_object('event_id', v_event.id, 'round_id', v_event.round_id, 'participant_id', v_existing.id);
    END IF;                                                                                                                                                                                                    
                                                                                
    SELECT * INTO v_existing FROM event_participants                                                                                                                                                           
    WHERE event_id = v_event.id AND player_id = p_player_id AND user_id != v_caller;
                                                                                                                                                                                                               
    IF v_existing IS NOT NULL THEN                                              
      RAISE EXCEPTION 'Player already claimed by another user';                                                                                                                                                
    END IF;                                     
                                                                                                                                                                                                               
    SELECT r.groups->p_player_id INTO v_group_number                                                                                                                                                           
    FROM rounds r WHERE r.id = v_event.round_id;                                                                                                                                                               
                                                                                                                                                                                                               
    IF v_event.group_scorekeepers IS NOT NULL AND v_group_number IS NOT NULL THEN                                                                                                                              
      v_sk_player_id := v_event.group_scorekeepers->>v_group_number::text;
      IF v_sk_player_id = p_player_id THEN                                                                                                                                                                     
        v_role := 'scorekeeper';                                                                                                                                                                               
      END IF;                                                            
    END IF;                                                                                                                                                                                                    
                                                                                
    v_participant_id := gen_random_uuid()::text;                                                                                                                                                               
    INSERT INTO event_participants (id, event_id, user_id, player_id, role, group_number)                                                                                                                      
    VALUES (v_participant_id, v_event.id, v_caller, p_player_id, v_role, v_group_number);
                                                                                                                                                                                                               
    INSERT INTO round_participants (id, user_id, round_id, player_id)           
    VALUES (gen_random_uuid()::text, v_caller, v_event.round_id, p_player_id)                                                                                                                                  
    ON CONFLICT (round_id, user_id) DO NOTHING;                                 
                                                                                                                                                                                                               
    RETURN jsonb_build_object('event_id', v_event.id, 'round_id', v_event.round_id, 'participant_id', v_participant_id, 'role', v_role);
  END;                                          
  $$;


--
-- Name: join_round(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_round(p_invite_code text, p_player_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    v_round record;
    v_caller uuid := auth.uid();
    v_players jsonb;
    v_player_exists boolean;
    v_already_claimed record;
    v_participant_id text;
  BEGIN
    IF v_caller IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;
    SELECT * INTO v_round FROM rounds WHERE invite_code = p_invite_code AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Round not found or no longer active';
    END IF;
    v_players := v_round.players;
    SELECT EXISTS(
      SELECT 1 FROM jsonb_array_elements(v_players) elem
      WHERE elem->>'id' = p_player_id
    ) INTO v_player_exists;
    IF NOT v_player_exists THEN
      RAISE EXCEPTION 'Player not found in this round';
    END IF;
    SELECT * INTO v_already_claimed FROM round_participants
    WHERE round_id = v_round.id AND player_id = p_player_id AND user_id != v_caller;
    IF FOUND THEN
      RAISE EXCEPTION 'This player is already claimed by another user';
    END IF;
    v_participant_id := gen_random_uuid()::text;
    INSERT INTO round_participants (id, round_id, user_id, player_id)
    VALUES (v_participant_id, v_round.id, v_caller, p_player_id)
    ON CONFLICT (round_id, user_id) DO UPDATE SET player_id = EXCLUDED.player_id;
    RETURN jsonb_build_object(
      'round_id', v_round.id,
      'participant_id', v_participant_id,
      'player_id', p_player_id
    );
  END;
  $$;


--
-- Name: log_admin_action(text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_admin_action(p_action text, p_target_type text DEFAULT NULL::text, p_target_id text DEFAULT NULL::text, p_target_label text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_log_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'log_admin_action: not authenticated';
  END IF;

  SELECT is_admin INTO v_is_admin
  FROM public.user_profiles
  WHERE user_id = auth.uid();

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'log_admin_action: caller is not an admin';
  END IF;

  INSERT INTO public.admin_audit_log (
    admin_user_id, action, target_type, target_id, target_label, metadata
  )
  VALUES (
    auth.uid(), p_action, p_target_type, p_target_id, p_target_label,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END
$$;


--
-- Name: player_report_buyin(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.player_report_buyin(p_round_id uuid, p_player_id text, p_method text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM round_participants
      WHERE round_id = p_round_id AND player_id = p_player_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Not authorized — you are not this player in this round';
    END IF;
    UPDATE buy_ins
    SET method = p_method,
        player_reported_at = now()
    WHERE round_id = p_round_id AND player_id = p_player_id;
  END;
  $$;


--
-- Name: player_report_settlement(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.player_report_settlement(p_settlement_id text, p_method text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    v_round_id text;
    v_from_player_id text;
  BEGIN
    -- Get settlement details
    SELECT round_id, from_player_id
    INTO v_round_id, v_from_player_id
    FROM settlements
    WHERE id = p_settlement_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Settlement not found';
    END IF;

    -- Verify caller owns this player slot via round_participants
    IF NOT EXISTS (
      SELECT 1 FROM round_participants
      WHERE round_id = v_round_id AND player_id = v_from_player_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Not authorized — you are not the payer in this settlement';
    END IF;

    -- Update the settlement: set method + player_reported_at timestamp
    UPDATE settlements
    SET reported_method = p_method,
        player_reported_at = now()
    WHERE id = p_settlement_id;
  END;
  $$;


--
-- Name: prevent_admin_self_promote(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_admin_self_promote() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    IF current_setting('app.admin_bypass', true) = 'true' THEN
      RETURN NEW;
    END IF;
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Cannot modify admin status';
    END IF;
    IF NEW.admin_only IS DISTINCT FROM OLD.admin_only THEN
      RAISE EXCEPTION 'Cannot modify admin_only status';
    END IF;
    RETURN NEW;
  END;
  $$;


--
-- Name: reject_score(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_score(p_score_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    v_round_id text;
    v_event_id text;
    v_role text;
    v_caller uuid := auth.uid();
    v_score_player_id text;
    v_score_group int;
    v_caller_group int;
  BEGIN
    IF v_caller IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;
    SELECT round_id, player_id INTO v_round_id, v_score_player_id
    FROM hole_scores WHERE id = p_score_id;
    SELECT event_id INTO v_event_id FROM rounds WHERE id = v_round_id;
    IF v_event_id IS NULL THEN
      RAISE EXCEPTION 'Round is not part of an event';
    END IF;
    SELECT role, group_number INTO v_role, v_caller_group
    FROM event_participants
    WHERE event_id = v_event_id AND user_id = v_caller;
    IF v_role NOT IN ('manager', 'scorekeeper') THEN
      RAISE EXCEPTION 'Only managers and scorekeepers can reject scores';
    END IF;
    IF v_role = 'scorekeeper' THEN
      SELECT group_number INTO v_score_group
      FROM event_participants
      WHERE event_id = v_event_id AND player_id = v_score_player_id;
      IF v_score_group IS DISTINCT FROM v_caller_group THEN
        RAISE EXCEPTION 'Scorekeepers can only reject scores in their group';
      END IF;
    END IF;
    UPDATE hole_scores SET score_status = 'rejected' WHERE id = p_score_id;
  END;
  $$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: send_round_invite_notifications(uuid, text, text, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_round_invite_notifications(p_round_id uuid, p_invite_code text, p_course_name text, p_creator_name text, p_player_ids text[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    pid text;
    pid_uuid uuid;
    sent int := 0;
  BEGIN
    FOREACH pid IN ARRAY p_player_ids
    LOOP
      -- Try casting to uuid; skip if invalid
      BEGIN
        pid_uuid := pid::uuid;
      EXCEPTION WHEN others THEN
        CONTINUE;
      END;

      -- Skip the caller (round creator)
      IF pid_uuid = auth.uid() THEN
        CONTINUE;
      END IF;

      -- Only notify registered users (those with a user_profiles row)
      IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = pid_uuid) THEN
        CONTINUE;
      END IF;

      -- Idempotency: skip if notification already exists for this round+user
      IF EXISTS (
        SELECT 1 FROM notifications
        WHERE round_id = p_round_id AND user_id = pid_uuid AND type = 'round_invite'
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO notifications (id, user_id, type, title, body, round_id, invite_code, read, created_at)
      VALUES (
        gen_random_uuid(),
        pid_uuid,
        'round_invite',
        p_creator_name || ' invited you to play at ' || p_course_name,
        'Tap Join to enter the round',
        p_round_id,
        p_invite_code,
        false,
        now()
      );
      sent := sent + 1;
    END LOOP;

    RETURN sent;
  END;
  $$;


--
-- Name: send_round_invite_notifications(uuid, text, text, text, text[], text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_round_invite_notifications(p_round_id uuid, p_invite_code text, p_course_name text, p_creator_name text, p_player_ids text[], p_game_type text DEFAULT NULL::text, p_buy_in_cents integer DEFAULT 0, p_player_count integer DEFAULT 0) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
  DECLARE
    pid text;
    pid_uuid uuid;
    sent int := 0;
    v_body text;
  BEGIN
    -- Build richer notification body
    IF p_game_type IS NOT NULL AND p_buy_in_cents > 0 THEN
      v_body := initcap(replace(p_game_type, '_', ' '));
      v_body := v_body || ' · $' || (p_buy_in_cents / 100)::text || ' buy-in';
      IF p_player_count > 0 THEN
        v_body := v_body || ' · ' || p_player_count::text || ' players';
      END IF;
    ELSE
      v_body := 'Tap Join to enter the round';
    END IF;

    FOREACH pid IN ARRAY p_player_ids
    LOOP
      BEGIN
        pid_uuid := pid::uuid;
      EXCEPTION WHEN others THEN
        CONTINUE;
      END;

      IF pid_uuid = auth.uid() THEN
        CONTINUE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = pid_uuid) THEN
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1 FROM notifications
        WHERE round_id = p_round_id AND user_id = pid_uuid AND type = 'round_invite'
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO notifications (id, user_id, type, title, body, round_id, invite_code, read, created_at)
      VALUES (
        gen_random_uuid(),
        pid_uuid,
        'round_invite',
        p_creator_name || ' invited you to play at ' || p_course_name,
        v_body,
        p_round_id,
        p_invite_code,
        false,
        now()
      );
      sent := sent + 1;
    END LOOP;

    RETURN sent;
  END;
  $_$;


--
-- Name: submit_event_score(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_event_score(p_round_id text, p_player_id text, p_hole_number integer, p_gross_score integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                                                                                                                                                        
  DECLARE                                                                       
    v_event_id text;                                                                                                                                                                                           
    v_role text;                                                                
    v_status text;           
    v_round_owner uuid;                                                                                                                                                                                        
    v_score_id text;                   
    v_existing_id text;                                                                                                                                                                                        
    v_caller uuid := auth.uid();                                                                                                                                                                               
    v_caller_group int;                
    v_target_group int;                                                                                                                                                                                        
  BEGIN                                                                         
    IF v_caller IS NULL THEN                                             
      RAISE EXCEPTION 'Not authenticated';                                                                                                                                                                     
    END IF;                  
                                                                                                                                                                                                               
    IF p_gross_score < 1 OR p_gross_score > 20 THEN                                                                                                                                                            
      RAISE EXCEPTION 'Score must be between 1 and 20';
    END IF;                                                                                                                                                                                                    
                                                                                
    SELECT event_id, user_id INTO v_event_id, v_round_owner                                                                                                                                                    
    FROM rounds WHERE id = p_round_id;                                          
                                                                                                                                                                                                               
    IF v_event_id IS NULL THEN                  
      RAISE EXCEPTION 'Round is not part of an event';                                                                                                                                                         
    END IF;                                                                     
                                                                                                                                                                                                               
    SELECT role, group_number INTO v_role, v_caller_group                       
    FROM event_participants                                                                                                                                                                                    
    WHERE event_id = v_event_id AND user_id = v_caller;                  
                                                                                                                                                                                                               
    IF v_role IS NULL THEN                                                                                                                                                                                     
      RAISE EXCEPTION 'Not a participant in this event';                 
    END IF;                                                                                                                                                                                                    
                                                                                
    IF v_role = 'player' THEN                                                                                                                                                                                  
      IF NOT EXISTS (                  
        SELECT 1 FROM event_participants                                                                                                                                                                       
        WHERE event_id = v_event_id AND user_id = v_caller AND player_id = p_player_id                                                                                                                         
      ) THEN                 
        RAISE EXCEPTION 'Players can only submit their own scores';                                                                                                                                            
      END IF;                                                                   
    END IF;                                     
                                                                                                                                                                                                               
    IF v_role = 'scorekeeper' THEN                      
      SELECT group_number INTO v_target_group                                                                                                                                                                  
      FROM event_participants                                                   
      WHERE event_id = v_event_id AND player_id = p_player_id;                                                                                                                                                 
                                                                         
      IF v_target_group IS DISTINCT FROM v_caller_group THEN                                                                                                                                                   
        RAISE EXCEPTION 'Scorekeepers can only submit scores for players in their group';
      END IF;                                                                                                                                                                                                  
    END IF;                                                                     
                                       
    IF v_role IN ('manager', 'scorekeeper') THEN                                                                                                                                                               
      v_status := 'approved';                   
    ELSE                                                                                                                                                                                                       
      v_status := 'pending';                                                                                                                                                                                   
    END IF;                                                              
                                                                                                                                                                                                               
    SELECT id INTO v_existing_id                                                                                                                                                                               
    FROM hole_scores                                    
    WHERE round_id = p_round_id AND player_id = p_player_id AND hole_number = p_hole_number;                                                                                                                   
                                                                                
    IF v_existing_id IS NOT NULL THEN                                                                                                                                                                          
      UPDATE hole_scores SET                            
        gross_score = p_gross_score,                                                                                                                                                                           
        score_status = v_status,                                                
        submitted_by = v_caller                                                                                                                                                                                
      WHERE id = v_existing_id;                         
      v_score_id := v_existing_id;                                                                                                                                                                             
    ELSE                                                                        
      v_score_id := gen_random_uuid()::text;                                                                                                                                                                   
      INSERT INTO hole_scores (id, user_id, round_id, player_id, hole_number, gross_score, score_status, submitted_by)
      VALUES (v_score_id, v_round_owner, p_round_id, p_player_id, p_hole_number, p_gross_score, v_status, v_caller);                                                                                           
    END IF;                                                                     
                                                                                                                                                                                                               
    RETURN jsonb_build_object('id', v_score_id, 'status', v_status);     
  END;                                                                                                                                                                                                         
  $$;


--
-- Name: submit_participant_score(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_participant_score(p_round_id text, p_player_id text, p_hole_number integer, p_gross_score integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    v_caller uuid := auth.uid();
    v_participant record;
    v_round record;
    v_score_id text;
    v_existing record;
  BEGIN
    IF v_caller IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF p_gross_score < 1 OR p_gross_score > 20 THEN
      RAISE EXCEPTION 'Score must be between 1 and 20';
    END IF;
    SELECT * INTO v_participant FROM round_participants
    WHERE round_id = p_round_id AND user_id = v_caller AND player_id = p_player_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'You are not a participant for this player';
    END IF;
    SELECT * INTO v_round FROM rounds WHERE id = p_round_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Round not found';
    END IF;
    SELECT * INTO v_existing FROM hole_scores
    WHERE round_id = p_round_id AND player_id = p_player_id AND hole_number = p_hole_number;
    IF FOUND THEN
      UPDATE hole_scores SET gross_score = p_gross_score
      WHERE id = v_existing.id;
      v_score_id := v_existing.id;
    ELSE
      v_score_id := gen_random_uuid()::text;
      INSERT INTO hole_scores (id, user_id, round_id, player_id, hole_number, gross_score)
      VALUES (v_score_id, v_round.user_id, p_round_id, p_player_id, p_hole_number, p_gross_score);
    END IF;
    RETURN jsonb_build_object('score_id', v_score_id);
  END;
  $$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END;
  $$;


--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id uuid NOT NULL,
    action text NOT NULL,
    target_type text,
    target_id text,
    target_label text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE admin_audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.admin_audit_log IS 'Append-only log of admin write actions. Written via log_admin_action() RPC; read directly by the admin UI.';


--
-- Name: app_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_versions (
    platform text NOT NULL,
    min_supported_version text NOT NULL,
    recommended_version text NOT NULL,
    force_upgrade_below text,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: TABLE app_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.app_versions IS 'Per-platform compatibility window. Clients query their row on launch and either no-op, prompt-upgrade, or hard-block based on their own version vs. the row.';


--
-- Name: bbb_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bbb_points (
    id text NOT NULL,
    user_id uuid NOT NULL,
    round_id text NOT NULL,
    hole_number integer NOT NULL,
    bingo text,
    bango text,
    bongo text
);


--
-- Name: buy_ins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buy_ins (
    id text NOT NULL,
    user_id uuid NOT NULL,
    round_id text NOT NULL,
    player_id text NOT NULL,
    amount_cents integer NOT NULL,
    method text,
    status text NOT NULL,
    paid_at timestamp with time zone,
    player_reported_at timestamp with time zone
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id text NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    tees jsonb NOT NULL,
    holes jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    hidden boolean DEFAULT false NOT NULL
);


--
-- Name: event_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_participants (
    id text NOT NULL,
    event_id text,
    user_id uuid NOT NULL,
    player_id text NOT NULL,
    role text DEFAULT 'player'::text NOT NULL,
    group_number integer,
    joined_at timestamp with time zone DEFAULT now()
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id text NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'setup'::text NOT NULL,
    round_id text,
    invite_code text,
    group_scorekeepers jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: feedback_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    user_email text,
    category text NOT NULL,
    message text NOT NULL,
    app_version text,
    app_platform text,
    user_agent text,
    route text,
    context jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'new'::text NOT NULL,
    triaged_by uuid,
    triaged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE feedback_reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.feedback_reports IS 'In-app feedback / bug reports. Each row carries the runtime context (version, platform, route) that the user did not have to type.';


--
-- Name: hole_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hole_scores (
    id text NOT NULL,
    user_id uuid NOT NULL,
    round_id text NOT NULL,
    player_id text NOT NULL,
    hole_number integer NOT NULL,
    gross_score integer NOT NULL,
    score_status text DEFAULT 'approved'::text NOT NULL,
    submitted_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: invite_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invite_attempts (
    user_id uuid NOT NULL,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: junk_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.junk_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    round_id text NOT NULL,
    hole_number integer NOT NULL,
    player_id text NOT NULL,
    junk_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT junk_records_hole_number_check CHECK (((hole_number >= 1) AND (hole_number <= 18))),
    CONSTRAINT junk_records_junk_type_check CHECK ((junk_type = ANY (ARRAY['sandy'::text, 'greenie'::text, 'snake'::text, 'barkie'::text, 'ctp'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    round_id text,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    invite_code text
);


--
-- Name: pinned_friends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pinned_friends (
    user_id uuid NOT NULL,
    friend_user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.players (
    id text NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    handicap_index double precision NOT NULL,
    tee text NOT NULL,
    ghin_number text DEFAULT ''::text NOT NULL,
    venmo_username text,
    created_at timestamp with time zone DEFAULT now(),
    zelle_identifier text,
    cashapp_username text,
    paypal_email text,
    is_public boolean DEFAULT false NOT NULL
);


--
-- Name: prop_bets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prop_bets (
    id text NOT NULL,
    round_id text,
    creator_id text NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    category text NOT NULL,
    wager_model text NOT NULL,
    stake_cents integer DEFAULT 500 NOT NULL,
    outcomes jsonb DEFAULT '[]'::jsonb NOT NULL,
    resolve_type text NOT NULL,
    auto_resolve_config jsonb,
    target_player_id text,
    status text DEFAULT 'open'::text NOT NULL,
    winning_outcome_id text,
    locks_at timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    hole_number integer,
    CONSTRAINT prop_bets_category_check CHECK ((category = ANY (ARRAY['quick'::text, 'skill'::text, 'h2h'::text]))),
    CONSTRAINT prop_bets_resolve_type_check CHECK ((resolve_type = ANY (ARRAY['auto'::text, 'manual'::text]))),
    CONSTRAINT prop_bets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'locked'::text, 'resolved'::text, 'voided'::text]))),
    CONSTRAINT prop_bets_wager_model_check CHECK ((wager_model = ANY (ARRAY['challenge'::text, 'pool'::text, 'fixed'::text])))
);


--
-- Name: prop_wagers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prop_wagers (
    id text NOT NULL,
    prop_bet_id text NOT NULL,
    round_id text,
    player_id text NOT NULL,
    user_id uuid NOT NULL,
    outcome_id text NOT NULL,
    amount_cents integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: round_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.round_participants (
    id text NOT NULL,
    round_id text NOT NULL,
    user_id uuid NOT NULL,
    player_id text NOT NULL,
    joined_at timestamp with time zone DEFAULT now()
);


--
-- Name: round_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.round_players (
    id text NOT NULL,
    user_id uuid NOT NULL,
    round_id text NOT NULL,
    player_id text NOT NULL,
    tee_played text NOT NULL,
    course_handicap double precision,
    playing_handicap double precision
);


--
-- Name: rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rounds (
    id text NOT NULL,
    user_id uuid NOT NULL,
    course_id text NOT NULL,
    date timestamp with time zone NOT NULL,
    status text NOT NULL,
    current_hole integer DEFAULT 1 NOT NULL,
    course_snapshot jsonb,
    game jsonb,
    treasurer_player_id text,
    players jsonb,
    junk_config jsonb,
    groups jsonb,
    game_master_id text,
    invite_code text,
    event_id text,
    holes_mode text DEFAULT 'full_18'::text,
    starting_hole integer DEFAULT 1,
    shotgun_starts jsonb
);


--
-- Name: settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settlements (
    id text NOT NULL,
    user_id uuid NOT NULL,
    round_id text NOT NULL,
    from_player_id text NOT NULL,
    to_player_id text NOT NULL,
    amount_cents integer NOT NULL,
    reason text,
    source text DEFAULT 'game'::text NOT NULL,
    status text DEFAULT 'owed'::text NOT NULL,
    paid_at timestamp with time zone,
    player_reported_at timestamp with time zone,
    reported_method text
);


--
-- Name: side_bets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.side_bets (
    id text NOT NULL,
    user_id uuid NOT NULL,
    round_id text NOT NULL,
    hole_number integer NOT NULL,
    description text NOT NULL,
    amount_cents integer NOT NULL,
    participants jsonb NOT NULL,
    winner_player_id text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tournament_matchups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_matchups (
    id text NOT NULL,
    user_id uuid NOT NULL,
    tournament_id text NOT NULL,
    tournament_round_id text,
    bracket_round integer NOT NULL,
    match_number integer NOT NULL,
    player_a_id text,
    player_b_id text,
    winner_id text,
    loser_bracket boolean DEFAULT false NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tournament_rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_rounds (
    id text NOT NULL,
    user_id uuid NOT NULL,
    tournament_id text NOT NULL,
    round_id text,
    round_number integer NOT NULL,
    bracket_round integer,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tournaments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournaments (
    id text NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    format text NOT NULL,
    status text DEFAULT 'setup'::text NOT NULL,
    course_id text,
    course_snapshot jsonb,
    player_ids jsonb NOT NULL,
    config jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: app_versions app_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_versions
    ADD CONSTRAINT app_versions_pkey PRIMARY KEY (platform);


--
-- Name: bbb_points bbb_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bbb_points
    ADD CONSTRAINT bbb_points_pkey PRIMARY KEY (id);


--
-- Name: buy_ins buy_ins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buy_ins
    ADD CONSTRAINT buy_ins_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: event_participants event_participants_event_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_event_id_user_id_key UNIQUE (event_id, user_id);


--
-- Name: event_participants event_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_pkey PRIMARY KEY (id);


--
-- Name: events events_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_invite_code_key UNIQUE (invite_code);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: feedback_reports feedback_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_reports
    ADD CONSTRAINT feedback_reports_pkey PRIMARY KEY (id);


--
-- Name: hole_scores hole_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hole_scores
    ADD CONSTRAINT hole_scores_pkey PRIMARY KEY (id);


--
-- Name: invite_attempts invite_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_attempts
    ADD CONSTRAINT invite_attempts_pkey PRIMARY KEY (user_id, attempted_at);


--
-- Name: junk_records junk_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.junk_records
    ADD CONSTRAINT junk_records_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: pinned_friends pinned_friends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pinned_friends
    ADD CONSTRAINT pinned_friends_pkey PRIMARY KEY (user_id, friend_user_id);


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- Name: prop_bets prop_bets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prop_bets
    ADD CONSTRAINT prop_bets_pkey PRIMARY KEY (id);


--
-- Name: prop_wagers prop_wagers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prop_wagers
    ADD CONSTRAINT prop_wagers_pkey PRIMARY KEY (id);


--
-- Name: round_participants round_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.round_participants
    ADD CONSTRAINT round_participants_pkey PRIMARY KEY (id);


--
-- Name: round_participants round_participants_round_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.round_participants
    ADD CONSTRAINT round_participants_round_id_user_id_key UNIQUE (round_id, user_id);


--
-- Name: round_players round_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.round_players
    ADD CONSTRAINT round_players_pkey PRIMARY KEY (id);


--
-- Name: rounds rounds_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rounds
    ADD CONSTRAINT rounds_invite_code_key UNIQUE (invite_code);


--
-- Name: rounds rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rounds
    ADD CONSTRAINT rounds_pkey PRIMARY KEY (id);


--
-- Name: settlements settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlements
    ADD CONSTRAINT settlements_pkey PRIMARY KEY (id);


--
-- Name: settlements settlements_unique_per_round; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlements
    ADD CONSTRAINT settlements_unique_per_round UNIQUE (round_id, from_player_id, to_player_id, source);


--
-- Name: side_bets side_bets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.side_bets
    ADD CONSTRAINT side_bets_pkey PRIMARY KEY (id);


--
-- Name: tournament_matchups tournament_matchups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matchups
    ADD CONSTRAINT tournament_matchups_pkey PRIMARY KEY (id);


--
-- Name: tournament_rounds tournament_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rounds
    ADD CONSTRAINT tournament_rounds_pkey PRIMARY KEY (id);


--
-- Name: tournaments tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: admin_audit_log_admin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_log_admin_idx ON public.admin_audit_log USING btree (admin_user_id, created_at DESC);


--
-- Name: admin_audit_log_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log USING btree (created_at DESC);


--
-- Name: admin_audit_log_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_log_target_idx ON public.admin_audit_log USING btree (target_type, target_id);


--
-- Name: bbb_points_round_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bbb_points_round_id_idx ON public.bbb_points USING btree (round_id);


--
-- Name: buy_ins_round_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX buy_ins_round_id_idx ON public.buy_ins USING btree (round_id);


--
-- Name: courses_user_id_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX courses_user_id_name_idx ON public.courses USING btree (user_id, name);


--
-- Name: feedback_reports_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedback_reports_created_idx ON public.feedback_reports USING btree (created_at DESC);


--
-- Name: feedback_reports_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedback_reports_status_idx ON public.feedback_reports USING btree (status, created_at DESC);


--
-- Name: feedback_reports_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedback_reports_user_idx ON public.feedback_reports USING btree (user_id, created_at DESC);


--
-- Name: hole_scores_round_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hole_scores_round_id_idx ON public.hole_scores USING btree (round_id);


--
-- Name: idx_buy_ins_round_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buy_ins_round_player ON public.buy_ins USING btree (round_id, player_id);


--
-- Name: idx_events_invite_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_invite_code ON public.events USING btree (invite_code);


--
-- Name: idx_hole_scores_round_hole; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hole_scores_round_hole ON public.hole_scores USING btree (round_id, hole_number);


--
-- Name: idx_hole_scores_round_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hole_scores_round_player ON public.hole_scores USING btree (round_id, player_id);


--
-- Name: idx_invite_attempts_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invite_attempts_user_time ON public.invite_attempts USING btree (user_id, attempted_at DESC);


--
-- Name: idx_junk_records_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_junk_records_round ON public.junk_records USING btree (round_id);


--
-- Name: idx_junk_records_round_hole; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_junk_records_round_hole ON public.junk_records USING btree (round_id, hole_number);


--
-- Name: idx_notifications_user_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_read ON public.notifications USING btree (user_id, read);


--
-- Name: idx_prop_wagers_round_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prop_wagers_round_user ON public.prop_wagers USING btree (round_id, user_id);


--
-- Name: idx_round_participants_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_round_participants_round ON public.round_participants USING btree (round_id);


--
-- Name: idx_round_participants_round_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_round_participants_round_user ON public.round_participants USING btree (round_id, user_id);


--
-- Name: idx_round_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_round_participants_user ON public.round_participants USING btree (user_id);


--
-- Name: idx_rounds_invite_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rounds_invite_code ON public.rounds USING btree (invite_code) WHERE (invite_code IS NOT NULL);


--
-- Name: idx_rounds_invite_code_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rounds_invite_code_active ON public.rounds USING btree (invite_code) WHERE (status = 'active'::text);


--
-- Name: idx_rounds_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rounds_user_date ON public.rounds USING btree (user_id, date DESC);


--
-- Name: idx_settlements_round_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlements_round_status ON public.settlements USING btree (round_id, status);


--
-- Name: idx_settlements_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlements_user_status ON public.settlements USING btree (user_id, status);


--
-- Name: idx_side_bets_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_side_bets_round ON public.side_bets USING btree (round_id);


--
-- Name: players_user_id_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX players_user_id_name_idx ON public.players USING btree (user_id, name);


--
-- Name: round_players_round_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX round_players_round_id_idx ON public.round_players USING btree (round_id);


--
-- Name: rounds_user_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rounds_user_id_status_idx ON public.rounds USING btree (user_id, status);


--
-- Name: settlements_round_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settlements_round_id_idx ON public.settlements USING btree (round_id);


--
-- Name: settlements_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settlements_user_id_idx ON public.settlements USING btree (user_id);


--
-- Name: unique_bbb_per_hole; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_bbb_per_hole ON public.bbb_points USING btree (round_id, hole_number);


--
-- Name: unique_score_per_hole; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_score_per_hole ON public.hole_scores USING btree (round_id, player_id, hole_number);


--
-- Name: uq_hole_scores_round_player_hole; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_hole_scores_round_player_hole ON public.hole_scores USING btree (round_id, player_id, hole_number);


--
-- Name: user_profiles block_admin_escalation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER block_admin_escalation BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_self_promote();


--
-- Name: hole_scores hole_scores_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER hole_scores_updated_at BEFORE UPDATE ON public.hole_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: admin_audit_log admin_audit_log_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: app_versions app_versions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_versions
    ADD CONSTRAINT app_versions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: bbb_points bbb_points_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bbb_points
    ADD CONSTRAINT bbb_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: buy_ins buy_ins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buy_ins
    ADD CONSTRAINT buy_ins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: courses courses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: event_participants event_participants_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_participants event_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: events events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: feedback_reports feedback_reports_triaged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_reports
    ADD CONSTRAINT feedback_reports_triaged_by_fkey FOREIGN KEY (triaged_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: feedback_reports feedback_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_reports
    ADD CONSTRAINT feedback_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: bbb_points fk_bbb_points_round; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bbb_points
    ADD CONSTRAINT fk_bbb_points_round FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE;


--
-- Name: buy_ins fk_buy_ins_round; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buy_ins
    ADD CONSTRAINT fk_buy_ins_round FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE;


--
-- Name: events fk_events_round; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT fk_events_round FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE SET NULL;


--
-- Name: hole_scores fk_hole_scores_round; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hole_scores
    ADD CONSTRAINT fk_hole_scores_round FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE;


--
-- Name: notifications fk_notifications_round; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_notifications_round FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE;


--
-- Name: round_participants fk_round_participants_round; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.round_participants
    ADD CONSTRAINT fk_round_participants_round FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE;


--
-- Name: round_players fk_round_players_round; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.round_players
    ADD CONSTRAINT fk_round_players_round FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE;


--
-- Name: settlements fk_settlements_round; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlements
    ADD CONSTRAINT fk_settlements_round FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE;


--
-- Name: side_bets fk_side_bets_round; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.side_bets
    ADD CONSTRAINT fk_side_bets_round FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE;


--
-- Name: tournament_matchups fk_tournament_matchups_tournament; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matchups
    ADD CONSTRAINT fk_tournament_matchups_tournament FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: tournament_rounds fk_tournament_rounds_tournament; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rounds
    ADD CONSTRAINT fk_tournament_rounds_tournament FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: hole_scores hole_scores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hole_scores
    ADD CONSTRAINT hole_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: junk_records junk_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.junk_records
    ADD CONSTRAINT junk_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: pinned_friends pinned_friends_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pinned_friends
    ADD CONSTRAINT pinned_friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: players players_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: prop_bets prop_bets_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prop_bets
    ADD CONSTRAINT prop_bets_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.players(id);


--
-- Name: prop_bets prop_bets_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prop_bets
    ADD CONSTRAINT prop_bets_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE;


--
-- Name: prop_bets prop_bets_target_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prop_bets
    ADD CONSTRAINT prop_bets_target_player_id_fkey FOREIGN KEY (target_player_id) REFERENCES public.players(id);


--
-- Name: prop_bets prop_bets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prop_bets
    ADD CONSTRAINT prop_bets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: prop_wagers prop_wagers_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prop_wagers
    ADD CONSTRAINT prop_wagers_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id);


--
-- Name: prop_wagers prop_wagers_prop_bet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prop_wagers
    ADD CONSTRAINT prop_wagers_prop_bet_id_fkey FOREIGN KEY (prop_bet_id) REFERENCES public.prop_bets(id) ON DELETE CASCADE;


--
-- Name: prop_wagers prop_wagers_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prop_wagers
    ADD CONSTRAINT prop_wagers_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE;


--
-- Name: prop_wagers prop_wagers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prop_wagers
    ADD CONSTRAINT prop_wagers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: round_participants round_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.round_participants
    ADD CONSTRAINT round_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: round_players round_players_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.round_players
    ADD CONSTRAINT round_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: rounds rounds_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rounds
    ADD CONSTRAINT rounds_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: settlements settlements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlements
    ADD CONSTRAINT settlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: side_bets side_bets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.side_bets
    ADD CONSTRAINT side_bets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: tournament_matchups tournament_matchups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matchups
    ADD CONSTRAINT tournament_matchups_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: tournament_rounds tournament_rounds_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_rounds
    ADD CONSTRAINT tournament_rounds_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: tournaments tournaments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications Users can manage own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own notifications" ON public.notifications USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: side_bets Users can manage own side bets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own side bets" ON public.side_bets USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: tournament_matchups Users can manage own tournament matchups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own tournament matchups" ON public.tournament_matchups USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: tournament_rounds Users can manage own tournament rounds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own tournament rounds" ON public.tournament_rounds USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: tournaments Users can manage own tournaments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own tournaments" ON public.tournaments USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: prop_bets Users manage own prop_bets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own prop_bets" ON public.prop_bets USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: prop_wagers Users manage own prop_wagers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own prop_wagers" ON public.prop_wagers USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: admin_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log admin_audit_log_read_admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_audit_log_read_admins ON public.admin_audit_log FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.user_id = auth.uid()) AND (user_profiles.is_admin = true)))));


--
-- Name: app_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: app_versions app_versions_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_versions_admin_write ON public.app_versions USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.user_id = auth.uid()) AND (user_profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.user_id = auth.uid()) AND (user_profiles.is_admin = true)))));


--
-- Name: app_versions app_versions_read_any; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_versions_read_any ON public.app_versions FOR SELECT USING (true);


--
-- Name: bbb_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bbb_points ENABLE ROW LEVEL SECURITY;

--
-- Name: buy_ins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.buy_ins ENABLE ROW LEVEL SECURITY;

--
-- Name: courses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

--
-- Name: event_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: event_participants event_participants_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_participants_owner ON public.event_participants USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_participants.event_id) AND (e.user_id = auth.uid())))));


--
-- Name: event_participants event_participants_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_participants_read ON public.event_participants FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.event_participants ep2
  WHERE ((ep2.event_id = event_participants.event_id) AND (ep2.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_participants.event_id) AND (e.user_id = auth.uid()))))));


--
-- Name: event_participants event_participants_self_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_participants_self_insert ON public.event_participants FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: events events_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_owner ON public.events USING ((auth.uid() = user_id));


--
-- Name: events events_participant_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_participant_read ON public.events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.event_participants ep
  WHERE ((ep.event_id = events.id) AND (ep.user_id = auth.uid())))));


--
-- Name: feedback_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback_reports feedback_reports_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feedback_reports_admin_update ON public.feedback_reports FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.user_id = auth.uid()) AND (user_profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.user_id = auth.uid()) AND (user_profiles.is_admin = true)))));


--
-- Name: feedback_reports feedback_reports_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feedback_reports_insert_self ON public.feedback_reports FOR INSERT WITH CHECK (((user_id IS NULL) OR (user_id = auth.uid())));


--
-- Name: feedback_reports feedback_reports_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feedback_reports_read ON public.feedback_reports FOR SELECT USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.user_id = auth.uid()) AND (user_profiles.is_admin = true))))));


--
-- Name: hole_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hole_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: round_participants insert own participation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert own participation" ON public.round_participants FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: invite_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invite_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: invite_attempts invite_attempts_no_direct_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invite_attempts_no_direct_access ON public.invite_attempts TO authenticated USING (false);


--
-- Name: junk_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.junk_records ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: courses own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own data" ON public.courses USING ((auth.uid() = user_id));


--
-- Name: players own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own data" ON public.players USING ((auth.uid() = user_id));


--
-- Name: rounds own delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own delete" ON public.rounds FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: bbb_points own delete bbb_points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own delete bbb_points" ON public.bbb_points FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: buy_ins own delete buy_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own delete buy_ins" ON public.buy_ins FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: junk_records own delete junk_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own delete junk_records" ON public.junk_records FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: round_players own delete round_players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own delete round_players" ON public.round_players FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: hole_scores own delete scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own delete scores" ON public.hole_scores FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: settlements own delete settlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own delete settlements" ON public.settlements FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: rounds own insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own insert" ON public.rounds FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: bbb_points own insert bbb_points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own insert bbb_points" ON public.bbb_points FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: buy_ins own insert buy_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own insert buy_ins" ON public.buy_ins FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: junk_records own insert junk_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own insert junk_records" ON public.junk_records FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: round_players own insert round_players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own insert round_players" ON public.round_players FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: hole_scores own insert scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own insert scores" ON public.hole_scores FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: settlements own insert settlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own insert settlements" ON public.settlements FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: rounds own or participant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own or participant read" ON public.rounds FOR SELECT USING (((user_id = auth.uid()) OR public.is_round_participant(id)));


--
-- Name: settlements own or participant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own or participant read" ON public.settlements FOR SELECT USING (((user_id = auth.uid()) OR (round_id IN ( SELECT round_participants.round_id
   FROM public.round_participants
  WHERE (round_participants.user_id = auth.uid())))));


--
-- Name: pinned_friends own pins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own pins" ON public.pinned_friends USING ((auth.uid() = user_id));


--
-- Name: user_profiles own profile insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own profile insert" ON public.user_profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_profiles own profile update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own profile update" ON public.user_profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: rounds own update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own update" ON public.rounds FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: bbb_points own update bbb_points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own update bbb_points" ON public.bbb_points FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: buy_ins own update buy_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own update buy_ins" ON public.buy_ins FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: junk_records own update junk_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own update junk_records" ON public.junk_records FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: round_players own update round_players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own update round_players" ON public.round_players FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: hole_scores own update scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own update scores" ON public.hole_scores FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: settlements own update settlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own update settlements" ON public.settlements FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: pinned_friends; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pinned_friends ENABLE ROW LEVEL SECURITY;

--
-- Name: players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

--
-- Name: prop_bets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prop_bets ENABLE ROW LEVEL SECURITY;

--
-- Name: prop_wagers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prop_wagers ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles public profile read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public profile read" ON public.user_profiles FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: bbb_points read bbb_points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read bbb_points" ON public.bbb_points FOR SELECT USING (((user_id = auth.uid()) OR public.is_round_participant(round_id)));


--
-- Name: buy_ins read buy_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read buy_ins" ON public.buy_ins FOR SELECT USING (((user_id = auth.uid()) OR public.is_round_participant(round_id)));


--
-- Name: junk_records read junk_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read junk_records" ON public.junk_records FOR SELECT USING (((user_id = auth.uid()) OR public.is_round_participant(round_id)));


--
-- Name: round_participants read participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read participants" ON public.round_participants FOR SELECT USING (((user_id = auth.uid()) OR public.is_round_owner(round_id)));


--
-- Name: round_players read round_players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read round_players" ON public.round_players FOR SELECT USING (((user_id = auth.uid()) OR public.is_round_participant(round_id)));


--
-- Name: hole_scores read scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read scores" ON public.hole_scores FOR SELECT USING (((user_id = auth.uid()) OR public.is_round_participant(round_id)));


--
-- Name: round_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.round_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: round_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.round_players ENABLE ROW LEVEL SECURITY;

--
-- Name: rounds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

--
-- Name: settlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

--
-- Name: side_bets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.side_bets ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_matchups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_matchups ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_rounds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_rounds ENABLE ROW LEVEL SECURITY;

--
-- Name: tournaments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


