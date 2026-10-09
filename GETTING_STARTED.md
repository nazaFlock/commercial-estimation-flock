# Guía de Inicio - Orquestador de Estimación

## Requisitos Previos

1. **Node.js 18+**: Instala desde https://nodejs.org
2. **npm 9+**: Viene con Node.js
3. **Claude CLI**: Instalado y logueado 

## Inicio Rápido (2 minutos)

### 1. Verificar que Claude CLI está configurado

```bash
claude login
# o verificar logueo existente:
claude --version
```

### 2. Instalar y compilar

```bash
npm install
npm run build
```

### 3. Ejecutar estimación

```bash
npm run estimate -- ./examples/brief-ecommerce.md
```

## Qué Pasa Después

El sistema:

1. **Lee** el brief comercial desde `examples/brief-ecommerce.md`
2. **Llama a Claude** vía Agent SDK (4 llamadas secuenciales, usando autenticación CLI)
3. **Genera** un reporte detallado en:
   - `outputs/estimations/{brief-id}/{report-id}.json` (datos estructurados)
   - `outputs/estimations/{brief-id}/{report-id}.md` (reporte formateado)

## Entender la Salida

### Salida en Consola

```
============================================================
ORQUESTADOR DE ESTIMACIÓN DE PROPUESTAS COMERCIALES
Brief: brief-ecommerce
============================================================

[2026-10-09T...] INFO: Analista funcional iniciando análisis...
[2026-10-09T...] INFO: Etapa 2: Análisis Técnico
[2026-10-09T...] INFO: Etapa 3: Estimación de Esfuerzo
[2026-10-09T...] INFO: Etapa 4: Validación Histórica

============================================================
ESTIMACIÓN COMPLETADA
============================================================

Esfuerzo Estimado (Probable): 1840 horas (230 días)
Nivel de Confianza: MEDIO

Reportes generados:
  JSON: outputs/estimations/abc123/report-xyz.json
  Markdown: outputs/estimations/abc123/report-xyz.md
```

### Estructura del Reporte JSON

```json
{
  "id": "report-unique-id",
  "briefId": "brief-id",
  "generatedAt": "2026-10-09T...",
  "executiveSummary": "...",
  "functionalAnalysis": {
    "projectObjective": "...",
    "modules": [...],
    "confidenceLevel": 0.75
  },
  "technicalAnalysis": {
    "components": [...],
    "technologyStack": [...],
    "risks": [...]
  },
  "estimation": {
    "tasks": [...],
    "profileEffort": [...],
    "moduleEffort": [...],
    "scenariosHours": {
      "minHours": 1500,
      "likelyHours": 1840,
      "maxHours": 2200,
      "minDays": 188,
      "likelyDays": 230,
      "maxDays": 275
    }
  },
  "historicalComparison": {...},
  "confidenceLevel": "medium",
  "confidenceJustification": "..."
}
```

### Reporte Markdown

Un reporte legible por humanos con:
- Resumen ejecutivo
- Desglose de esfuerzo por módulo y rol
- Análisis técnico y riesgos
- Supuestos y exclusiones
- Comparación histórica
- Elementos pendientes de validación

## Tareas Comunes

### Crear Tu Propio Brief

1. Crea un archivo `.md` con la descripción de tu proyecto:

```bash
cat > mi-proyecto.md << 'EOF'
# Título de Mi Proyecto

## Visión General
Breve descripción de qué estás construyendo.

## Funcionalidades Principales
- Funcionalidad 1: Descripción
- Funcionalidad 2: Descripción

## Contexto Técnico
- Stack tecnológico actual (si existe)
- Requerimientos de desempeño

## Restricciones
- Fecha límite
- Límites de presupuesto
- Requisitos de cumplimiento
EOF
```

2. Ejecuta la estimación:
```bash
npm run estimate -- ./mi-proyecto.md
```

### Agregar Datos de Proyectos Históricos

1. Crea un archivo JSON en `data/historical-estimates/`:

```bash
cat > data/historical-estimates/proyecto-pasado-001.json << 'EOF'
{
  "id": "hist-proj-2025-001",
  "projectId": "proj-2025-api",
  "projectType": "REST API",
  "scope": "API pública con autenticación y limitación de tasa",
  "technologies": ["Node.js", "Express", "PostgreSQL"],
  "functionalities": ["Autenticación", "CRUD", "Limitación de Tasa"],
  "complexity": "medium",
  "estimatedHours": 640,
  "actualHours": 720,
  "responsibleProfile": "Backend Lead",
  "date": "2025-06-15",
  "status": "completed",
  "fictitious": false
}
EOF
```

El validador automáticamente usará estos datos en futuras estimaciones.

### Modificar Configuración

Edita `src/config.ts` para cambiar:
- Modelo Claude (por defecto: `claude-opus-4-1`)
- Horas por día de trabajo (por defecto: 8)
- Contingencia de estimación (por defecto: 15%)

Luego recompila: `npm run build`

## Solucionar Problemas

### Error: "Claude CLI no configurado"

**Solución**: Configura tu autenticación CLI:
```bash
claude login
```

### Error: "Archivo de brief no encontrado"

**Solución**: Usa la ruta completa o relativa correcta a tu archivo brief:
```bash
npm run estimate -- ./path/to/brief.md
npm run estimate -- C:\ruta\completa\brief.md
```

### Error: "No se encontró JSON válido en respuesta de Claude"

**Solución**: 
- Verifica que tu CLI de Claude esté logueado correctamente
- Verifica límites de tasa en tu cuenta de Anthropic
- Asegúrate de que el brief esté claro y bien estructurado

### Los directorios de salida no se crean

**Solución**: Se crean automáticamente. Verifica permisos de archivo:
```bash
ls -la outputs/
# o en Windows:
dir outputs
```

## Referencia Rápida de Arquitectura

```
Brief (entrada)
    ↓
[Analista Funcional] → ¿Cuáles son los módulos y requerimientos?
    ↓
[Analista Técnico] → ¿Qué componentes técnicos se necesitan?
    ↓
[Estimador de Esfuerzo] → ¿Cuántas horas por tarea?
    ↓
[Validador Histórico] → ¿Cómo se compara con proyectos pasados?
    ↓
Reporte (JSON + Markdown salida)
```

Cada agente llama a Claude independientemente con instrucciones especializadas.

## Expectativas de Desempeño

| Operación | Tiempo Típico | Notas |
|-----------|---------------|-------|
| Lectura de brief | <1s | Solo I/O de archivo |
| Análisis funcional | 20-40s | Llamada a Claude API |
| Análisis técnico | 30-50s | Llamada a Claude API |
| Estimación de esfuerzo | 40-60s | Llamada a Claude API |
| Validación histórica | 30-50s | Llamada a Claude API + I/O de archivo |
| Generación de reporte | <5s | Procesamiento local |
| **Total** | **2-5 minutos** | Dependiendo de latencia de red |

## Qué Hace Este Sistema

✅ **Analiza** briefs comerciales para módulos, funcionalidades y requerimientos  
✅ **Diseña** componentes técnicos e identifica riesgos  
✅ **Estima** esfuerzo en horas con escenarios mín/probable/máx  
✅ **Valida** contra proyectos históricos similares  
✅ **Reporta** hallazgos en JSON estructurado y Markdown legible  

## Lo que este Sistema NO Hace

❌ **No ejecuta** ningún código ni hace deploy  
❌ **No accede** a APIs externas más allá de Anthropic  
❌ **No requiere** base de datos (usa almacenamiento de archivos)  
❌ **No proporciona** cálculos de precio o costo  
❌ **No hace** programación de proyectos de grano fino  

---

**¿Listo para estimar?** Ejecuta: `npm run estimate -- ./examples/brief-ecommerce.md`
