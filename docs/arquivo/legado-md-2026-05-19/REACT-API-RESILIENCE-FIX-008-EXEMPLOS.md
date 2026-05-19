# FIX-008: Exemplos Práticos de Componentes Resilientes

## 📚 Índice

1. [Lista Simples](#lista-simples)
2. [Lista com Filtros](#lista-com-filtros)
3. [Detalhes de Item](#detalhes-de-item)
4. [Formulário com Validação](#formulário-com-validação)
5. [Dashboard com Múltiplas APIs](#dashboard-com-múltiplas-apis)
6. [Busca com Debounce](#busca-com-debounce)
7. [Infinite Scroll](#infinite-scroll)
8. [Refresh Manual](#refresh-manual)

---

## 1. Lista Simples

```typescript
// src/components/StudentList.tsx
import { useApiSafeList } from '@/hooks/useApiSafe';
import { apiClient } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const StudentList = () => {
  const { data: students, loading, error, refetch } = useApiSafeList(
    () => apiClient.getAlunosByCoachSafe()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-destructive mb-4">Erro ao carregar alunos</p>
        <p className="text-sm text-muted-foreground mb-6">{error}</p>
        <Button onClick={refetch}>Tentar novamente</Button>
      </Card>
    );
  }

  if (students.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground mb-4">Nenhum aluno cadastrado</p>
        <Button variant="outline">Adicionar primeiro aluno</Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {students.map(student => (
        <Card key={student.id} className="p-6">
          <h3 className="font-semibold">{student.nome}</h3>
          <p className="text-sm text-muted-foreground">{student.email}</p>
        </Card>
      ))}
    </div>
  );
};
```

**Pontos-chave:**
- ✅ UI base sempre renderiza (nunca `return null`)
- ✅ Loading, error e empty states bem definidos
- ✅ Botão retry em caso de erro
- ✅ Sem try/catch manual

---

## 2. Lista com Filtros

```typescript
// src/components/FilteredStudentList.tsx
import { useState, useMemo } from 'react';
import { useApiSafeList } from '@/hooks/useApiSafe';
import { apiClient } from '@/lib/api-client';
import { Input } from '@/components/ui/input';

export const FilteredStudentList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: students, loading, error } = useApiSafeList(
    () => apiClient.getAlunosByCoachSafe()
  );

  // Filtro client-side (não afeta API)
  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    
    return students.filter(student => 
      student.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar aluno..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        disabled={loading}
      />

      {loading && (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="p-8 text-center text-destructive">
          Erro: {error}
        </div>
      )}

      {!loading && !error && filteredStudents.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          {searchTerm 
            ? `Nenhum resultado para "${searchTerm}"`
            : 'Nenhum aluno cadastrado'}
        </div>
      )}

      <div className="grid gap-4">
        {filteredStudents.map(student => (
          <div key={student.id} className="p-4 border rounded">
            {student.nome}
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Pontos-chave:**
- ✅ Filtro client-side com `useMemo`
- ✅ Input desabilitado durante loading
- ✅ Mensagem diferente para "não encontrado" vs "vazio"

---

## 3. Detalhes de Item

```typescript
// src/components/StudentDetails.tsx
import { useApiSafe } from '@/hooks/useApiSafe';
import { apiClient } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface StudentDetailsProps {
  studentId: string;
}

export const StudentDetails = ({ studentId }: StudentDetailsProps) => {
  const { data: student, loading, error, refetch } = useApiSafe(
    () => apiClient.getStudentByIdSafe(studentId)
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-destructive mb-2">Erro ao carregar aluno</p>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Button onClick={refetch} variant="outline">
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!student) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Aluno não encontrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {student.nome}
          <Badge>{student.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div>
            <span className="text-sm text-muted-foreground">Email:</span>
            <p>{student.email}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Telefone:</span>
            <p>{student.telefone || 'Não informado'}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Data de cadastro:</span>
            <p>{new Date(student.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
```

**Pontos-chave:**
- ✅ Usa `useApiSafe` (não `useApiSafeList`) pois é objeto único
- ✅ Verifica `if (!student)` após verificar erro
- ✅ Fallback para campos opcionais (`telefone || 'Não informado'`)

---

## 4. Formulário com Validação

```typescript
// src/components/CreateStudentForm.tsx
import { useState } from 'react';
import { apiClient, ApiResult } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const CreateStudentForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Usar versão Safe para POST também
    const result: ApiResult<any> = await apiClient.createStudentSafe(formData);

    if (result.success) {
      toast({
        title: "Aluno criado com sucesso!",
        description: `${formData.nome} foi adicionado.`
      });
      onSuccess();
    } else {
      toast({
        title: "Erro ao criar aluno",
        description: result.error,
        variant: "destructive"
      });
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="nome">Nome completo</Label>
        <Input
          id="nome"
          value={formData.nome}
          onChange={e => setFormData(prev => ({ ...prev, nome: e.target.value }))}
          required
          disabled={loading}
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
          required
          disabled={loading}
        />
      </div>

      <div>
        <Label htmlFor="telefone">Telefone</Label>
        <Input
          id="telefone"
          value={formData.telefone}
          onChange={e => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
          disabled={loading}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Criando...' : 'Criar aluno'}
      </Button>
    </form>
  );
};
```

**Pontos-chave:**
- ✅ Usa `ApiResult` para POST também
- ✅ Toast de sucesso ou erro
- ✅ Formulário desabilitado durante loading
- ✅ Não quebra se API falhar

---

## 5. Dashboard com Múltiplas APIs

```typescript
// src/components/CoachDashboard.tsx
import { useApiSafeList } from '@/hooks/useApiSafe';
import { apiClient } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export const CoachDashboard = () => {
  const { data: students, loading: loadingStudents } = useApiSafeList(
    () => apiClient.getAlunosByCoachSafe()
  );

  const { data: notifications, loading: loadingNotifications } = useApiSafeList(
    () => apiClient.getNotificationsSafe({ lida: false })
  );

  const { data: payments, loading: loadingPayments } = useApiSafeList(
    () => apiClient.getPaymentsSafe()
  );

  const loading = loadingStudents || loadingNotifications || loadingPayments;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Alunos Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{students.length}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{notifications.length}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagamentos Pendentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">
            {payments.filter(p => p.status === 'pending').length}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

**Pontos-chave:**
- ✅ Cada API tem seu próprio hook
- ✅ Se uma API falhar, outras continuam
- ✅ Loading combinado
- ✅ Arrays sempre garantidos (nunca null)

---

## 6. Busca com Debounce

```typescript
// src/components/SearchStudents.tsx
import { useState, useEffect } from 'react';
import { useApiSafeList } from '@/hooks/useApiSafe';
import { apiClient } from '@/lib/api-client';
import { Input } from '@/components/ui/input';

export const SearchStudents = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, loading } = useApiSafeList(
    () => apiClient.searchStudentsSafe(debouncedQuery),
    { autoFetch: false } // Não buscar no mount
  );

  // Refetch quando debounced query mudar
  const { refetch } = useApiSafeList(
    () => apiClient.searchStudentsSafe(debouncedQuery)
  );

  useEffect(() => {
    if (debouncedQuery) {
      refetch();
    }
  }, [debouncedQuery, refetch]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar aluno..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {loading && (
        <div className="text-center text-sm text-muted-foreground">
          Buscando...
        </div>
      )}

      {!loading && debouncedQuery && results.length === 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Nenhum resultado para "{debouncedQuery}"
        </div>
      )}

      <div className="space-y-2">
        {results.map(student => (
          <div key={student.id} className="p-4 border rounded">
            {student.nome}
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Pontos-chave:**
- ✅ Debounce para evitar requests desnecessários
- ✅ `autoFetch: false` para controle manual
- ✅ `refetch()` quando query muda

---

## 7. Infinite Scroll

```typescript
// src/components/InfiniteStudentList.tsx
import { useState } from 'react';
import { useApiSafeList } from '@/hooks/useApiSafe';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

export const InfiniteStudentList = () => {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: students, loading, error, hasData } = useApiSafeList(
    () => apiClient.getAlunosByCoachSafe({ page, pageSize })
  );

  const hasMore = students.length === pageSize;

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  return (
    <div className="space-y-4">
      {students.map(student => (
        <div key={student.id} className="p-4 border rounded">
          {student.nome}
        </div>
      ))}

      {loading && (
        <div className="text-center p-4">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}

      {error && (
        <div className="text-center text-destructive p-4">
          Erro: {error}
        </div>
      )}

      {!loading && hasMore && (
        <div className="text-center">
          <Button onClick={loadMore} variant="outline">
            Carregar mais
          </Button>
        </div>
      )}

      {!loading && !hasMore && hasData && (
        <div className="text-center text-sm text-muted-foreground p-4">
          Todos os alunos foram carregados
        </div>
      )}
    </div>
  );
};
```

**Pontos-chave:**
- ✅ Paginação controlada por estado
- ✅ Botão "Carregar mais" ao invés de scroll infinito (mais simples)
- ✅ Detecta fim da lista (`hasMore`)

---

## 8. Refresh Manual

```typescript
// src/components/StudentListWithRefresh.tsx
import { useApiSafeList } from '@/hooks/useApiSafe';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export const StudentListWithRefresh = () => {
  const { data: students, loading, error, refetch } = useApiSafeList(
    () => apiClient.getAlunosByCoachSafe()
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Alunos</h2>
        <Button 
          onClick={refetch} 
          variant="outline" 
          size="sm"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded">
          Erro: {error}
        </div>
      )}

      <div className="grid gap-4">
        {students.map(student => (
          <div key={student.id} className="p-4 border rounded">
            {student.nome}
          </div>
        ))}
      </div>

      {students.length === 0 && !loading && (
        <div className="text-center text-muted-foreground p-8">
          Nenhum aluno cadastrado
        </div>
      )}
    </div>
  );
};
```

**Pontos-chave:**
- ✅ Botão refresh com ícone
- ✅ Ícone gira durante loading
- ✅ `refetch()` fornecido pelo hook

---

## 🎯 Resumo de Padrões

| Caso de Uso | Hook | AutoFetch | Helpers |
|-------------|------|-----------|---------|
| Lista simples | `useApiSafeList` | true | `dataAsArray` |
| Objeto único | `useApiSafe` | true | `hasData` |
| Busca | `useApiSafeList` | false | `refetch()` |
| Múltiplas APIs | Vários hooks | true | - |
| POST/PUT | Não usar hook | - | `ApiResult<T>` |
| Infinite scroll | `useApiSafeList` | true | `hasData` |

---

**Criado em**: 2026-01-25  
**Relacionado a**: REACT-API-RESILIENCE-FIX-008
