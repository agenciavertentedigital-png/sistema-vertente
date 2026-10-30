-- Serviço CRM Vertente (mensalidade do CRM cobrada junto com o tráfego)
insert into public.servicos (codigo, nome, pilar) values ('crm', 'CRM Vertente', 'cs') on conflict (codigo) do nothing;
