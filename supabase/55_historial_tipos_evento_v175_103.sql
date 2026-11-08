-- v175.103: Se preservan los valores anteriores de evento y se añaden los manuales.
ALTER TABLE roque_private.historial_eventos DROP CONSTRAINT historial_eventos_evento_check;
ALTER TABLE roque_private.historial_eventos ADD CONSTRAINT historial_eventos_evento_check
CHECK (evento IN ('login','bloqueado','login_manual','bloqueado_manual'));
