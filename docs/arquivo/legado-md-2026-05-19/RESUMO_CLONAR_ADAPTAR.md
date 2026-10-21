# 🚀 Resumo: Clonar e Adaptar Frontend

## 📋 Passo a Passo Rápido

### 1. Clonar Repositório

O repositório é privado. Escolha uma opção:

**Opção A - SSH:**
```bash
cd /root
git clone git@github.com:romuloroldao/Black-House.git
```

**Opção B - Token:**
```bash
cd /root
# Substitua SEU_TOKEN pelo seu token do GitHub
git clone https://SEU_TOKEN@github.com/romuloroldao/Black-House.git
```

**Opção C - Script Interativo:**
```bash
./scripts/clonar-e-preparar.sh
```

### 2. Preparar Projeto

```bash
cd /root/Black-House
npm install
```

### 3. Adaptar Código

**Opção A - Automática (Recomendado primeiro):**
```bash
./scripts/adaptar-automatico.sh /root/Black-House
```

**Opção B - Manual (após automática, para revisar):**
- Siga: `ADAPTACAO_FRONTEND.md`
- Revise arquivos modificados

### 4. Configurar Ambiente

```bash
cd /root/Black-House
echo "VITE_API_URL=https://api.blackhouse.app.br" > .env
```

### 5. Testar

```bash
cd /root/Black-House
npm run dev
```

### 6. Build

```bash
cd /root/Black-House
npm run build
sudo cp -r dist/* /var/www/blackhouse/dist/
```

---

## 🔄 Substituições Automáticas

O script `adaptar-automatico.sh` faz:

- ✅ `import { createClient }` → `import { apiClient }`
- ✅ `supabase.auth.signUp()` → `apiClient.signUp()`
- ✅ `supabase.from('tabela')` → `apiClient.from('tabela')`
- ✅ `supabase.storage` → `apiClient.uploadFile()`
- ✅ E mais...

**⚠️ Importante**: Revise os arquivos após a adaptação automática!

---

## 📚 Arquivos de Referência

- `CLONAR_E_ADAPTAR.md` - Guia completo detalhado
- `ADAPTACAO_FRONTEND.md` - Guia de adaptação manual
- `scripts/clonar-e-preparar.sh` - Script de preparação
- `scripts/adaptar-automatico.sh` - Script de adaptação automática
- `scripts/adaptar-frontend.sh` - Script de adaptação manual

---

## ✅ Checklist

- [ ] Repositório clonado
- [ ] Dependências instaladas
- [ ] Adaptação automática executada
- [ ] Código revisado manualmente
- [ ] Variáveis de ambiente configuradas
- [ ] Testado localmente
- [ ] Build feito com sucesso
- [ ] Deploy realizado

---

**Execute os scripts na ordem para facilitar o processo!**
