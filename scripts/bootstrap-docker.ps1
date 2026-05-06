# PowerShell: na raiz do projeto, aplica SQL no Postgres do Docker
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "A subir o container PostgreSQL..."
docker compose up -d db

Write-Host "A aguardar o Postgres..."
for ($i = 0; $i -lt 45; $i++) {
    docker compose exec -T db pg_isready -U postgres -d sgdb 2>$null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 1
}

$files = @(
    "01_schema.sql",
    "02_functions.sql",
    "03_triggers.sql",
    "04_security.sql",
    "05_seed.sql"
)

foreach ($f in $files) {
    $path = Join-Path $Root "sql\$f"
    Write-Host "A executar sql\$f ..."
    $OutputEncoding = [System.Text.Encoding]::UTF8
    Get-Content -Encoding UTF8 -Raw $path | docker compose exec -T db psql -U postgres -d sgdb -v ON_ERROR_STOP=1 -f -
}

docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "GRANT CONNECT ON DATABASE sgdb TO sgdb_app" 2>$null

Write-Host ""
Write-Host "Pronto. No .env use:"
Write-Host "  DATABASE_URL=postgres://sgdb_app:troque_esta_senha_em_producao@127.0.0.1:5432/sgdb"
Write-Host "Depois: npm install && npm start"
