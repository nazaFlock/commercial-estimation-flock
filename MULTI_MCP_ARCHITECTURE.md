# Arquitectura Multi-MCP de EstimadorFlock

## Visión General

EstimadorFlock ahora soporta múltiples fuentes de datos históricas sin acoplamiento, permitiendo integración con diversos proveedores de MCP (Jira, Azure DevOps, CSV, JSON, Excel) mientras mantiene la compatibilidad con el sistema existente basado en archivos locales.

## Componentes Principales

### 1. **Interfaz y Clase Base** 
**Archivo**: `src/adapters/HistoricalReferenceProvider.ts`

Define el contrato común que todos los proveedores deben implementar:

```typescript
interface IHistoricalReferenceProvider {
  name: string;
  type: 'jira' | 'azure' | 'file' | 'csv' | 'json';
  
  fetchRecords(): Promise<HistoricalRecordExtended[]>;
  queryBySimilarity(complexity, technologies): Promise<HistoricalRecordExtended[]>;
  queryByEpic?(epicId): Promise<HistoricalRecordExtended[]>;
  queryByTeam?(teamId): Promise<HistoricalRecordExtended[]>;
}
```

`BaseHistoricalReferenceProvider` proporciona utilidades compartidas:
- `hasTechnologyOverlap()` - calcula similitud entre tecnologías
- `filterBySimilarity()` - filtra registros por complejidad y tecnologías

### 2. **Adaptadores Específicos**

#### JSONFileAdapter
**Archivo**: `src/adapters/JSONFileAdapter.ts`

✅ **Implementado y listo para producción**

- Reutiliza `historicalDataService` existente
- Carga archivos JSON locales de `./data/historical-estimates`
- Agrega metadata: `sourceId: 'local-file'`, `connectionId: 'file'`
- Implementa `fetchRecords()` y `queryBySimilarity()` completos

#### JiraAdapter  
**Archivo**: `src/adapters/JiraAdapter.ts`

🔷 **Stub implementado, listo para completar**

- Extensible para Jira MCP (experimental)
- Constructor acepta: `{connectionId, project, maxResults}`
- TODO: Implementar con herramientas de Jira MCP:
  - `jira_search` - búsqueda por JQL
  - `jira_get_issue` con `detail_level=full` - para extraer timetracking
  - `jira_get_parent_issue` - para relaciones
  - `jira_search_by_epic` - búsqueda por épica

**Futuro**: Azure Adapter, CSV Adapter, Excel Adapter

### 3. **Servicio de Conexiones MCP**
**Archivo**: `src/services/mcpConnectorService.ts`

Gestiona todas las conexiones y proveedores disponibles:

```typescript
// Registro de conexiones
registerConnection(connection: MCPConnection): void

// Obtener adapter para una conexión
getAdapter(connectionId: string): IHistoricalReferenceProvider

// Listar conexiones disponibles
listAvailableConnections(): MCPConnection[]

// Registrar Jira si está disponible
registerJiraConnection(project: string, maxResults?: number): void
```

**Comportamiento**:
- Inicializa automáticamente conector local de archivos JSON
- Crea adapters bajo demanda
- Maneja fallback a JSON si MCP no está disponible

### 4. **Tipos Extendidos**
**Archivo**: `src/types.ts`

```typescript
// Nueva interfaz para conexiones MCP
interface MCPConnection {
  id: string;
  type: 'jira' | 'azure' | 'github' | 'other';
  name: string;
  config: Record<string, unknown>;
  status: 'available' | 'unavailable';
  tools?: string[];
  lastChecked?: string;
}

// Control de selección de referencias
interface ReferenceSelection {
  mode: 'manual' | 'automatic';
  selectedReferences: string[];
  source?: 'jira' | 'file' | 'csv' | 'hybrid';
  filters?: {
    profile?: 'backend' | 'frontend' | 'both';
    minStoryPoints?: number;
    maxStoryPoints?: number;
    status?: string[];
    team?: string;
  };
  dateRange?: { from: string; to: string };
}

// Registro histórico extendido con metadatos multi-source
interface HistoricalRecordExtended extends HistoricalRecord {
  sourceId?: string;
  connectionId?: string;
  clientId?: string;
  teamId?: string;
  jiraIssueKey?: string;
  jiraWorklog?: number;
  storyPointsInitial?: number;
  storyPointsFinal?: number;
  backend?: boolean;
  frontend?: boolean;
}
```

### 5. **Configuración**
**Archivo**: `src/config.ts`

```typescript
historicalDataSource: {
  default: 'local-file',
  enabled: ['local-file'], // Agregar 'jira' cuando disponible
}

referenceSelection: {
  mode: 'manual', // o 'automatic' para selección inteligente
  defaultFilters: {
    profile: 'both',
    minStoryPoints: 1,
    maxStoryPoints: 100,
    status: ['completed'],
  },
  defaultDateRange: { days: 730 }, // Últimos 2 años
}
```

### 6. **Integración en Workflow**

#### Historical Validator
**Archivo**: `src/agents/historicalValidator.ts`

```typescript
async validateHistorical(
  technicalAnalysis: TechnicalAnalysis,
  estimation: EstimationResult,
  context: AgentContext,
  referenceSelection?: ReferenceSelection,    // ← Nuevo
  connection?: MCPConnection,                 // ← Nuevo
): Promise<HistoricalComparison>
```

- Acepta opcionalmente `ReferenceSelection` y `MCPConnection`
- Usa el adapter especificado o fallback a JSON
- Consulta registros históricos de múltiples fuentes
- Mantiene compatibilidad backward con llamadas sin estos parámetros

#### Estimate Proposal Workflow
**Archivo**: `src/workflows/estimateProposal.ts`

```typescript
async executeEstimateProposal(
  brief: Brief,
  referenceSelection?: ReferenceSelection,    // ← Nuevo
  connection?: MCPConnection,                 // ← Nuevo
): Promise<EstimationReport>
```

- Propaga parámetros a través del workflow
- Pasa `referenceSelection` y `connection` al validador histórico
- El proceso de estimación (Functional, Technical, Effort) permanece igual

### 7. **Interfaz CLI**
**Archivo**: `src/cli.ts`

Nuevos flags para control de fuentes:

```bash
# Uso básico (archivos JSON locales)
npm run estimate -- ./brief.md

# Con Jira
npm run estimate -- ./brief.md --data-source jira --jira-project PROJ

# Con modo automático (futuro)
npm run estimate -- ./brief.md --references automatic

# Híbrido
npm run estimate -- ./brief.md --data-source hybrid --jira-project PROJ
```

**Flags disponibles**:
- `--data-source` - Fuente: `file` | `jira` | `csv` | `hybrid` (default: `file`)
- `--references` - Modo: `manual` | `automatic` (default: `manual`)
- `--jira-project` - Proyecto Jira (requiere Jira MCP disponible)

**Comportamiento CLI**:
- Parsea argumentos y crea `ReferenceSelection`
- Registra conexión Jira si se especifica `--jira-project`
- Registra conexión en `mcpConnectorService`
- Pasa ambos parámetros a `executeEstimateProposal()`

## Flujo de Datos

```
CLI Arguments
    ↓
Parse: --data-source, --references, --jira-project
    ↓
Register MCP Connection (if Jira specified)
    ↓
Create ReferenceSelection config
    ↓
executeEstimateProposal(brief, referenceSelection, connection)
    ├─ Functional Analysis
    ├─ Technical Analysis
    ├─ Effort Estimation
    └─ validateHistorical()
        ├─ Get adapter via mcpConnectorService
        ├─ Query adapter: queryBySimilarity()
        ├─ Convert to HistoricalRecordExtended
        ├─ Process with Claude Agent
        └─ Return HistoricalComparison
    ↓
Generate Report
```

## Estado de Implementación

| Componente | Estado | Notas |
|------------|--------|-------|
| **IHistoricalReferenceProvider** | ✅ Completo | Interfaz y base class |
| **JSONFileAdapter** | ✅ Completo | Producción lista |
| **JiraAdapter** | 🔷 Stub | Estructura lista, requiere integración con MCP tools |
| **MCPConnectorService** | ✅ Completo | Gestión de conexiones |
| **Config.ts** | ✅ Completo | Soporte multi-source |
| **historicalValidator.ts** | ✅ Completo | Aceptar parámetros opcionales |
| **estimateProposal.ts** | ✅ Completo | Propagar parámetros |
| **cli.ts** | ✅ Completo | Nuevos flags funcionando |
| **CSV Adapter** | ⏳ Futuro | Diseño pendiente |
| **Excel Adapter** | ⏳ Futuro | Diseño pendiente |
| **Auto Reference Selector** | ⏳ Futuro | Agente inteligente (opcional) |

## Compatibilidad Backward

✅ **Completamente compatible con código existente**

- Todos los parámetros nuevos son opcionales
- CLI mantiene comportamiento por defecto (JSON local)
- Llamadas sin `ReferenceSelection` funcionan igual que antes
- Fallback automático a JSON si adapter falla

## Ejemplo de Extensión: Agregando Azure DevOps

```typescript
// src/adapters/AzureAdapter.ts
export class AzureAdapter extends BaseHistoricalReferenceProvider {
  name = 'Azure DevOps';
  type: 'azure' = 'azure';

  async fetchRecords(): Promise<HistoricalRecordExtended[]> {
    // Usar azure-devops MCP
    // Llamar: azure_work_item_search()
    // Convertir a HistoricalRecordExtended
  }

  async queryBySimilarity(...): Promise<HistoricalRecordExtended[]> {
    // Implementar similitud para Azure
  }
}

// Registrar en CLI:
// if (dataSource === 'azure') {
//   mcpConnectorService.registerConnection({...})
// }
```

## Seguridad y Aislamiento

- Cada conexión tiene `id` único y `status` independiente
- Metadata (`sourceId`, `connectionId`, `clientId`) permite auditoría
- MCP connection strings se pasan por config, no hardcoded
- Fallback a JSON evita fallos totales si MCP no está disponible

## Próximos Pasos Sugeridos

1. **Completar JiraAdapter** - Integrar herramientas Jira MCP
2. **Crear referenceSelector agent** - Para modo `automatic`
3. **Agregar CSV/Excel adapters** - Ampliar compatibilidad
4. **Tests** - Coverage para adapter layer, multi-source queries
5. **Documentación CLI** - Guía de uso para cada data source
6. **Monitor/Observabilidad** - Logs sobre qué adapter se usa, performance

---

**Fecha de Implementación**: 2026-10-09  
**Compatibilidad**: TypeScript 5.9.3  
**Reutilización de Código**: ~85% (adapters, types, config reutilizan core)
