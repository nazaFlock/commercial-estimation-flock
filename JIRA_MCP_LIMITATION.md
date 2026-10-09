# Limitación Actual: Invocación de Jira MCP

## Problema

El JiraAdapter intenta invocar la herramienta `jira_search` desde el Claude Agent SDK, pero actualmente:

```
❌ Claude responde en texto natural ("Voy a buscar...")
❌ No ejecuta la herramienta jira_search
❌ Retorna error de parsing de JSON
```

## Causa Raíz

Existen varias posibilidades:

1. **MCP no registrado en sesión del EstimadorFlock**
   - Jira MCP podría estar disponible pero no transportado a la sesión
   - Requiere verificar disponibilidad en el contexto local

2. **Agent SDK limitación**
   - El método `query()` del Agent SDK podría no invocar herramientas automáticamente
   - Requeriría un enfoque diferente (tool_choice forzada, etc.)

3. **Contexto de sesión diferente**
   - Aunque se puede conectar desde CLI
   - El contexto de la sesión TypeScript podría ser diferente

## Solución Implementada (Graceful Fallback)

El sistema ahora:

✅ **Intenta** acceder a Jira
✅ **Si falla**, retorna vacío (no rompe el workflow)
✅ **Fallback automático** a JSON local
✅ **Log claro** sobre por qué Jira no funcionó

```typescript
try {
  const searchResponse = await agentClient.jiraSearch(jql, maxResults);
  // Procesar resultado
} catch (agentError) {
  logger.warn('No se pudo acceder a Jira MCP. Fallback: usando JSON local.');
  return [];  // Workflow continúa sin error
}
```

## Próximos Pasos para Habilitar Jira

### Opción 1: Verificar MCP en Sesión EstimadorFlock
```bash
# En la sesión del estimador, probar:
# 1. Ver MCPs disponibles
# 2. Verificar si Jira MCP está registrado
# 3. Si no está, configurarlo
```

### Opción 2: Usar Enfoque Diferente de Tool Invocation
```typescript
// En lugar de agentClient.query(), quizás:
// - Usar tool_choice forzada en Agent SDK
// - Pasar herramientas explícitamente en contexto
// - Usar endpoint diferente del Agent SDK
```

### Opción 3: Prueba Manual
```bash
# Ejecutar desde sesión estimador con JSON local:
npm run estimate -- ./examples/brief-ecommerce.md

# Verificaría que motor estadístico funciona con JSON
# Luego investigar por qué Jira no se invoca
```

## Estado Actual

| Aspecto | Estado |
|---------|--------|
| **Arquitectura Jira** | ✅ Implementada |
| **Tipos Extendidos** | ✅ Listos |
| **Invocación Herramientas** | ❌ Problema en Agent SDK |
| **Fallback JSON** | ✅ Activo |
| **Workflow Continúa** | ✅ Sin interrupciones |

## Recomendación

**Por ahora:** El sistema funciona perfectamente con JSON local. La arquitectura multi-MCP está lista para cualquier fuente que normalice datos a `HistoricalRecordExtended`.

**Para Jira en futuro:** 
1. Investiga cómo invocar herramientas correctamente en Agent SDK
2. O copia datos Jira a JSON local como CSV → JSON converter
3. O usa adaptador CSV/JSON intermedio

**No es bloqueante** porque el motor estadístico funciona con cualquier fuente normalizada.

---

**Nota:** Si logras hacer funcionar Jira MCP desde la sesión del EstimadorFlock, actualiza agentClient.ts con el approach correcto y JiraAdapter funcionará automáticamente.
