# План: доступ ролей к таблицам, полям и записям

Рабочий план, а не справочник: после завершения последнего этапа файл удаляется, а то, что остаётся
правилом, к этому моменту уже лежит в `CLAUDE.md` и `docs/*.md`. Отмечайте `[x]` по мере
выполнения. Каждый этап — отдельный коммит, проходит полный Definition of done (`CLAUDE.md` §2) и
остаётся незакоммиченным, пока пользователь не попросит.

## Принятые решения

1. **Умолчания.** Новая таблица получает умолчания роли. Новое поле наследует доступ таблицы, то есть
   открыто.
2. **Обход ограничений.** Владелец обходит всё. Держатель `TABLES_MANAGE` видит все таблицы и все
   поля, и ограничения полей на него не действуют. Его create/update/delete и их области всё равно
   берутся из конфигурации роли.
3. **Row-level нужен.** Для read, update и delete действует область `NONE | OWN | ALL`, для create —
   булево. `OWN` означает `Record.createdById = user.id`.
4. **Связи.** Поле RELATION, у которого целевая таблица для роли невидима, считается скрытым. Если
   скрыто поле-метка цели, показывается только номер записи. Обязательное поле, которое роль не может
   редактировать, при `canCreate` запрещено конфигурацией: отказ при сохранении роли и при пометке
   поля обязательным.

## Модель

Порядок областей: `NONE < OWN < ALL`. Порядок доступа к полю: `HIDDEN < READ < EDIT`. `EDIT` не
хранится, это отсутствие строки.

```prisma
enum RecordScope { NONE OWN ALL }
enum FieldAccess { HIDDEN READ }

model WorkspaceRole {
  // …
  // умолчания для таблиц без собственной настройки
  readScope   RecordScope @default(ALL)
  canCreate   Boolean     @default(false)
  updateScope RecordScope @default(NONE)
  deleteScope RecordScope @default(NONE)
  tableAccess RoleTableAccess[]
  fieldAccess RoleFieldAccess[]
}

/** Строка есть, только если таблица настроена отдельно; тогда она целиком заменяет умолчания роли. */
model RoleTableAccess {
  workspaceId String
  roleId      String
  tableId     String
  readScope   RecordScope
  canCreate   Boolean
  updateScope RecordScope
  deleteScope RecordScope
  role  WorkspaceRole @relation(fields: [workspaceId, roleId], references: [workspaceId, id], onDelete: Cascade)
  table Table         @relation(fields: [workspaceId, tableId], references: [workspaceId, id], onDelete: Cascade)
  @@id([roleId, tableId])
  @@index([tableId])
}

/** Строка есть, только если поле урезано. */
model RoleFieldAccess {
  workspaceId String
  roleId      String
  fieldId     String
  access      FieldAccess
  role  WorkspaceRole @relation(fields: [workspaceId, roleId], references: [workspaceId, id], onDelete: Cascade)
  field Field         @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  @@id([roleId, fieldId])
  @@index([fieldId])
}
```

- У `Field` нет `workspaceId`, поэтому принадлежность поля к пространству проверяет сервис при записи
  (поле ищется через `table: { workspaceId }`), а не FK.
- `Table` получает `@@unique([workspaceId, id])` ради составного FK, по образцу ролей
  (`decisions.md` → _A role is referenced with its workspace_).
- `RECORDS_CREATE/UPDATE/DELETE` уходят из `WorkspacePermission`: их заменяют колонки умолчаний.

**Эффективный доступ** (одна чистая функция в `shared/utils/`, общая для сервера и клиента):

```ts
interface ITableAccess {
  readScope
  canCreate
  updateScope
  deleteScope
}
interface IEffectiveTableAccess extends ITableAccess {
  fieldAccess: Record<fieldId, 'HIDDEN' | 'READ' | 'EDIT'>
}
resolveTableAccess({
  isOwner,
  permissions,
  roleDefaults,
  tableOverride,
  fieldOverrides,
  fields,
  targetReadable,
})
```

- Владелец: всё `ALL`/`true`/`EDIT`.
- `TABLES_MANAGE`: `readScope = ALL`, все поля без override (`EDIT`), действия — из override или
  умолчаний.
- Остальные: override таблицы ?? умолчания роли. Поле: override ?? (`EDIT`, если `updateScope ≠ NONE`
  или `canCreate`, иначе `READ`). RELATION с нечитаемой целевой таблицей даёт `HIDDEN`.

---

## Этап 1 — Схема и миграция (поведение не меняется) ✅

- [x] `prisma/schema.prisma`: enum'ы `RecordScope`, `FieldAccess`, колонки умолчаний на
      `WorkspaceRole`, модели `RoleTableAccess` и `RoleFieldAccess`, `Table @@unique([workspaceId, id])`,
      `Record @@index([tableId, createdById])` для фильтра `OWN`.
- [x] Миграции `20261116120000_role_record_access` (одна транзакция: колонки → бэкфилл →
      `array_remove` → пересоздание enum → unique на `Table` → две таблицы доступа) и
      `20261116120100_record_created_by_index` (`CREATE INDEX CONCURRENTLY`, один оператор).
      Бэкфилл проверен на dev-базе: Admin/Editor → `true/ALL/ALL`, Viewer → `false/NONE/NONE`.
- [x] `shared/constants/workspace.ts`: `WORKSPACE_PERMISSIONS` без `RECORDS_*`; `RECORD_SCOPES`,
      `RECORD_ACTIONS`, `FULL_TABLE_ACCESS` (у владельца).
- [x] `shared/types/workspace.ts`: `TRecordScope`, `TRecordAction`, `ITableAccess`; `IPermissionSet`
      = `permissions` + `recordDefaults`, актёр, роль и участник несут его.
- [x] `server/db/workspaces.ts`: `DEFAULT_WORKSPACE_ROLES` с умолчаниями; `permissionSetSelect`,
      `toPermissionSet`, `buildPermissionSetWhere` (защищённые записи ролей и участников сверяют
      и колонки записей).
- [x] Мост в `assertAccess`: маршруты записей по-прежнему называют `RECORDS_CREATE/UPDATE/DELETE`,
      но это уже не права, а действия, которые читаются из `recordDefaults` через `hasRecordAction`.
      Этап 2 его убирает.
- [x] Клиент: в `RoleFormModal` два fieldset'а, «Workspace» и «Records». Изменение и удаление —
      пока чекбоксы «на всех записях / ни на одной» (`applyRecordAction`); выбор
      «никакие / свои / все» откроется на этапе 3. `summarisePermissions(set)`, `toGrantCount` (самая
      узкая роль в приглашении), `useActiveWorkspace().hasRecordAction`.
- [x] `shared/validation/workspace.ts`: `roleInputSchema.recordDefaults`. **Принимает только то, что
      сервер уже применяет**: `readScope` — только `ALL`, `updateScope`/`deleteScope` — `NONE | ALL`.
      Этап 2 расширяет `readScope` до `NONE | ALL`, этап 3 открывает `OWN`.
- [x] Анти-эскалация (`shared/utils/permissions.ts`): `isScopeWithin`, `isTableAccessWithin`;
      `canAssignRole`/`canCreateRole`/`canEditRole`/`canManageMember` сравнивают весь
      `IPermissionSet`.
- [x] Seed не перечисляет права — менять нечего. Хелперы тестов в `test/membership.ts`:
      `buildRecordDefaults`, `buildPermissionSetRow`, `buildRoleInput`.
- [x] Тесты: unit (области, действия, права, валидация, мост, сервисы ролей/участников/приглашений);
      интеграционные (умолчания ролей, хранение `recordDefaults`, анти-эскалация по действию с
      записями через API). Отдельного автотеста миграции нет: интеграционный прогон применяет её к
      чистой базе, бэкфилл проверен вручную на dev-базе.

## Этап 2 — Эффективный доступ и видимость таблиц ✅

- [x] `shared/utils/table-access.ts`: `resolveTableAccess(actor, override)` (владелец — всё; строка
      таблицы целиком заменяет умолчания; `TABLES_MANAGE` — `readScope = ALL`, действия свои),
      `isTableVisibilityBypassed`, `canReadRecords`.
- [x] `server/db/tables.ts`: `buildRoleTableAccessSelect(roleId)`, `toTableOverride`,
      `buildReadableTablesWhere(membership)` (`some … not NONE` при умолчании `NONE`, иначе
      `none … NONE`; владельцу и `TABLES_MANAGE` — без фильтра). `TableService.listTables(membership)`.
- [x] `server/utils/table-access.ts`: все лукапы принимают членство и в том же запросе читают строку
      роли для таблицы; нечитаемая таблица — тот же 404. `assertRecordAction` (403 «… records in
      this table»), `assertTableHasFields` (вместо `requireRecordFields`; проверяется **после**
      действия, чтобы участник без права получал 403, а не 400). `requireFieldTarget(membership, …)`.
- [x] `server/utils/handler.ts`: контекст табличных фабрик несёт `access: ITableAccess`;
      `TTableRouteAccess = TWorkspaceAccess | TRecordAction`; маршруты записей называют
      `create`/`update`/`delete`, действие проверяется после лукапа. Мост этапа 1 удалён.
- [x] `GET /tables` фильтрует, `GET /tables/:t` отдаёт `{ table, access }`; `useTableLoader`
      возвращает весь ответ; страница записей берёт действия из `access`
      (`useActiveWorkspace().hasRecordAction` удалён).
- [x] `useAccessResync`: после 403 кроме членства делает `refreshNuxtData()` — доступ таблицы
      приходит с данными страницы, иначе кнопки не прятались бы после отказа.
- [x] e2e-фикстура сбрасывает и колонки записей ролей, и строки `RoleTableAccess`/`RoleFieldAccess`;
      новый e2e: скрытая таблица не в сайдбаре, её адрес — 404.
- [x] Тесты: unit (резолвер, лукапы, `where` списка, resync), интеграционные (скрытая таблица → 404 на
      всех табличных маршрутах и нет в списке; строка таблицы расширяет Viewer и сужает Editor;
      `TABLES_MANAGE` видит скрытую без расширения действий), e2e — все проходят.
- Перенесено: доступ к полям (выбор `fieldAccess` в лукапе, поля с `access` в `GET /fields`,
  видимость целевых таблиц RELATION) — в этап 4, где он применяется; расширение `readScope` в
  `roleInputSchema` и выбор чтения в форме — в этап 6/7: без строк таблиц умолчание «не видеть»
  скрыло бы все таблицы, а строки пока задать нечем.
- Известное до этапа 4: метки связей из скрытой таблицы всё ещё видны в связанной; пикер связи
  предлагает её записи.

## Этап 3 — Row-level (`OWN`) ✅

- [x] `roleInputSchema`: `readScope` умолчаний — `OWN | ALL` (`NONE` — с редактором строк таблиц,
      этап 6/7), `updateScope`/`deleteScope` — `NONE | OWN | ALL`, и действие не шире чтения
      (`superRefine`, ошибка на ключе). В `RoleFormModal` — выборы «Records they see / can edit /
      can delete» и галочка «Add records»; шире своей роли и шире чтения — `disabled`, сужение
      чтения сужает действия (`applyReadScope`). `applyRecordAction` удалён; сводка роли называет
      «Edit own records», «Sees only own records»; `toGrantCount` весит область.
- [x] `server/db/records.ts`: `buildRecordScopeWhere(scope, userId)` (`OWN` → `createdById`,
      `NONE` → ничего), `buildRecordAddressWhere(…, scope)` вкладывает её в уникальный `where`.
      `record-sql.ts`: `buildRecordWhere(reader: IRecordReader, …)` — `"createdById" = …` сразу после
      `"tableId"`; список, счётчик и поиск идут через неё.
- [x] `RecordService` принимает `IRecordActor { userId, access }`: деталь — в области чтения (чужая —
      404); update/delete — область действия в `where`, промах объясняется чтением в области чтения:
      403 «You can only edit/delete your own records» → 412 → 404 (сначала область, потом версия).
- [x] `IRecord.createdById` (в списке и ответах записей); `canUpdateRecord`/`canDeleteRecord`/
      `canCountRecords` в `shared/utils/table-access.ts`.
- [x] `_count.records` — `null`, если чтение не `ALL` (`toSharedTableListItem(row, access)`; все
      пути строки списка передают доступ). Сайдбар, главная (итог через `toRecordTotal` —
      `null`, если хоть один скрыт), настройки таблицы и удаление пространства это показывают.
- [x] Клиент: `RecordsTable` принимает `canEdit`/`canDelete(record)` — кнопки по строке.
- [x] Тесты: unit (`where` и SQL при каждой области, промахи 403/412/404, схема, хелперы, форма,
      счётчики), интеграционные (`OWN` видит и считает только свои, 403 и 404 различаются, область
      раньше версии, запись без автора не видна никому).
- [x] `limitations.md`: номера записей ограничивают сверху число чужих; запись без автора ничья.
      `decisions.md`: область в `where`, отказ — сначала область.
- Известное до этапа 4: пикер связи и метки связей показывают записи целевой таблицы вне области
  чтения (`OWN`), как и записи скрытой таблицы.

## Этап 4 — Скрытые поля ✅

- [x] `shared/utils/table-access.ts`: `resolveFieldAccess(actor, tableAccess, override)` —
      владелец и `TABLES_MANAGE` → `EDIT`; иначе строка поля ?? (`EDIT`, если роль пишет записи,
      иначе `READ`). Типы `TFieldAccess`/`TFieldAccessOverride`.
- [x] Лукап (`server/utils/table-access.ts`) читает строки роли для полей в том же запросе
      (`buildRoleFieldAccessSelect`). Контекст: `fields` — видимые, `editableFields` — `EDIT`,
      `targetScopes` — область чтения каждой цели связи. Отсюда валидация, фильтры, сортировка,
      поиск и ответы скрытого поля не видят: фильтр по нему игнорируется как неизвестный, сортировка
      — 400, поиск не находит (префильтр не решает один — спека).
- [x] Связи — `toFieldView`, цели одним запросом (`listRelationTargetViews`; для обхода — ни
      одного): нечитаемая цель → поле скрыто; скрытое поле-метка **или цель с `readScope ≠ ALL`** →
      из поля убирается `labelFieldKey`, и метки, сортировка по метке и поиск пикера сами падают на
      номер. Отступление от плана: при `OWN` у цели номера и у своих записей — метки своих
      потребовали бы области в джойне сортировки (`limitations.md`).
- [x] `RelationService`: пикер при `OWN` у цели — только свои записи; `assertRelationTargets` —
      новая ссылка вне области чтения цели → 400 «you can only link to your own records», уже
      сохранённая остаётся (данные записи читаются, только если такая ссылка встретилась).
- [x] Проекция: `toSharedRecord(row, fields)` оставляет только ключи видимых полей — список,
      деталь, ответы create/update.
- [x] Запись слиянием: `buildRecordMergeUpdate` (`record-sql.ts`) — `data || patch`, `updatedAt`
      и `updatedById` ставятся сами, область и версия в `WHERE`, `RETURNING` даёт версию. Промах —
      та же развилка 403 → 412 → 404. Схема записи строится по `editableFields`.
- [x] `GET /fields` отдаёт видимые поля из контекста; `FieldService.listFields` удалён. Опции
      скрытого поля — 404 (поле не находится в видимых).
- [x] Тесты: unit (резолвер поля, лукап и вид связи, проекция, SQL слияния, инвариант поиска,
      пикер и ссылки при `OWN`), интеграционные (скрытое поле нигде не видно; сохранение ролью не
      трогает скрытое и read-only; create без скрытого ключа; фильтр/сортировка/поиск; связь со
      скрытой целью, со скрытой меткой, с целью `OWN`; If-Match через сырой UPDATE).
- [x] Документы: `architecture.md` (§6 вид связи, §10 лукап, проекция, слияние), `decisions.md`
      (слияние), `limitations.md` (номера вместо меток при частичном чтении цели).
- Перенесено в этап 5: доступ поля (`access`) в ответе `GET /fields` — его первым читает форма.
- Известное до этапа 5: обязательное поле, скрытое от роли с `canCreate`, при создании остаётся
  пустым — конфигурацию запретит проверка этапа 5.

## Этап 5 — Поля только для чтения ✅

- [x] `GET /fields` отдаёт `readOnlyFieldIds` (видимые, но не `EDIT`); стор полей хранит их
      `Set`'ом — только из списка: поля создаёт и меняет менеджер, который пишет всё.
- [x] `RecordForm`: поле из `readOnlyFieldIds` рисуется `RecordFieldValue` в `BaseField` с
      подсказкой «Read only», на своём месте среди контролов; без ветвления по типу.
      `RecordFormModal` строит схему, начальные значения и payload только из редактируемых полей;
      при создании read-only поля не показываются — у новой записи им нечего показать.
- [x] `FieldService.updateField`: пометка `required` → 409 «Role "X" can add records but cannot fill
      "Y"», если роль без `TABLES_MANAGE` создаёт записи в таблице (строкой таблицы или умолчанием)
      и держит поле `HIDDEN`/`READ`. Один `findFirst` по `RoleFieldAccess`. `createField` не
      проверяет: у нового поля строк ещё нет.
- [x] Тесты: nuxt (форма: значение вместо контрола и без событий; модалка: payload только из
      редактируемых, при создании read-only нет; стор), unit (сервис поля: 409, форма запроса, без
      запроса для необязательного), интеграционные (`readOnlyFieldIds`; 409 для `HIDDEN`/`READ`;
      пропуск, когда строка таблицы снимает `canCreate`), e2e (read-only поле в форме, значение
      после сохранения на месте).
- [x] Документы: `architecture.md` (`RecordForm`, лукап), `decisions.md` (обязательное поле
      должно быть заполнимо).
- Этапу 6: обратная проверка при сохранении доступа роли — та же функция; проверки с двух
  сторон могут разминуться в гонке, поэтому сохранение доступа роли и пометку `required` стоит
  сериализовать (блокировка строки таблицы в обеих транзакциях).

## Этап 6 — API доступа роли и анти-эскалация

- [ ] `roleInputSchema`: `readScope` умолчаний расширяется до `NONE | ALL` (с этапа 3 — и `OWN`).

- [ ] `shared/validation/role-access.ts`: `roleAccessSchema` = `recordDefaults` + `tables: [{ tableId,
...ITableAccess }]` + `fields: [{ fieldId, access }]`; дубликаты запрещены.
- [ ] `GET /roles/:roleId/access` (`ROLES_MANAGE`) → умолчания, override'ы и для редактора таблицы
      пространства с полями (id, имя, тип, required). `PUT /roles/:roleId/access` (`ROLES_MANAGE`,
      If-Match по `role.updatedAt`) — заменяет все override'ы атомарно в транзакции
      (`deleteMany` + `createMany`) и двигает `updatedAt` роли.
- [ ] Проверки в `RoleService.updateRoleAccess`:
  - каждый `tableId`/`fieldId` принадлежит пространству (один запрос с `workspaceId`), иначе 404;
  - поле относится к таблице без `readScope = NONE` — override у поля невидимой таблицы бессмыслен,
    его отбрасываем или отклоняем (400);
  - правило required + create (решение 4) → 409 с именами роли, таблицы и поля;
  - анти-эскалация.
- [ ] Анти-эскалация в `shared/utils/permissions.ts`: `isAccessWithin(next, actor, tables)` сравнивает
      **эффективный** доступ по каждой таблице и каждому полю (`isScopeWithin`, порядок полей).
      `canEditRole`, `canAssignRole`, `canManageMember`, `canCreateRole` переходят на него.
      Эффективный доступ актёра собирается из его роли тем же `resolveTableAccess`. Защищённая запись
      (`buildGuardedRoleWhere`) охраняет и `updatedAt`, а не только `permissions`.
- [ ] Клиенту для выбора роли (приглашение, смена роли) нужен ответ «можно ли назначить»: `GET /roles`
      отдаёт доступ каждой роли держателям `ROLES_MANAGE`/`MEMBERS_MANAGE`/`MEMBERS_INVITE`
      (ограничено капом ролей и таблиц), остальным — без него. Решение одно — общая функция.
- [ ] Тесты: unit на `isAccessWithin` (таблица шире, поле шире, OWN против ALL, невидимая таблица у
      актёра); service со стабом (каждый отказ, форма транзакции); интеграционный тест атомарной
      замены и каскадов (удаление таблицы, поля, роли).

## Этап 7 — Редактор доступа роли (UI)

- [ ] Страница `settings/roles/[roleId].vue` (матрица не помещается в модалку), вход — из списка
      ролей. `RoleFormModal` остаётся для имени и прав пространства.
- [ ] Секции: «Умолчания для записей» (как этап 1, плюс чтение); «Таблицы» — список с режимом
      «по умолчанию / своя настройка», для своей — чтение / добавление / изменение / удаление;
      раскрытие таблицы показывает поля с выбором «скрыто / только чтение / редактирование».
      Недоступные актёру значения не предлагаются (`isAccessWithin`), а не дизейблятся.
- [ ] Состояния загрузки, пустое и ошибка; 412 → баннер «роль изменилась»; клавиатурный путь и
      фокус; цели ≥ 36px для элементов, меняющих значение.
- [ ] Сверка с `docs/design/` (preview `design`, ~1024px). Если там нет такого экрана — предложить
      обновление референса, а не выдумывать стиль.
- [ ] `useForm` для страницы, стор `roles` получает `fetchRoleAccess`/`saveRoleAccess`, URL — в
      `app/api/`.
- [ ] Seed: второй пользователь с урезанной ролью (скрытая таблица, скрытое поле, `OWN` на
      изменение), чтобы проверять вручную; учётные данные — в `README.md`.
- [ ] Тесты: nuxt-спеки страницы и стора.

## Этап 8 — e2e и документация

- [ ] e2e (`test/e2e/`): скрытая таблица не видна в сайдбаре и по прямой ссылке даёт «не найдено»;
      скрытое поле отсутствует в таблице, форме, фильтрах и деталях; сохранение записи ролью без
      доступа к полю не стирает его значение (проверка под админом); `OWN` — меню строки только на
      своих; read-only поле в форме; редактор роли — клавиатурный путь и axe.
- [ ] `CLAUDE.md`: §1 — доступ по таблицам и полям переезжает из out of scope в scope; §5 — коды
      статусов (403 для чужой записи при `OWN`, 404 для невидимой таблицы и поля); короче, без
      дублирования companion-документов.
- [ ] `docs/architecture.md`: эффективный доступ, где он вычисляется и как доезжает до фабрик;
      проекция `data`; запись слиянием.
- [ ] `docs/decisions.md`: умолчания роли — колонки, а не значения enum (отвергнуто: `RECORDS_*` +
      отдельный OWN-флаг); override таблицы целиком заменяет умолчания (отвергнуто: послойное
      слияние флагов); `TABLES_MANAGE` обходит видимость; запись слиянием (отвергнуто: замена `data`
      — стирает скрытое); RELATION на невидимую цель скрыт (отвергнуто: показ номеров); required +
      create — запрет конфигурации.
- [ ] `docs/limitations.md`: записи без автора не видны при `OWN`; другие оставленные ограничения,
      если появятся по ходу.
- [ ] Удалить этот файл и ссылку на него из `CLAUDE.md` §1.
