# Workflow Designer — React + Vite + TypeScript

Прототип визуального Workflow Designer для сетевого polling-приложения. Это перенос последней HTML-версии в модульную архитектуру, где UI не содержит бизнес-логику исполнения workflow.

## Запуск

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Архитектура

```text
src/
├── app/
│   ├── App.tsx
│   └── styles.css
│
├── domain/workflow/
│   ├── model.ts           # WorkflowDefinition / Node / Edge / NodeResult
│   ├── defaults.ts        # defaults + demo workflow
│   ├── contextPath.ts     # $raw.interfaces -> nested object access
│   └── validation.ts      # pure workflow validation
│
├── application/runtime/
│   ├── contracts.ts       # ScriptRunner, SnmpClient, NodeExecutor contracts
│   ├── executors.ts       # Start/Decision/SNMP/Script executors
│   └── workflowEngine.ts  # orchestration and edge resolution
│
├── infrastructure/
│   ├── browser/
│   │   └── browserScriptRunner.ts # JavaScript in Web Worker + timeout
│   └── mock/
│       └── mockSnmpClient.ts      # mock SNMP for the designer
│
└── features/designer/
    ├── state/
    │   └── DesignerContext.tsx    # editor state/history/runtime actions
    └── components/
        ├── Toolbar.tsx
        ├── NodePalette.tsx
        ├── WorkflowCanvas.tsx
        ├── NodeCard.tsx
        ├── EdgeLayer.tsx
        ├── Inspector.tsx
        ├── ExecutionPanel.tsx
        └── ValidationPanel.tsx
```

## Главная граница

React Designer редактирует `WorkflowDefinition`. `WorkflowEngine` ничего не знает о React/canvas/drag&drop.

```text
React Designer ───────► WorkflowDefinition
                            │
                    ┌───────┴─────────┐
                    ▼                 ▼
                Validator       WorkflowEngine
                                      │
                              NodeExecutor registry
                               /      |       \
                           SNMP    Decision   Script
```

Это позволяет позже заменить browser infrastructure:

```text
Browser prototype                  Production .NET
-----------------                  ---------------
MockSnmpClient          ───────►   ISNMPCommandExecutor
BrowserScriptRunner     ───────►   JintScriptRunner
React execution debug   ───────►   API / SSE execution events
```

при сохранении модели workflow и принципов выполнения.

## Реальный Script Node

Config:

```json
{
  "scriptKey": "normalize-interfaces",
  "input": "$raw.interfaces",
  "output": "normalized.ports",
  "timeoutMs": 1500,
  "scriptSource": "function execute(input, context) { return input; }"
}
```

Обычный return записывается в `output`.

```js
function execute(input, context) {
  return input.map((x, index) => ({
    index: index + 1,
    name: x.name
  }));
}
```

Script также может вернуть NodeResult-подобный объект:

```js
function execute(input, context) {
  return {
    success: true,
    decision: input.length ? "HAS_DATA" : "EMPTY",
    outputs: {
      "normalized.ports": input
    }
  };
}
```

### Важно о sandbox

Web Worker + timeout в браузере защищают UI от зависшего скрипта, но **не являются security sandbox**. Для production скрипт должен выполняться на backend в ограниченном runtime (например Jint) с запретом filesystem/network/process/reflection и с лимитами времени/ресурсов.

## Что уже работает

- drag Node по canvas;
- pan/zoom и Fit;
- drag&drop Node из Palette;
- создание Edge мышкой port -> port;
- Condition/Priority для Edge;
- Node/Edge inspector;
- вставка Node до/после/в Edge;
- delete + reconnect;
- Undo/Redo;
- snap-to-grid;
- JSON import/export;
- workflow validation;
- пошаговое и автоматическое выполнение;
- WorkflowContext / NodeResult / execution log;
- Script Node через Web Worker;
- mock SNMP GET/WALK.

## Следующие production-шаги

1. `Draft -> Validate -> Published -> Archived`, опубликованные версии immutable.
2. Backend API для CRUD workflow и versioning.
3. Выполнение workflow на .NET backend, UI получает execution events через SSE/WebSocket.
4. Script repository/versioning отдельно от workflow.
5. Typed Node schemas и server-side validation.
6. Настоящий SNMP executor вместо mock.
7. Breakpoints / Run from here / persisted WorkflowRun + NodeRun.
