# Backups do banco

`backup-db.sh` gera um dump comprimido (`pg_dump | gzip`) em `apps/api/backups/`
(pasta fora do git) e remove dumps com mais de `RETENTION_DAYS` dias (padrão: 14).

`restore-db.sh <arquivo.sql.gz>` restaura um dump. E destrutivo — pede confirmação
antes de sobrescrever o banco apontado por `DATABASE_URL`.

Ambos os scripts leem `DATABASE_URL` do `apps/api/.env`.

## Uso manual

```bash
cd apps/api
./scripts/backup-db.sh
./scripts/restore-db.sh backups/campoflow-20260101-020000.sql.gz
```

## Agendamento

### macOS / Linux (cron)

Backup diario as 2h da manha, mantendo 14 dias de historico:

```cron
0 2 * * * cd /caminho/para/CampoFlow/apps/api && ./scripts/backup-db.sh >> /tmp/campoflow-backup.log 2>&1
```

Edite com `crontab -e`.

### macOS (launchd, alternativa ao cron)

Crie `~/Library/LaunchAgents/ae.kreativ.campoflow.backup.plist` apontando para o
script com `<key>StartCalendarInterval</key>` configurado para o horario desejado,
e carregue com `launchctl load ~/Library/LaunchAgents/ae.kreativ.campoflow.backup.plist`.

## Limitacoes deste ambiente

Os backups ficam apenas em disco local (`apps/api/backups/`). Armazenamento
off-site (AWS S3, Cloudflare R2, etc.) e o proximo passo natural para resiliencia
contra perda do disco/maquina, mas depende de credenciais de cloud que nao estao
disponiveis neste ambiente. Quando essas credenciais existirem, basta acrescentar
um passo de upload (`aws s3 cp` / `rclone`) ao final de `backup-db.sh`.
