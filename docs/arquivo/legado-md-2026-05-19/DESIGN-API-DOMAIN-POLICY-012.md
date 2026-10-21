# DESIGN-API-DOMAIN-POLICY-012: Política de Domínio de API

## Princípios

1. **Domínio da API não serve frontend**
   - O domínio `api.blackhouse.app.br` é exclusivamente para API
   - Não há configuração `root` ou `try_files` no server block da API
   - Todas as requisições são proxied para o backend Node.js

2. **Domínio da API não serve favicon**
   - Requisições para `/favicon.ico` retornam `204 No Content` sem logar
   - Logs suprimidos para evitar ruído

3. **404 em assets visuais não é erro funcional**
   - Assets visuais comuns são suprimidos:
     - `/favicon.ico`
     - `/apple-touch-icon.png`
     - `/apple-touch-icon-precomposed.png`
     - `/favicon-*.ico`, `/favicon-*.png`
     - `/robots.txt`
     - `/sitemap.xml`
     - `/manifest.json`
     - `/browserconfig.xml`
     - `/site.webmanifest`
   - Todos retornam `204 No Content` sem logar

4. **Logs de favicon/root são suprimidos**
   - `access_log off` para todos os assets visuais
   - `log_not_found off` para evitar logs de 404
   - Monitoramento não deve alertar para 404 nesses paths

## Implementação

### Nginx Configuration

```nginx
# DESIGN-API-DOMAIN-POLICY-012: Política de domínio de API (sem assets visuais)
# Domínio da API não serve frontend, favicon, ou outros assets visuais
# 404 em assets visuais não é erro funcional - logs suprimidos

# Favicon e ícones - retornar 204 sem logar
location = /favicon.ico {
    access_log off;
    log_not_found off;
    return 204;
}

location = /apple-touch-icon.png {
    access_log off;
    log_not_found off;
    return 204;
}

location = /apple-touch-icon-precomposed.png {
    access_log off;
    log_not_found off;
    return 204;
}

location ~ ^/favicon-.*\.(ico|png)$ {
    access_log off;
    log_not_found off;
    return 204;
}

# Robots.txt e sitemap - retornar 204 sem logar
location = /robots.txt {
    access_log off;
    log_not_found off;
    return 204;
}

location = /sitemap.xml {
    access_log off;
    log_not_found off;
    return 204;
}

# Assets visuais comuns - retornar 204 sem logar
location ~ ^/(manifest\.json|browserconfig\.xml|site\.webmanifest)$ {
    access_log off;
    log_not_found off;
    return 204;
}
```

### Verificação

O server block da API (`api.blackhouse.app.br`) **NÃO** deve ter:
- `root` directive
- `index` directive
- `try_files` directive

Todas as requisições são proxied para `http://localhost:3001` (backend Node.js).

## Monitoramento

- **Não alertar** para 404 em:
  - `/favicon.ico`
  - `/robots.txt`
  - `/sitemap.xml`
  - `/apple-touch-icon.png`
  - `/manifest.json`
  - Qualquer path que corresponda aos patterns acima

- **Alertar** para 404 em:
  - Rotas reais da API (`/auth/*`, `/api/*`, `/health`)
  - Esses são erros funcionais que precisam de atenção

## Status

✅ **IMPLEMENTADO**

- [x] Supressão de logs para favicon e assets visuais
- [x] Verificação de que não há configuração servindo frontend
- [x] Documentação da política
- [x] Testes confirmando funcionamento

## Referências

- DESIGN-API-ROOT-NOISE-SUPPRESSION-010: Supressão de ruído de root e favicon
- DESIGN-API-ROOT-SEMANTIC-011: Resposta semântica para root da API
