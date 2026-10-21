# Como instalar este pacote de skills no outro servidor ou PC

Este arquivo veio junto com o arquivo `skills-bundle.tar.gz`. Siga os passos na ordem.

## O que este pacote faz

Ele coloca duas pastas na **raiz do seu projeto** (o mesmo lugar onde costuma estar a pasta `.git`):

| Pasta que será criada | Para que serve |
|------------------------|----------------|
| `.agents/skills/` | Skills de agente (instruções para a IA do projeto) |
| `.cursor/skills-cursor/` | Skills extras do Cursor no workspace |

A estrutura no disco fica **igual** à do projeto de origem.

---

## Antes de começar

1. Você já copiou `skills-bundle.tar.gz` para a máquina (por exemplo com **SCP** ou pendrive).
2. Você sabe a **pasta raiz do projeto** no outro computador — a pasta onde está o código, não a pasta `home` genérica, a menos que o projeto seja exatamente ali.

**Raiz do projeto** = pasta onde você abre o projeto no Cursor/VS Code (ex.: contém `package.json`, `.git`, etc.).

---

## Passo a passo (copie e cole no terminal)

Abra o terminal **na raiz do projeto** no outro servidor ou PC.

### 1. Ir até a pasta do projeto

Substitua `/caminho/do/seu/projeto` pelo caminho real:

```bash
cd /caminho/do/seu/projeto
```

### 2. Colocar o arquivo `skills-bundle.tar.gz` nesta pasta

O arquivo `skills-bundle.tar.gz` e este `LEIA-ME-INSTALAR-SKILLS.md` devem estar **aqui**, na mesma pasta raiz do projeto (ou mova o `.tar.gz` para cá antes do próximo comando).

### 3. Extrair o pacote (comando importante)

```bash
tar xzf skills-bundle.tar.gz
```

Este comando **cria automaticamente** as pastas `.agents/skills` e `.cursor/skills-cursor` **no diretório atual**. Por isso o passo 1 é obrigatório: você precisa estar na raiz certa.

### 4. Conferir se deu certo

```bash
ls -la .agents/skills .cursor/skills-cursor
```

Se aparecerem listas de arquivos e pastas, a instalação está correta.

---

## Se algo der errado

- **As pastas apareceram em lugar errado** (por exemplo na pasta do usuário em vez do projeto): apague as pastas `.agents` e `.cursor` criadas no lugar errado, volte ao passo 1 com `cd` na **raiz correta** do projeto e rode de novo: `tar xzf skills-bundle.tar.gz`.

- **“Arquivo não encontrado”**: confirme que `skills-bundle.tar.gz` está na mesma pasta onde você rodou o comando (use `ls` para ver).

- **Permissão negada**: em alguns servidores pode ser preciso usar `sudo` só se a pasta do projeto for do sistema; em projeto seu, normalmente não precisa.

---

## Resumo em uma frase

**Abra o terminal na raiz do projeto e rode:** `tar xzf skills-bundle.tar.gz` **com o `.tar.gz` nessa mesma pasta.**

Depois disso, abra o projeto de novo no Cursor para as skills do workspace serem reconhecidas.
