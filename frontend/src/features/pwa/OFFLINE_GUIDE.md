# Guia de Funcionamento Offline

## ✅ O que funciona offline?

### 1. Navegação entre páginas
- Todas as páginas do app estão cacheadas pelo Service Worker
- Transições entre telas funcionam normalmente

### 2. Visualização de dados
- Lista de inspeções salvas localmente
- Detalhes de inspeções anteriores
- Dashboard com dados cacheados
- Fotos armazenadas no dispositivo

### 3. Criação de inspeções
- Criar nova inspeção
- Tirar fotos (armazenadas localmente)
- Adicionar descrições e riscos
- Salvar como rascunho

### 4. Configurações
- Preferências do usuário
- Tema (claro/escuro)
- Configurações de sync

## ⚠️ O que NÃO funciona offline?

### 1. Acesso a novos dados
- Buscar empresas do servidor
- Buscar usuários
- Buscar tipos de risco atualizados

### 2. Sincronização
- Enviar inspeções para o servidor
- Upload de fotos
- Receber resultados de IA

### 3. Funcionalidades específicas
- Login (requer validação no servidor)
- Relatórios em tempo real
- Notificações push

## 🔄 Fluxo de Trabalho Offline

```
1. ONLINE: Acesse o app e deixe os dados carregarem
            ↓
2. OFFLINE: Continue usando normalmente
   - Crie inspeções
   - Tire fotos
   - Tudo é salvo localmente
            ↓
3. VOLTAR ONLINE: Sync automático
   - Inspeções são enviadas
   - Fotos são sincronizadas
   - IA processa as imagens
```

## 🛠️ Como usar offline

### Preparar para sair (enquanto online):

1. **Abra o app** - Isso cacheia os assets
2. **Acesse as páginas principais** - Dashboard, Nova Inspeção, etc
3. **Carregue os dados** - Deixe as empresas e configurações carregarem

### Usar offline:

1. **Ative o modo avião** ou perca a conexão
2. **O indicador offline aparecerá** no topo
3. **Continue usando o app normalmente**
4. **Crie inspeções** - Elas ficam na fila de sync

### Quando voltar online:

1. **Desative o modo avião**
2. **O app detecta a conexão**
3. **Sincronização automática inicia**
4. **Você recebe notificação** do progresso

## 📱 Testar Offline

### No Chrome DevTools:

1. Abra o app (F12 → Application)
2. Vá em **Network** → Marque **Offline**
3. Tente navegar entre as páginas
4. Crie uma inspeção
5. Desmarque **Offline**
6. Veja a sincronização acontecer

### No celular:

1. Instale o PWA (Adicionar à tela inicial)
2. Abra o app
3. Ative o modo avião
4. Use o app normalmente
5. Desative modo avião
6. Aguarde o sync

## 🚨 Solução de Problemas

### "Página não carrega offline"

1. Verifique se fez build de produção: `npm run build`
2. Confira se Service Worker está registrado (DevTools → Application → SW)
3. Limpe o cache e recarregue

### "Dados não aparecem offline"

1. Os dados precisam ter sido carregados online primeiro
2. Verifique se o cache não expirou (7 dias para API)
3. Recarregue a página online para renovar o cache

### "Sincronização não funciona"

1. Verifique se há conexão estável
2. Confira se o SyncWorker está rodando
3. Tente sincronizar manualmente na página de fila

## 🔧 Configurações Offline

### Preferências disponíveis:

```typescript
{
  autoSync: true,        // Sincroniza automaticamente quando online
  syncOnWifiOnly: false, // Só sync no WiFi (economia de dados)
  offlineMode: false,    // Modo offline forçado
}
```

### Para acessar:

```typescript
import { usePreferences } from '@/features/pwa';

const { preferences, updatePreferences } = usePreferences();

// Ativar sync apenas no WiFi
await updatePreferences({ syncOnWifiOnly: true });
```

## 📊 Limites de Armazenamento

| Tipo | Limite Padrão |
|------|--------------|
| Imagens | 500MB |
| Dados de inspeção | Ilimitado (IndexedDB) |
| Cache de API | 100 entradas |
| Assets (SW) | 10MB |

## 💡 Dicas

1. **Sempre teste offline** antes de usar em campo
2. **Mantenha espaço livre** no dispositivo
3. **Sincronize quando tiver WiFi** para economizar dados
4. **Verifique a fila de sync** periodicamente
5. **Não limpe os dados do navegador** sem sincronizar primeiro
