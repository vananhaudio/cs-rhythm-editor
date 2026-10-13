\set ON_ERROR_STOP on
select t.ok(to_regprocedure('public.chord_sheet_accept_anchors_publish(uuid,jsonb,jsonb)') is null and to_regprocedure('public.chordlib_can_anchors(uuid)') is null, 'rollback V1.6: gỡ hàm mới');
select t.as_user('ED1');
select t.fails($q$select public.chord_sheet_contribute_publish('Lời [C] x', 'Sau rollback', null, '{"beats":4,"beatType":4}', null, '[]', null, null, null, '{"measures":[{"line":0,"token":0}]}')$q$,
  'sau rollback: Biên tập lại bị chặn vạch nhịp như V1.5', 'vạch nhịp');
select t.reset();
