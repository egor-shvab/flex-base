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

## Этап 2 — Эффективный доступ и видимость таблиц

- [ ] `shared/utils/table-access.ts`: `resolveTableAccess` (см. «Модель»), `canReadRecords`
      (`isScopeWithin` уже есть в `shared/utils/permissions.ts`). Unit-спеки: владелец, `TABLES_MANAGE`, override против умолчаний, поле
      по умолчанию, RELATION на невидимую таблицу.
- [ ] `server/db/tables.ts`: `buildReadableTablesWhere(roleId, roleDefaults)` — если умолчание
      `readScope = NONE`: `tableAccess: { some: { roleId, readScope: { not: NONE } } }`, иначе
      `NOT: { tableAccess: { some: { roleId, readScope: NONE } } }`. Для владельца и `TABLES_MANAGE`
      фильтр не применяется.
- [ ] `server/utils/table-access.ts`: `requireTableWithFieldRows` получает членство и в **том же
      запросе** выбирает `tableAccess: { where: { roleId } }`, а у полей
      `fieldAccess: { where: { roleId } }`. Для RELATION-полей видимость целевых таблиц доезжает одним
      дополнительным запросом на все цели сразу (без запросов в цикле). Таблица с
      `readScope = NONE` отдаёт тот же 404, что и несуществующая.
- [ ] `server/utils/handler.ts`: контекст табличных фабрик получает `access: IEffectiveTableAccess`.
      Записи объявляются по действию (`TRecordAction` уже есть: `create | update | delete`; чтение
      добавить отдельно) вместо `TWorkspaceAccess`. Действие с областью `NONE` отдаёт 403 (сообщения в духе
      `DENIED_ACTIONS`). Схемные маршруты (поля, таблицы) остаются на `TABLES_MANAGE`.
- [ ] Убрать мост этапа 1 и записи `RECORDS_*` из `DENIED_ACTIONS`; `READ` у таблиц теперь значит
      «членство + `readScope ≠ NONE`», а не только членство (переписать комментарий в
      `workspace-access.ts`).
- [ ] `GET /tables` фильтрует; `GET /tables/:t` и `GET /fields` отдают `access` вызывающего (поля с
      `access: 'READ' | 'EDIT'`, скрытые не отдаются вовсе). Типы ответа в `shared/types/api.ts`.
- [ ] Удаление пространства и вкладка danger считают записи по всем таблицам — это владелец, фильтр
      не применяется; проверить, что `_count` не идёт через отфильтрованный список.
- [ ] Клиент: `hasRecordAction(...)` в
      `pages/w/[workspaceAddress]/tables/[tableAddress]/index.vue` заменяется доступом из ответа
      таблицы (через стор `tables`/`fields`). Сайдбар уже получает отфильтрованный список.
- [ ] `roleInputSchema`: `readScope` расширяется до `NONE | ALL`; в `RoleFormModal` — выбор чтения.
- [ ] Тесты: service/utils со стабом prisma (форма `where`, один запрос на лукап); интеграционные
      тесты: невидимая таблица → 404 на всех табличных маршрутах и отсутствует в списке; права по
      таблицам переопределяют умолчания.

## Этап 3 — Row-level (`OWN`)

- [ ] `roleInputSchema` открывает `OWN` для всех трёх областей; в `RoleFormModal` чекбоксы изменения
      и удаления становятся выбором «никакие / свои / все» (`applyRecordAction` уходит).

- [ ] `buildRecordWhere` получает область чтения: `OWN` добавляет `"createdById" = ${userId}`.
      Список, счётчик и поиск идут через неё. Запись без автора (`createdById = NULL`) не принадлежит
      никому и для `OWN` не видна (в `limitations.md`).
- [ ] `getRecordDetail`: при `OWN` `where` содержит `createdById` → чужая запись даёт 404.
- [ ] `updateRecord`/`deleteRecord`: область действия в `where` (`createdById` при `OWN`). При промахе
      — как сейчас с версией: запись есть в области чтения → 403 «You can only edit/delete your own
      records», нет → 404; устаревшая версия по-прежнему 412. Сначала область, потом версия: чужая
      запись с правильной версией — 403, а не 412.
- [ ] Строки списка несут `createdById` (только id — авторство уже открыто участникам);
      `shared/utils/table-access.ts`: `canUpdateRecord(access, record, userId)` и
      `canDeleteRecord(…)` — одна функция для меню строки и сервера.
- [ ] `Table.recordCount` при `readScope = OWN` раскрывает число чужих записей: в ответе таблицы
      отдавать `null`, если область не `ALL` (настройки таблицы уже умеют `recordCount === null`).
- [ ] Клиент: `RecordsTable`/`RecordRowMenu` — editable/deletable по строке, а не по таблице.
- [ ] Тесты: `where` при каждой области (стаб); интеграционные тесты: `OWN` видит только свои,
      403 и 404 различаются, гонка версии.

## Этап 4 — Скрытые поля

- [ ] Контекст фабрик отдаёт `fields` уже без `HIDDEN`. Через это автоматически работают валидация,
      фильтры, сортировка и поиск. Проверить:
  - фильтр или сортировка по скрытому ключу отклоняется или игнорируется так же, как по неизвестному
    (не 500 и не утечка через «0 результатов»);
  - префильтр `record_search_text(data, number)` охватывает весь `data`, но без OR-группы видимых
    полей не применяется (`buildRecordSearch` возвращает `null`, если нет плеч) — инвариант
    сохраняется, добавить спеку.
- [ ] Проекция ответа: `toSharedRecord(row, visibleFields)` в `server/db/records.ts` оставляет в
      `data` только видимые ключи. Применяется в списке, деталях и в ответах create/update (иначе
      слитые данные вернут скрытое).
- [ ] **Запись слиянием.** `updateRecord` переходит на сырой
      `UPDATE "Record" SET data = data || ${patch}::jsonb, "updatedAt" = now(), "updatedById" = …
WHERE id/tableId [AND "updatedAt" = v] [AND "createdById" = u] RETURNING …` (SQL — в
      `server/db/records.ts`). Ловушка: `@updatedAt` ставит только Prisma Client, в сыром SQL его
      нужно задать самому; колонка `timestamp(3)`, `RETURNING` вернёт округлённое значение — версию
      для If-Match берём из него.
- [ ] Схема записи строится только по полям `EDIT` (zod `object` отбрасывает остальные ключи), так
      что `READ`/`HIDDEN` из патча не попадут никогда. Create: ключей не-`EDIT` полей нет (как пустое
      значение).
- [ ] Связи (`RelationService`), с учётом доступа к целевой таблице:
  - RELATION с нечитаемой целью уже `HIDDEN` (этап 2);
  - метка: поле-метка цели скрыто для роли → `labelFieldKey` не передаётся, остаётся номер;
  - цель с `readScope = OWN`: метки только для своих записей цели, у чужих номер; пикер
    (`listRelationOptions`), `resolveFilterTargets` и `assertRelationTargets` ограничены областью
    чтения цели — нельзя сослаться на запись, которую не видишь.
  - Для этого лукап отдаёт по каждой цели её `readScope` и видимость поля-метки (один запрос на все
    цели).
- [ ] `fields/[fieldId]/options.get.ts`: скрытое поле → 404.
- [ ] Тесты: проекция (unit), слияние сохраняет скрытое и read-only (интеграционный — главный тест
      этапа), If-Match с сырым UPDATE, метки и пикер при `OWN`/скрытой метке.

## Этап 5 — Поля только для чтения

- [ ] `RecordForm`: поле `READ` рисуется не input'ом из реестра, а значением (`RecordFieldValue` /
      ячейка), с подписью через `BaseField`. Без `switch` по типу; доступ поля приходит как данные.
- [ ] Клиент отправляет только `EDIT`-поля.
- [ ] `FieldService.updateField`/`createField`: пометка поля `required`, если есть роль с
      эффективным `canCreate` на этой таблице и `HIDDEN`/`READ` на поле → 409 «Role "X" can add
      records but cannot fill "Y"». Один запрос по `RoleFieldAccess` + умолчаниям.
- [ ] Тесты: nuxt-спека формы (read-only поле не редактируется и не уходит в payload), сервис поля
      (409).

## Этап 6 — API доступа роли и анти-эскалация

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
- [ ] Удалить этот файл.
