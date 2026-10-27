-- Rotina mensal que cai no sábado ou domingo passa para a segunda.
create or replace function privado.proxima_data(
  p_frequencia text, p_dia_semana smallint, p_dia_mes smallint, p_depois date)
returns date language plpgsql immutable set search_path = ''
as $$
declare
  d date;
  alvo date;
  ultimo_dia int;
begin
  if p_frequencia = 'diaria' then
    d := p_depois + 1;
    while extract(isodow from d) in (6, 7) loop d := d + 1; end loop;
    return d;
  elsif p_frequencia in ('semanal', 'quinzenal') then
    d := p_depois + case when p_frequencia = 'quinzenal' then 8 else 1 end;
    while extract(isodow from d) <> coalesce(p_dia_semana, 1) loop d := d + 1; end loop;
    return d;
  else
    d := date_trunc('month', p_depois)::date;
    loop
      ultimo_dia := extract(day from (d + interval '1 month - 1 day'))::int;
      alvo := d + (least(coalesce(p_dia_mes, 1), ultimo_dia) - 1);
      while extract(isodow from alvo) in (6, 7) loop alvo := alvo + 1; end loop;
      if alvo > p_depois then
        return alvo;
      end if;
      d := (d + interval '1 month')::date;
    end loop;
  end if;
end;
$$;
