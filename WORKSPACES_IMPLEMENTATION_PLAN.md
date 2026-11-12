# План внедрения рабочих пространств (Workspaces)

Рабочий документ для поэтапной реализации в ветке `feature/workspaces`. Каждый этап оставляет
приложение рабочим, проверяется по своему чек-листу, после чего автор сам его коммитит. Документ
удаляется (или сокращается до ссылок на `docs/`), когда последний этап закрыт: постоянные правила к
тому моменту живут в `CLAUDE.md` и `docs/*` (§12 `CLAUDE.md`).

Термины: **пространство** — `Workspace`; **участник** — `WorkspaceMember`; **роль** —
`WorkspaceRole`; **право** — член enum `WorkspacePermission`; **адрес пространства** — его
`publicId` в URL.

---

## 1. Согласованные требования

| #   | Решение                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | При регистрации автоматически создаётся личное пространство. Существующие таблицы каждого пользователя миграцией переносятся в его личное пространство. Состояние «ноль пространств» поддерживается (см. §4.9). |
| 2   | Пользователь может состоять в нескольких пространствах и переключаться между ними.                                                                                                                              |
| 3   | Таблица принадлежит ровно одному пространству. Перенос таблицы между пространствами — отложен.                                                                                                                  |
| 4   | RELATION-связь между таблицами разных пространств запрещена.                                                                                                                                                    |
| 5   | **Настраиваемые роли**: роль — строка БД с именем и набором прав из закрытого списка. Owner — не роль, а свойство пространства.                                                                                 |
| 6   | Набор прав и роли по умолчанию — §3.2. Editor по умолчанию не меняет схему; Commenter не делаем.                                                                                                                |
| 7   | Доступ по отдельным таблицам и полям — отложен; роль действует на всё пространство.                                                                                                                             |
| 8   | Ровно один владелец; передача владения есть; владелец не может выйти, не передав владение.                                                                                                                      |
| 9   | Приглашение по email, ожидающее принятия внутри приложения. Ссылки-приглашения и письма — отложены.                                                                                                             |
| 10  | Можно пригласить незарегистрированный email; форма не раскрывает, зарегистрирован ли адрес.                                                                                                                     |
| 11  | Роль задаётся в приглашении; срок 7 дней; отзыв — у кого есть право приглашать; повторное приглашение того же email обновляет существующее.                                                                     |
| 12  | Удаление пространства — немедленное, каскадное, с подтверждением вводом имени.                                                                                                                                  |
| 13  | **`Record.createdById` / `updatedById`** добавляются сейчас.                                                                                                                                                    |
| 14  | Любой участник, кроме владельца, может выйти сам.                                                                                                                                                               |
| 15  | У пространства только имя, без уникальности. Slug, логотип, часовой пояс — нет.                                                                                                                                 |
| 16  | Активное пространство — в URL: `/w/<адрес>/…`.                                                                                                                                                                  |
| 17  | Адрес — короткий случайный `publicId` (10 символов `[a-z0-9]`), не номер и не slug.                                                                                                                             |
| 18  | Продакшена нет; редиректов со старых `/tables/…` не делаем. Последнее открытое пространство хранится в `User.lastWorkspaceId`.                                                                                  |
| 19  | **Отображаемое имя пользователя** (`User.name`) добавляется сейчас: задаётся при регистрации, меняется в модальном окне профиля.                                                                                |
| 20  | Реального времени нет; данные обновляются при навигации; одновременная правка — «последняя запись побеждает».                                                                                                   |
| 21  | Без биллинга. Технические лимиты: приглашения (rate limit + максимум ожидающих), число ролей.                                                                                                                   |
| 22  | `CLAUDE.md` обновлён под эти требования (сделано вместе с этим документом).                                                                                                                                     |
| 23  | Одна ветка `feature/workspaces`; этапы проверяются и коммитятся автором по одному.                                                                                                                              |

### Вне объёма этой работы

Доступ к отдельным таблицам/полям, ссылки-приглашения, отправка писем и подтверждение email,
колонки и фильтры «Created by / Updated by» в таблице записей, real-time, slug/логотип/часовой пояс
пространства, биллинг, история изменений, перенос таблицы между пространствами, удаление аккаунта.
Все они перечислены в §8 с точкой, где их можно подключить.

---

## 2. Что в проекте меняется и почему

Фактическое состояние, от которого отталкивается дизайн:

- Владение хранится в одном месте — `Table.userId`; поля и записи достигают пользователя через
  таблицу (`docs/architecture.md` §9). Уникальность `@@unique([userId, name])`,
  `@@unique([userId, number])`, счётчик `User.tableCounter`.
- Все табличные маршруты, кроме `[tableAddress].patch/.delete`, объявлены фабриками из
  `server/utils/handler.ts`, которые получают контекст **из** проверки владения в
  `server/utils/ownership.ts` (`buildTableAddressWhere(userId, address)`). Это и есть шов, через
  который проходит почти вся изоляция.
- Вне фабрик `userId` читают `TableService` (список, создание со счётчиком, переименование,
  `assertNotRelationTarget`, удаление) и `requireFieldTarget` (цель RELATION должна быть своей).
- JWT несёт только `sub`; `server/middleware/auth.ts` загружает пользователя каждым запросом. Роли
  в токен не попадают — снятие доступа должно действовать немедленно.
- Клиент: адреса `/tables/:tableAddress`, `apiPath` в `app/api/paths.ts`, сайдбар и главная читают
  `useTablesStore`, layout грузит таблицы под ключом `app-tables`.
- Тесты: `test/integration/setup.ts` и e2e `global-setup.ts` делают
  `TRUNCATE "User", "Table", "Field", "Record"`; e2e-фикстура `seedTable` создаёт таблицы
  напрямую через Prisma с `userId`; lint запрещает `#server/utils/auth` в
  `server/api/tables/*/**`.

Следствие: **точка смены владения — `Table.userId` → `Table.workspaceId`**, а «проверка владения»
становится «проверкой членства + права». Записи и поля по-прежнему достигают пространства через
таблицу; денормализованный `workspaceId` на `Field`/`Record` не вводится (по той же причине, что и
сейчас нет `userId`: его нельзя держать честным).

---

## 3. Модель доступа

### 3.1. Кто что видит

- **Не участник** пространства получает **404** на любой его ресурс — пространство, таблицу,
  участника, роль, приглашение. Существование чужого пространства не подтверждается.
- **Участник без нужного права** получает **403** с понятным `statusMessage`. Здесь 403 честен:
  участник и так видит, что ресурс существует.
- **Чтение** (таблицы, поля, записи, список участников, список ролей) доступно любому участнику.
- **Владелец** имеет все права независимо от своей роли и единственный может удалить пространство и
  передать владение.

### 3.2. Права (закрытый список)

| Право              | Что разрешает                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `WORKSPACE_UPDATE` | Переименовать пространство                                                                     |
| `MEMBERS_INVITE`   | Видеть, отправлять и отзывать приглашения                                                      |
| `MEMBERS_MANAGE`   | Менять роль участника, исключать участника                                                     |
| `ROLES_MANAGE`     | Создавать, изменять, удалять роли                                                              |
| `TABLES_MANAGE`    | Создавать, переименовывать, удалять таблицы; добавлять, менять, удалять поля, включать индексы |
| `RECORDS_CREATE`   | Создавать записи                                                                               |
| `RECORDS_UPDATE`   | Изменять записи                                                                                |
| `RECORDS_DELETE`   | Удалять записи                                                                                 |

Только у владельца (не выдаётся ролью): удалить пространство, передать владение.

Роли, создаваемые в каждом новом пространстве (и миграцией — в личных):

| Роль   | Права       |
| ------ | ----------- |
| Admin  | все восемь  |
| Editor | `RECORDS_*` |
| Viewer | ни одного   |

Ни одна из них не заблокирована: их можно переименовать, изменить, удалить (если на них никто не
ссылается). Владелец при создании пространства получает роль Admin — она нужна ему после передачи
владения.

### 3.3. Правило против эскалации

Без него участник с `ROLES_MANAGE` выдаст себе всё. Для актёра, **не являющегося владельцем**, с
набором прав `P`:

1. Назначить роль (участнику или в приглашении) можно, только если права роли ⊆ `P`.
2. Изменить роль участника или исключить его можно, только если его **текущая** роль ⊆ `P`.
3. Создать роль или изменить её права можно, только если **новые** права ⊆ `P`; изменить или
   удалить существующую роль — только если её **текущие** права ⊆ `P`.
4. Свою собственную роль менять нельзя никому (себя — только «выйти»).
5. Членство владельца не может изменить и удалить никто.

Владелец проходит проверки 1–3 всегда. Правило живёт в одной чистой функции в `shared/` (§4.3),
поэтому клиент скрывает ровно те элементы, которые сервер отклонит.

### 3.4. Почему владелец — не роль

Единственность владельца выражается схемой (`Workspace.ownerId`), а не «ровно одна строка с
ролью Owner» (что нельзя гарантировать ограничением). Owner-права не редактируются, значит хранить
их в настраиваемой роли — значит защищать её от редактирования особым случаем. Отвергнуто: роль
Owner с флагом `locked` (особый случай в каждом обработчике ролей); `roleId = null` у владельца
(неявная связь «null значит владелец»).

---

## 4. Архитектура решения

### 4.1. Схема БД (целевое состояние)

```prisma
enum WorkspacePermission {
  WORKSPACE_UPDATE
  MEMBERS_INVITE
  MEMBERS_MANAGE
  ROLES_MANAGE
  TABLES_MANAGE
  RECORDS_CREATE
  RECORDS_UPDATE
  RECORDS_DELETE
}

model User {
  id              String   @id @default(cuid())
  email           String   @unique
  name            String
  passwordHash    String
  lastWorkspaceId String?
  lastWorkspace   Workspace? @relation("LastWorkspace", fields: [lastWorkspaceId], references: [id], onDelete: SetNull)
  createdAt       DateTime @default(now())

  ownedWorkspaces Workspace[]           @relation("WorkspaceOwner")
  memberships     WorkspaceMember[]
  sentInvitations WorkspaceInvitation[]
  createdRecords  Record[]              @relation("RecordCreatedBy")
  updatedRecords  Record[]              @relation("RecordUpdatedBy")
}

model Workspace {
  id           String   @id @default(cuid())
  publicId     String   @unique
  name         String
  ownerId      String
  owner        User     @relation("WorkspaceOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  tableCounter Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  members     WorkspaceMember[]
  roles       WorkspaceRole[]
  invitations WorkspaceInvitation[]
  tables      Table[]
  lastVisitors User[] @relation("LastWorkspace")

  @@index([ownerId])
}

model WorkspaceRole {
  id          String                @id @default(cuid())
  workspaceId String
  workspace   Workspace             @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  name        String
  permissions WorkspacePermission[]
  createdAt   DateTime              @default(now())

  members     WorkspaceMember[]
  invitations WorkspaceInvitation[]

  @@unique([workspaceId, name])
  @@unique([workspaceId, id])
}

model WorkspaceMember {
  id          String        @id @default(cuid())
  workspaceId String
  workspace   Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  userId      String
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  roleId      String
  role        WorkspaceRole @relation(fields: [workspaceId, roleId], references: [workspaceId, id], onDelete: NoAction)
  createdAt   DateTime      @default(now())

  @@unique([workspaceId, userId])
  @@index([userId])
  @@index([roleId])
}

model WorkspaceInvitation {
  id          String        @id @default(cuid())
  workspaceId String
  workspace   Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  email       String        // хранится в нижнем регистре
  roleId      String
  role        WorkspaceRole @relation(fields: [workspaceId, roleId], references: [workspaceId, id], onDelete: NoAction)
  invitedById String?
  invitedBy   User?         @relation(fields: [invitedById], references: [id], onDelete: SetNull)
  expiresAt   DateTime
  createdAt   DateTime      @default(now())

  @@unique([workspaceId, email])
  @@index([email])
  @@index([roleId])
}

model Table {
  // userId и user удаляются; остальное без изменений
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, name])
  @@unique([workspaceId, number])
}

model Record {
  // добавляется к существующему
  createdById String?
  createdBy   User?   @relation("RecordCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  updatedById String?
  updatedBy   User?   @relation("RecordUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)
}
```

Решения, которые не видны из схемы:

- **Роль участника и приглашения — составной ключ `(workspaceId, roleId)`**: роль чужого
  пространства не назначить даже при пропущенной проверке в сервисе (`P2003`).
- **`roleId` у участника и приглашения — `NoAction`, не `Restrict`.** PostgreSQL проверяет
  `RESTRICT` немедленно, а `NO ACTION` — в конце оператора. Каскадное удаление пространства
  удаляет и роли, и участников одним оператором; с `RESTRICT` оно упадёт, если роль удалится раньше
  участника. При этом прямое удаление роли, на которую ссылаются, по-прежнему отказывает (`P2003` →
  409, §4.4).
- **`Workspace.ownerId` — `Restrict`**: удаления пользователей нет; если появится, оно должно сначала
  решить судьбу пространств.
- **Владелец — тоже `WorkspaceMember`.** Так «участники пространства» — один запрос, а проверка
  членства одна для всех. Инвариант «владелец является участником» держит сервис (создание,
  передача, запрет исключить владельца) и интеграционный тест; составной FK отвергнут — он
  образует цикл каскадов `Workspace` ↔ `WorkspaceMember`.
- **`permissions` — массив enum PostgreSQL** (`WorkspacePermission[]`). Отвергнуто: таблица
  `RolePermission` (join-строки ради закрытого списка из восьми значений; каждое чтение прав — join);
  JSON (теряется проверка значений базой).
- **`Record.createdById/updatedById` — `SetNull`**: исключение участника не трогает записи; строка
  пользователя не удаляется, так что `null` появится только у записей до этой работы, если
  backfill не нашёл автора.
- **`tableCounter` переезжает на `Workspace`**: номер таблицы уникален в пространстве. Блокировка
  строки при `increment` теперь на строке пространства — одновременные создания таблиц в одном
  пространстве встают в очередь, как сейчас у одного пользователя.
- Индексы: `WorkspaceMember(workspaceId, userId)` уникальный покрывает проверку членства;
  `(userId)` — список моих пространств; `(roleId)` — проверка «роль используется»;
  `WorkspaceInvitation(email)` — «мои приглашения».

### 4.2. Адрес пространства

- `publicId` — 10 символов из `[a-z0-9]`, `crypto.randomBytes` (~51 бит). Генерация в
  `server/utils/public-id.ts` с инъекцией источника случайности (для unit-теста); вставка
  повторяется до 3 раз при `P2002` на `publicId`.
- `parseWorkspaceAddress(raw)` в `shared/utils/address.ts` проверяет `^[a-z0-9]{10}$`; иначе
  возвращает `''`, и запрос ищет по `''` (ничего не находит → 404). Cuid как адрес пространства
  **не принимается**: у пространства нет пары «номер или id», адресуется только `publicId`, а
  payload'ы ссылаются на `id` (то же правило «пути адресуют, payload'ы ссылаются»).
- `publicId` — не пользовательский текст, поэтому попадание в путь лога ошибок не нарушает контракт
  редактирования (`decisions.md` → _Server errors are recorded…_), а `limitations.md` («URL без
  slug») остаётся верным.

### 4.3. `shared/`

По слоям `types` → `constants` → `utils` → `validation`. Объявление появляется вместе со своим
потребителем (`CLAUDE.md` §3, YAGNI): этап 3 положил только то, что нужно правилам и схемам,
остальное приходит с этапом, который его читает.

**Сделано на этапе 3:**

- **`shared/constants/workspace.ts`** — `WORKSPACE_PERMISSIONS` (порядок для редактора ролей;
  повторяет Prisma-enum `WorkspacePermission`), `WORKSPACE_ADDRESS_ALPHABET` и
  `WORKSPACE_ADDRESS_LENGTH` (общие для `buildPublicId` и `parseWorkspaceAddress`),
  `RESERVED_ROLE_NAME = 'Owner'`.
- **`shared/types/workspace.ts`** — `TWorkspacePermission` (выводится из константы, как
  `TFieldType`), `IWorkspace` (`id`, `publicId`, `name`, `createdAt`) и входы правил:
  `IWorkspaceActor` (`memberId`, `isOwner`, `permissions`), `IPermissionSet` (`permissions`),
  `IManagedMember` (`id`, `isOwner`, `role: IPermissionSet`).
- **`shared/utils/permissions.ts`** — `hasPermission(actor, permission)` (владелец — всё),
  `isPermissionSubset(subset, of)`, `canAssignRole(actor, role)` (правило 1),
  `canCreateRole(actor, permissions)` и `canEditRole(actor, role, nextPermissions?)` (правило 3),
  `canManageMember(actor, member)` (правила 2, 4, 5). Функции отвечают **только** на правило §3.3;
  право маршрута проверяет фабрика до них. Единственный источник правила для обеих сторон.
- **`shared/validation/workspace.ts`** — `workspaceInputSchema` (`name: nameSchema`),
  `roleInputSchema` (`name` без «Owner» в любом регистре; `permissions` — обязательный массив enum
  без повторов), `memberRoleInputSchema` (`roleId`), `invitationInputSchema` (`email` →
  `trim().toLowerCase()`, `roleId`), `transferOwnershipSchema` (`memberId`).
- **`shared/utils/address.ts`** — `parseWorkspaceAddress`, `toWorkspaceAddress` (§4.2).
- **`shared/types/auth.ts`** (этапы 1–2) — `IAuthUser.name`, `IUserRef` (`id`, `name`).
- **`shared/types/record.ts`** (этап 2) — `IRecordWithAuthors` = `IRecord` + `createdBy`,
  `updatedBy` (`IUserRef | null`); `IRecordDetail.record` — этого типа. Список и ответы POST/PATCH
  остаются на `IRecord`.

**Приходит со своим потребителем:**

- **Этап 4.** `IWorkspaceMembership` (`workspace`, `memberId`, `isOwner`, `role: IRoleRef`,
  `permissions`) в `shared/types/workspace.ts` — `memberId` нужен `canManageMember` на клиенте.
  `DEFAULT_WORKSPACE_ROLES` и `PERSONAL_WORKSPACE_NAME` — в `server/`: их читает только сервер.
- **Этап 6.** `IWorkspaceRole` (`id`, `name`, `permissions`, `memberCount`).
  `MAX_WORKSPACE_ROLES = 20` — в `server/`, в `shared/` только если клиент его покажет. Подписи и
  описания прав — в `app/` (их читает только интерфейс), как `Record<TWorkspacePermission, …>`,
  чтобы новое право не скомпилировалось без подписи.
- **Этап 8.** `IWorkspaceMember` (`id`, `user: IUserRef`, `email`, `role`, `isOwner`, `joinedAt`) —
  роль несёт `permissions` (или сопоставляется со списком ролей), чтобы клиент мог вызвать
  `canManageMember`. `IWorkspaceInvitation` (для админа: `id`, `email`, `role`, `invitedBy`,
  `expiresAt`), `IIncomingInvitation` (для приглашённого: `id`, `workspace: { name }`,
  `role: { name }`, `invitedBy`, `expiresAt`). `INVITATION_TTL_DAYS = 7` и
  `MAX_PENDING_INVITATIONS = 50` — в `server/` (в `shared/`, если клиент покажет срок).

### 4.4. `server/`

**`db/`**

- `db/workspaces.ts` — select-формы и мапперы (`toSharedWorkspace`, `toSharedMembership`,
  `toSharedMember`, `toSharedRole`, `toSharedInvitation`), `buildWorkspaceAddressWhere`, и
  `createWorkspaceWithDefaults(tx, { ownerId, name })` — одна функция создания пространства с ролями
  по умолчанию и членством владельца, которую вызывают и `AuthService.registerUser`, и
  `WorkspaceService.createWorkspace` в своих транзакциях.
- `db/users.ts` — `authUserSelect` получает `name`; `userRefSelect` (`id`, `name`).
- `db/tables.ts` — `buildTableAddressWhere(workspaceId, address)`.
- `db/records.ts` — запись принимает `actorId`, пишет `createdById`/`updatedById`; чтение одной
  записи с `createdBy`/`updatedBy` через `select` (одна строка, без отдельного запроса). Список
  записей авторов не грузит.
- `db/prisma-errors.ts` — `isForeignKeyViolation` (`P2003`); `utils/http-errors.ts` — ключ
  `inUse?` → 409.

**`utils/`**

- **`utils/workspace-access.ts`** (новый; заменяет роль `ownership.ts` для пространства):
  - `requireMembership(userId, workspaceAddress): Promise<IMembership>` — **один запрос**
    `workspaceMember.findFirst({ where: { userId, workspace: { publicId } }, select: … })`; нет
    строки → 404 `Workspace not found`. Возвращает `workspaceId`, `publicId`, `memberId`, `roleId`,
    `isOwner`, `permissions` (у владельца — полный список).
  - `assertAccess(membership, access)` — `access: TWorkspaceAccess = TWorkspacePermission |
'READ' | 'OWNER'`; нехватка → 403 `You don't have permission to …`. `OWNER` — значение доступа,
    а не отдельный `assertOwner`: владельческий маршрут объявляет его в фабрике, как любое право.
- **`utils/table-access.ts`** (бывший `ownership.ts`) — табличные `require*` принимают `workspaceId` (уже доказанный членством)
  вместо `userId`. `requireFieldTarget(workspaceId, input)` ищет цель в том же пространстве —
  межпространственная связь становится 404 «Table not found» без отдельной ветки.
- **`utils/handler.ts`**:
  - новая `defineWorkspaceHandler(access, handler)` → контекст `{ event, user, membership }`;
  - табличные фабрики получают первым аргументом `access` и добавляют `membership` в контекст:
    `defineTableHandler('READ', …)`, `defineRecordWriteHandler('RECORDS_CREATE', …)`.
    Аргумент обязательный — забыть о праве нельзя; это значение, а не флаг ветвления, поэтому
    правило «одна фабрика на `require*`» не нарушается.
  - Порядок внутри фабрики: `requireUser` → `requireMembership` → `assertAccess` → табличный
    `require*` по `membership.workspaceId`. Право проверяется **до** загрузки таблицы — участник без
    права получает 403 и для несуществующей таблицы, что ничего не раскрывает (он участник).
- **`utils/public-id.ts`** — `buildPublicId`, §4.2.

**Сервисы** (каждый — один объект, полные имена методов):

- **`AuthService`** — `registerUser({ email, password, name })` в транзакции создаёт пользователя и
  личное пространство через `createWorkspaceWithDefaults`; `updateProfile(userId, input)`;
  `setLastWorkspace(userId, workspaceId)`.
- **`WorkspaceService`** — `listMemberships(userId)` (+ `lastWorkspaceId`), `createWorkspace`,
  `renameWorkspace`, `deleteWorkspace`, `transferOwnership(membership, memberId)`,
  `leaveWorkspace(membership)` (владелец → 409 `Transfer ownership before leaving`).
- **`MemberService`** — `listMembers(workspaceId)`, `changeMemberRole(actor, memberId, roleId)`,
  `removeMember(actor, memberId)`. Все с правилами §3.3; цель ищется в `where` с `workspaceId`.
- **`RoleService`** — `listRoles(workspaceId)` (с `_count.members`), `createRole`, `updateRole`,
  `deleteRole`. Удаление используемой роли — 409 `Reassign the members and invitations of this
role first` (по `P2003`, без предварительного `count` — та же логика, что у регистрации: вставка
  или удаление и есть проверка). Лимит `MAX_WORKSPACE_ROLES` — `count` в транзакции.
- **`InvitationService`** — сторона пространства: `listInvitations(workspaceId)`,
  `createInvitation(actor, input)` (upsert по `(workspaceId, email)` с новым `expiresAt`; email уже
  участник → 409 `Already a member`; лимит ожидающих; per-user rate limit через
  `createRateLimiter`), `revokeInvitation`. Сторона приглашённого: `listIncomingInvitations(user)`
  (по email без учёта регистра, не просроченные), `acceptInvitation(user, invitationId)` (транзакция:
  найти по `id` + email + `expiresAt > now`, создать участника с `roleId`, удалить приглашение;
  `P2002` по участнику → просто удалить приглашение), `declineInvitation`. Чужое или просроченное
  приглашение — 404.
- **`TableService`** — все методы берут `workspaceId` вместо `userId`; `createTable` наращивает
  `Workspace.tableCounter`; `assertNotRelationTarget(workspaceId, tableId)`.
- **`RecordService`** — `createRecord`/`updateRecord` принимают `actorId`; `getRecordDetail` отдаёт
  запись как `IRecordWithAuthors`.

**Маршруты** — табличные переезжают под пространство:

| Метод и путь                                                       | Доступ                    |
| ------------------------------------------------------------------ | ------------------------- |
| `POST /api/auth/register` (+`name`)                                | открыт                    |
| `PATCH /api/auth/me` (`name`)                                      | вход                      |
| `PUT /api/workspaces/:ws/visit`                                    | участник                  |
| `GET /api/workspaces` → членства + `lastWorkspaceAddress`          | вход                      |
| `POST /api/workspaces`                                             | вход                      |
| `GET /api/workspaces/:ws` → `IWorkspaceMembership`                 | `READ`                    |
| `PATCH /api/workspaces/:ws`                                        | `WORKSPACE_UPDATE`        |
| `DELETE /api/workspaces/:ws`                                       | владелец                  |
| `POST /api/workspaces/:ws/transfer`                                | владелец                  |
| `POST /api/workspaces/:ws/leave`                                   | участник, не владелец     |
| `GET /api/workspaces/:ws/members`                                  | `READ`                    |
| `PATCH /api/workspaces/:ws/members/:memberId`                      | `MEMBERS_MANAGE` + §3.3   |
| `DELETE /api/workspaces/:ws/members/:memberId`                     | `MEMBERS_MANAGE` + §3.3   |
| `GET /api/workspaces/:ws/roles`                                    | `READ`                    |
| `POST /api/workspaces/:ws/roles`, `PATCH`/`DELETE …/roles/:roleId` | `ROLES_MANAGE` + §3.3     |
| `GET`/`POST /api/workspaces/:ws/invitations`, `DELETE …/:id`       | `MEMBERS_INVITE` (+ §3.3) |
| `GET /api/invitations`                                             | вход                      |
| `POST /api/invitations/:id/accept`, `DELETE /api/invitations/:id`  | вход, адресат             |
| `GET /api/workspaces/:ws/tables`, `GET …/tables/:t`                | `READ`                    |
| `POST …/tables`, `PATCH`/`DELETE …/tables/:t`                      | `TABLES_MANAGE`           |
| `GET …/fields`, `GET …/fields/:id/options`                         | `READ`                    |
| `POST …/fields`, `PATCH`/`DELETE …/fields/:id`                     | `TABLES_MANAGE`           |
| `GET …/records`, `GET …/records/:r`                                | `READ`                    |
| `POST …/records`                                                   | `RECORDS_CREATE`          |
| `PATCH …/records/:r`                                               | `RECORDS_UPDATE`          |
| `DELETE …/records/:r`                                              | `RECORDS_DELETE`          |

`[tableAddress].patch/.delete` больше не исключение: они объявляются `defineWorkspaceHandler(
'TABLES_MANAGE', …)` и передают в сервис `membership.workspaceId`. Lint-правило запрета
`#server/utils/auth` переносится на `server/api/workspaces/*/**/*.ts` (все маршруты внутри
пространства) — фабрика обязательна для каждого из них.

### 4.5. Безопасность и изоляция — инварианты

1. Каждый запрос к ресурсу пространства начинается с `requireMembership` по `userId` из cookie;
   `workspaceId` в дальнейших `where` берётся **только** из результата, никогда из тела запроса или
   адреса.
2. Таблица ищется по `{ workspaceId, number }` или `{ id, workspaceId }`; поле, запись, участник,
   роль, приглашение — с `workspaceId` (или `tableId`, доказанным через пространство) в `where`.
   Никогда «найти, потом сравнить».
3. Цель RELATION — таблица того же пространства (`requireFieldTarget`). Поскольку таблица не может
   сменить пространство, `listTargetRecords`/`listRelationOptions` по `targetTableId` остаются
   внутри пространства. **Если когда-нибудь появится перенос таблиц, этот инвариант ломается
   первым** — записать в `decisions.md`.
4. `roleId` из тела (назначение, приглашение) ищется с `workspaceId` в `where`; чужая роль — 404.
5. Членство проверяется по БД каждым запросом; JWT не меняется. Исключённый участник теряет доступ
   на следующем же запросе.
6. Email участника виден только другим участникам того же пространства (`listMembers`); авторство
   записи отдаёт только `IUserRef` (`id`, `name`).
7. Форма приглашения отвечает одинаково для зарегистрированного и незарегистрированного email.
8. **Известный риск**: без подтверждения email кто угодно может зарегистрировать ещё не занятый
   приглашённый адрес и принять приглашение. Принимается до появления подтверждения email;
   фиксируется в `docs/limitations.md` (Accepted) с триггером «первый реальный деплой».

### 4.6. Регистр email

Регистрация сейчас не нормализует email. Приглашение хранит email в нижнем регистре и
сопоставляется с `User.email` без учёта регистра (`mode: 'insensitive'`). Нормализацию регистрации
не меняем в этой работе (затрагивает вход существующих пользователей) — запись в `limitations.md`.

### 4.7. Frontend: маршруты и layout

```
/                                   → redirect на последнее/первое пространство или нулевое состояние
/invitations                        входящие приглашения
/w/[workspaceAddress]               главная пространства (список таблиц) — бывшая /
/w/[workspaceAddress]/tables/[tableAddress]           записи
/w/[workspaceAddress]/tables/[tableAddress]/settings  поля
/w/[workspaceAddress]/settings      → redirect на general
/w/[workspaceAddress]/settings/general    имя (WORKSPACE_UPDATE)
/w/[workspaceAddress]/settings/members    участники и приглашения
/w/[workspaceAddress]/settings/roles      роли (ROLES_MANAGE на изменение, чтение всем)
/w/[workspaceAddress]/settings/danger     передача владения, удаление (владелец), выход (не владелец)
```

- Старые `pages/index.vue` и `pages/tables/**` переносятся под `pages/w/[workspaceAddress]/`;
  новый `pages/index.vue` только разрешает пространство и делает `navigateTo` (на сервере тоже).
- **`layouts/default.vue`** остаётся единственным layout'ом приложения. Он знает активное
  пространство из `route.params.workspaceAddress`; без него (на `/`, `/invitations`) сайдбар
  показывает переключатель и приглашения без раздела таблиц.
- **`pages/w/[workspaceAddress].vue`** — родительская страница с `<NuxtPage>`: один раз загружает
  членство (`GET /api/workspaces/:ws`), отдаёт 404 для любой страницы пространства до её данных и
  запоминает последнее пространство. Nuxt пересоздаёт её при смене адреса. Здесь же этап 7 возьмёт
  `membership` для `useActiveWorkspace`.
- **Ключи `useAsyncData` включают адрес пространства**: `app-workspaces` (layout),
  `app-tables-${ws}` (layout), `workspace-${ws}` (родительская страница), `table-${ws}-${t}`,
  `table-records-${ws}-${t}`, `workspace-members-${ws}`, `workspace-roles-${ws}`. Layout и страница
  по-прежнему никогда не делят ключ.
- **Запоминание последнего пространства**: родительская страница после проверки членства
  вызывает `PUT /api/workspaces/:ws/visit` (фабрика, `READ`) без ожидания и без показа ошибки. GET-запросы ничего не
  пишут. Отвергнуто: запись в `GET /api/workspaces/:ws` (побочный эффект в GET, срабатывает на
  prefetch); cookie (не переживает смену устройства — противоречит решению 18).

### 4.8. Frontend: состояние

- **`stores/workspaces.ts`** — `memberships` (`shallowRef`), `lastWorkspaceAddress`, `status`;
  `fetchWorkspaces`, `ensureWorkspaces` (не бросает — как `ensureTables`; перезагружает при смене
  пользователя), `fetchMembership(address)` (родительская страница пространства; кладёт членство в
  список), `createWorkspace`, `renameWorkspace`, `deleteWorkspace`, `rememberLastWorkspace`,
  `findMembership(address)`; `leaveWorkspace`, `transferOwnership` — этап 8.
- **`composables/useActiveWorkspace.ts`** — `address` (из маршрута), `membership` (из стора),
  `hasPermission(permission)`, `isOwner`. Единственная точка, через которую компоненты спрашивают о
  правах (под капотом — `shared/utils/permissions.ts`).
- **`stores/tables.ts`** — `loadedWorkspaceAddress`; `ensureTables(workspaceAddress)` перезагружает
  при смене пространства и очищает `tables` до ответа (иначе сайдбар на миг покажет таблицы прошлого
  пространства). `fields`, `records`, `relations` — все действия получают `workspaceAddress`;
  `records` уже очищается при смене таблицы — добавляется смена пространства.
- **`stores/members.ts`, `stores/roles.ts`, `stores/invitations.ts`** — setup-style, по образцу
  `tables`; `invitations` держит и исходящие (пространства), и входящие (пользователя, число для
  бейджа в сайдбаре).
- **`stores/auth.ts`** — `user.name`; `updateProfile`.
- **`app/api/`** — `apiPath` получает `workspaceAddress` первым параметром у всех
  пространственных путей; новые модули `workspaces.ts`, `members.ts`, `roles.ts`,
  `invitations.ts`. Типы ответов — в `shared/types/api.ts`.

### 4.9. Frontend: компоненты и сценарии

- **`AppSidebar`** — сверху **`WorkspaceSwitcher`** (кнопка: инициалы, имя, `unfold_more`;
  поповер через `usePopover`: список пространств с ролью, «Create workspace», ссылка «Invitations
  (N)» при наличии). Ниже — Home, таблицы, «Add a table» только при `TABLES_MANAGE`, внизу
  «Members» и «Workspace settings». Блок пользователя: имя + email, кнопка «Edit profile»
  (иконка) и «Log out».
- **Нулевое состояние** (`/` без пространств): `BaseEmptyState` «You're not in any workspace»,
  кнопка «Create workspace» и список входящих приглашений. Возможно после выхода или исключения из
  всех пространств; удалять последнее пространство разрешено — нулевое состояние его покрывает.
- **Модальные окна** (через `useEntityFormModal`/`useForm`/`BaseModal`): `WorkspaceFormModal`
  (только создание — переименование идёт формой на `settings/general`, как в референсе), `ProfileFormModal`, `InviteMemberModal` (email + роль из назначаемых),
  `RoleFormModal` (имя + чекбоксы прав с описаниями; недоступные актёру права — `disabled` с
  пояснением, а не скрыты, чтобы роль читалась целиком), `TransferOwnershipModal` (выбор участника,
  текст «You stay with the role X»), `ConfirmModal` получает необязательное подтверждение вводом
  текста (для удаления пространства).
- **Страница участников**: список (`IWorkspaceMember`: имя, email, бейдж Owner/«you», роль —
  `BaseSelect` при `canManageMember`, иначе текст; кнопка исключения при `canManageMember`), блок
  приглашений (при `MEMBERS_INVITE`: email, роль, кто пригласил, срок, «Revoke»).
- **Страница ролей**: список ролей с числом участников; редактирование/удаление по `canEditRole`.
- **Права в существующих экранах** (элемент без права **скрыт**, не отключён — правило «никакого
  мёртвого контрола»): «Add table»/«Add a table», переименование/удаление таблицы и вся страница
  полей (`TABLES_MANAGE`; без права — страница показывает поля только для чтения), «Add record»
  (`RECORDS_CREATE`), «Edit» в меню строки и в диалоге (`RECORDS_UPDATE`), «Delete»
  (`RECORDS_DELETE`); если в `RecordRowMenu` не осталось действий, кроме «View», меню остаётся с
  одним пунктом.
- **Авторство**: `RecordDetail` показывает «Created by Name · дата» и «Updated by Name · дата»;
  `null` → «Unknown user».
- **Регистрация**: поле «Name» в `pages/auth/register.vue`.

### 4.10. Обработка ошибок и нестандартные сценарии

| Ситуация                                                                | Сервер                   | Клиент                                                                                               |
| ----------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Открыт адрес чужого/несуществующего пространства                        | 404                      | страница ошибки «Workspace not found», ссылка на `/`                                                 |
| Участника исключили, пока он на странице                                | 404 на следующем запросе | то же + `workspacesStore.fetchWorkspaces()`, чтобы переключатель не показывал пропавшее пространство |
| Пространство удалено другим                                             | 404                      | то же                                                                                                |
| Роль урезали, пока открыта форма                                        | 403                      | сообщение в форме/баннере + ресинхронизация членства; скрытые контролы исчезают                      |
| Таблицу удалил другой участник                                          | 404                      | существующая обработка 404 таблицы                                                                   |
| Две правки одной записи                                                 | последняя побеждает      | —                                                                                                    |
| Удаление роли, на которую ссылаются участники/приглашения               | 409                      | сообщение в `ConfirmModal`                                                                           |
| Владелец пытается выйти                                                 | 409                      | кнопки «Leave» у владельца нет; сервер страхует                                                      |
| Приглашение просрочено/отозвано/принято в другой вкладке                | 404                      | «This invitation is no longer valid», список приглашений перезагружается                             |
| Приглашение уже участника / повторное                                   | 409 / upsert             | сообщение в форме / приглашение обновлено                                                            |
| Лимит приглашений, rate limit                                           | 409 / 429                | сообщение в форме                                                                                    |
| Связь на таблицу другого пространства через подделанный `targetTableId` | 404                      | недостижимо из UI                                                                                    |

Ресинхронизация после 403/404 — одна функция `useAccessResync()` в `app/composables/`, которую
вызывают места, ловящие ошибки мутаций (вторая копия этой логики запрещена правилом DRY).

### 4.11. Прочие затронутые области

- **Seed** (`prisma/seed/`): демо-пользователь получает `name` и пространство «Demo workspace»
  (детерминированный `publicId` через `idFor`); второй демо-аккаунт с ролью Editor в том же
  пространстве — для ручной проверки прав. Учётные данные — в `README.md`.
- **Лог ошибок**: путь теперь содержит `publicId` — не пользовательский текст, контракт не меняется.
- **Индексы полей** (`field-indexes.ts`) именуются по `Field.id` — не затронуты.
- **Поиск, фильтры, сортировка, пагинация** — работают внутри `tableId`, не затронуты.
- **`docs/design/Workspace Settings.dc.html`** — референс только для разделов General, Members,
  Danger zone и визуала ролей; Billing, логотип, slug, часовой пояс, доступ по таблицам —
  не строятся. Память проекта обновлена.

---

## 5. План реализации по этапам

Общее для каждого этапа: Definition of done из `CLAUDE.md` §2 (format → eslint → build → test →
клавиатурный проход → проверка в запущенном приложении → limitations → docs), `npm run test:e2e`
на этапах с UI. Изменения остаются незакоммиченными; в конце этапа предлагается сообщение
Conventional Commit.

### Этап 1. Отображаемое имя пользователя

- **Что**: `User.name` (миграция: колонка nullable → backfill `split_part(email, '@', 1)` →
  `NOT NULL`, `--create-only`); `displayNameSchema`, `registerSchema.name`, `profileInputSchema`;
  `authUserSelect`/`IAuthUser.name`; `AuthService.registerUser`/`updateProfile`;
  `PATCH /api/auth/me`; поле «Name» на регистрации; `ProfileFormModal` из сайдбара; сайдбар
  показывает имя (инициалы — из имени).
- **Затронуто**: `prisma/`, `shared/validation/auth.ts`, `shared/types/auth.ts`, `server/db/users.ts`,
  `server/services/auth.ts`, `server/api/auth/`, `app/stores/auth.ts`, `app/api/auth.ts`,
  `app/pages/auth/register.vue`, `AppSidebar`, seed, e2e `global-setup.ts` (`E2E_USER.name`),
  `test/integration/seed.ts`.
- **Зависит от**: —
- **Результат**: имя задаётся при регистрации, показывается в сайдбаре, меняется в профиле.
- **Проверить**: backfill на dev-БД; 400 на пустое имя; e2e auth проходит; `passwordHash` по-прежнему
  не выходит (`select`).

### Этап 2. Авторство записей

- **Что**: `Record.createdById/updatedById` (nullable, `SetNull`, backfill = `Table.userId`
  таблицы); `RecordService.createRecord/updateRecord(…, actorId)`; `getRecordDetail` → `IRecordWithAuthors`;
  обработчики передают `user.id`; `RecordDetail` показывает авторов.
- **Затронуто**: `prisma/`, `server/db/records.ts`, `server/services/records.ts`, маршруты записей,
  `shared/types/record.ts`, `shared/types/api.ts`, `app/components/records/RecordDetail.vue`, seed.
- **Зависит от**: этапа 1 (имя для отображения).
- **Результат**: у каждой новой записи есть автор и последний редактор; диалог записи их показывает.
- **Проверить**: создание и правка пишут правильный id (unit на prisma-mock — аргумент `data`);
  список записей не делает лишних запросов; backfill на dev-БД.

### Этап 3. Домен пространств в `shared/`

- **Что**: `shared/types/workspace.ts`, `shared/constants/workspace.ts`,
  `shared/utils/permissions.ts`, `shared/validation/workspace.ts`, `parseWorkspaceAddress`,
  `toWorkspaceAddress` в `shared/utils/address.ts`; `server/utils/public-id.ts` (`buildPublicId`).
  Типы ответов и константы без потребителя — не здесь (§4.3, «Приходит со своим потребителем»).
- **Затронуто**: новые модули и `shared/utils/address.ts`.
- **Зависит от**: —
- **Результат**: чистые, полностью покрытые unit-тестами правила доступа (§3.3) и схемы.
- **Проверить**: таблица случаев для `canAssignRole`/`canCreateRole`/`canEditRole`/`canManageMember` (владелец,
  подмножество, надмножество, своя роль, владелец как цель); валидация отвергает повторы прав и
  имя «Owner»; генератор `publicId` на подменённом источнике.

### Этап 4. Переход на пространства (cutover)

Самый крупный этап: схема адресов таблиц меняется целиком, поэтому сервер и клиент переводятся
вместе. Управления пространствами ещё нет — у каждого пользователя одно личное пространство.

- **4.1. Миграция A (аддитивная, `--create-only`, ручной SQL)**: enum, три новые таблицы,
  `Table.workspaceId` nullable, `User.lastWorkspaceId`. Backfill на SQL: на каждого пользователя —
  пространство (`id` = `'w' || md5(…)`-подобный текст, `publicId = substr(md5(random()::text), 1,
10)`, `name` = `PERSONAL_WORKSPACE_NAME`, `tableCounter` = `User.tableCounter`), три роли по
  умолчанию, членство владельца с ролью Admin, `Table.workspaceId`; затем `NOT NULL` и новые
  уникальные ограничения. Литерал ролей по умолчанию в миграции дублирует константу — миграция
  заморожена, это допустимо.
- **4.2. Сервер**: `server/db/workspaces.ts`, `utils/workspace-access.ts`, фабрики с `access`,
  `ownership.ts` → `table-access.ts` на `workspaceId`, `TableService` на `workspaceId`, перенос
  `server/api/tables/**` → `server/api/workspaces/[workspaceAddress]/tables/**`,
  `GET /api/workspaces`, `GET /api/workspaces/:ws`, `PUT /api/workspaces/:ws/visit`,
  `registerUser` создаёт личное пространство (столкновение `publicId` повторяет транзакцию целиком,
  до трёх раз), lint-правило на новый glob; `IWorkspaceMembership`, `DEFAULT_WORKSPACE_ROLES`,
  `PERSONAL_WORKSPACE_NAME` (§4.3).
- **4.3. Миграция B**: удалить `Table.userId`, старые уникальные ограничения, `User.tableCounter`.
  Это колонки, выводимые из новых данных, а не пользовательские данные; продакшена нет.
- **4.4. Клиент**: `apiPath` с `workspaceAddress`, перенос страниц под `/w/[workspaceAddress]/`,
  `useActiveWorkspace` (пока только адрес из маршрута), `tables`/`fields`/`records`/`relations` с
  адресом пространства, ключи `useAsyncData`, новый `/` с редиректом (без пространств — пустое
  состояние без действия), все внутренние ссылки через `pagePath` (`AppSidebar`, главная,
  `RelationFieldCell`, хлебные крошки, `useDetailLink`).
- **4.5. Тесты**: `TRUNCATE` в `test/integration/setup.ts` и e2e `global-setup.ts` включает новые
  таблицы; `test/integration/seed.ts` и e2e `seedTable` создают таблицы в пространстве (e2e-фикстура
  получает `workspaceId`/`publicId` пространства E2E-пользователя; truncate между тестами по-прежнему
  щадит пользователя — и теперь его пространство, роли и членство); `url` в фикстуре — с адресом
  пространства; все существующие e2e — на новые URL.
- **Перенесено на этапы-потребители**: таблица `WorkspaceInvitation` — этап 8;
  `stores/workspaces.ts` и кнопка «Create workspace» в пустом состоянии `/` — этап 5 (до него `/` и
  layout зовут `app/api/workspaces.ts` напрямую); доступ `OWNER` — этап 5; `isForeignKeyViolation` —
  этап 6; `useActiveWorkspace().membership`/`hasPermission`/`isOwner` и второй демо-аккаунт —
  этап 7.
- **Затронуто**: почти весь `server/`, `app/pages`, `app/api`, `app/stores`, сайдбар, seed, тесты.
- **Зависит от**: 3.
- **Результат**: всё, что работало, работает по адресам `/w/:ws/…`; изоляция — по членству.
- **Проверить**: интеграционные тесты изоляции (другой пользователь → 404 на каждый маршрут
  пространства; цель RELATION из чужого пространства → 404); номера таблиц нумеруются в пределах
  пространства; `npm run test:e2e` зелёный; миграции A+B на копии dev-БД с данными и на пустой.

### Этап 5. Управление пространствами

- **Что**: `POST /api/workspaces`, `PATCH`, `DELETE` (доступ `OWNER`); `stores/workspaces.ts`
  (§4.8) — `/` и layout переходят на него; `WorkspaceSwitcher`, `WorkspaceFormModal`; «Create
  workspace» в нулевом состоянии на `/`; страницы `settings/general`, `settings/danger` (удаление
  с вводом имени); `ConfirmModal` с подтверждением текстом.
- **Зависит от**: 4.
- **Результат**: пользователь создаёт, переименовывает, удаляет пространства и переключается между
  ними; после перезагрузки `/` открывает последнее.
- **Проверить**: каскад удаления (таблицы, поля, записи, роли, участники; `lastWorkspaceId` →
  `null`) — интеграционный тест; переключение не показывает таблицы прошлого пространства (nuxt-спек
  стора + e2e); клавиатура и фокус в переключателе (Escape только пока открыт).
- **Сделано иначе, чем в плане**: владельческий доступ — значение `'OWNER'` в `TWorkspaceAccess`,
  а `assertPermission` переименован в `assertAccess`; `WorkspaceFormModal` только создаёт; пункт
  «Danger zone» в настройках виден только владельцу, пока этап 8 не добавит туда «Leave workspace»;
  `settings/general` и `settings/danger` пока сами читают права из членства в сторе — этап 7
  переводит их на `useActiveWorkspace`. Клавиатура меню вынесена в `useMenuNavigation` (общая с
  `RecordRowMenu`), карточка настроек — в партиал `_detail-card.scss`. `accessibility.spec.ts` уже
  проверяет переключатель, `settings/general` и `settings/danger`; e2e-фикстура удаляет
  пространства, созданные тестом, и возвращает `/` к личному.
- **Индексы полей**: удаление таблицы и пространства теперь сбрасывает индексы их полей (каскад
  до DDL не доходит) — `listIndexedFieldIds` до удаления, `dropFieldIndexes` одним проходом после.

### Этап 6. Роли

- **Что**: `RoleService` и маршруты ролей; `stores/roles.ts`; страница `settings/roles`,
  `RoleFormModal`; `IWorkspaceRole`, `MAX_WORKSPACE_ROLES`, подписи прав в `app/` (§4.3);
  `isForeignKeyViolation` (§4.4) для 409 на удаление используемой роли.
- **Зависит от**: 4 (5 — для навигации по настройкам).
- **Результат**: роли создаются, редактируются, удаляются по правилам §3.3.
- **Проверить**: unit (prisma-mock) — проверки §3.3 срабатывают до запроса записи; интеграция —
  удаление используемой роли → 409 через `P2003`, каскад удаления пространства не падает на
  `NoAction`; лимит ролей.

### Этап 7. Права в интерфейсе и ресинхронизация

- **Что**: `useActiveWorkspace` получает `membership`, `hasPermission`, `isOwner` (§4.8); скрытие
  контролов по `hasPermission` во всех существующих экранах (§4.9); `useAccessResync`; поведение
  при 403/404 (§4.10); второй демо-аккаунт с ролью Editor в seed (§4.11).
- **Зависит от**: 4, 6.
- **Результат**: роль Viewer видит данные без единого контрола изменения; Editor — без схемы.
- **Проверить**: nuxt-спеки компонентов с разными наборами прав; сервер всё равно отвечает 403 на
  прямой запрос (интеграция по каждой паре «маршрут × право» — таблицей случаев).

### Этап 8. Участники и приглашения

- **Что**: таблица `WorkspaceInvitation` (миграция, §4.1); `MemberService`, `InvitationService` и
  их маршруты; `POST …/transfer`, `POST …/leave`;
  `stores/members.ts`, `stores/invitations.ts`; страница `settings/members`, `InviteMemberModal`,
  `TransferOwnershipModal`; `/invitations` и бейдж в переключателе; «Leave workspace» в
  `settings/danger`; `IWorkspaceMember`, `IWorkspaceInvitation`, `IIncomingInvitation`,
  `INVITATION_TTL_DAYS`, `MAX_PENDING_INVITATIONS` (§4.3).
- **Зависит от**: 6, 7.
- **Результат**: полный цикл: пригласить → принять/отклонить → сменить роль → исключить/выйти →
  передать владение.
- **Проверить**: интеграция — принятие просроченного/чужого приглашения → 404, двойное принятие
  (конкурентно) создаёт одно членство, исключённый получает 404 на следующем запросе, передача
  владения сохраняет инвариант «владелец — участник»; e2e — сценарий двумя контекстами браузера
  (владелец приглашает, второй пользователь регистрируется и принимает, видит таблицы, теряет
  доступ после исключения).

### Этап 9. Завершение

- **Что**: `docs/architecture.md` (§1 доступ, §4 адреса, §9 модель данных, §10 контракты, §11
  новые пункты чек-листа), `docs/decisions.md` (решения §3.4, §4.1, §4.2, §4.7 с отвергнутыми
  вариантами), `docs/limitations.md` (риск приглашения без подтверждения email, регистр email,
  отложенное из §8 — только то, что реально может всплыть), `docs/testing.md` (truncate и
  фикстуры пространства), `README.md` (второй демо-аккаунт), `accessibility.spec.ts` (новые
  страницы), удаление этого файла.
- **Зависит от**: 1–8.
- **Результат**: документация описывает фактическое состояние; план больше не нужен.

---

## 6. Тесты и проверки

| Проект        | Что покрываем                                                                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `unit`        | `shared/utils/permissions.ts` (таблица §3.3), схемы `workspace`/`auth`, `parseWorkspaceAddress`, `public-id`, сервисы на `test/prisma-mock.ts` — форма `where` с `workspaceId`, порядок «право до записи», число запросов в `requireMembership` (один) |
| `nuxt`        | `stores/workspaces`, `tables` при смене пространства, `useActiveWorkspace`, скрытие контролов по правам, `WorkspaceSwitcher` (клавиатура), `RoleFormModal`                                                                                             |
| `integration` | изоляция по каждому маршруту пространства (не участник → 404), матрица «маршрут × право» → 403, каскады и `NoAction`, `P2003` → 409, нумерация таблиц в пространстве, приём приглашений (просрочка, конкурентность), передача владения                 |
| `e2e`         | все существующие спеки на новых URL; создание и переключение пространства; приглашение двумя контекстами; Viewer без контролов изменения; исключение → страница 404; axe и target size на новых страницах                                              |

Фикстуры полей (`test/fixtures.ts`) не меняются; фикстуры пространства и участников — в
`test/integration/seed.ts`, переиспользуемые e2e-фикстурой.

---

## 7. Риски и сложные места

1. **Этап 4 большой и неделимый.** Смягчение: этап 3 вынимает всю логику прав заранее; внутри
   этапа порядок 4.1 → 4.2 → 4.5 (интеграция зелёная) → 4.4 → e2e; миграция B — только после
   зелёного e2e.
2. **Эскалация прав** — главная угроза настраиваемых ролей. Смягчение: одна функция в `shared/`,
   сервисы вызывают её до любой записи, интеграционная матрица.
3. **Забытый `workspaceId` в `where`** превращает номера в перебор `1..n` по всем пространствам
   (`decisions.md` → _Public numbers address, cuids reference_). Смягчение: фабрики обязательны
   (lint на `server/api/workspaces/*/**`), интеграционный тест «не участник → 404» по каждому
   маршруту.
4. **`RESTRICT` vs `NO ACTION`** на `roleId` — каскад удаления пространства упадёт с `RESTRICT`
   (§4.1). Проверяется интеграционным тестом.
5. **Ручной SQL backfill** — id не в формате cuid (`publicId` и id из md5). Безопасно: `cuid` нигде
   не проверяется по формату, а `parseTableAddress` не касается этих id. Проверить на копии БД.
6. **Устаревшее состояние клиента** при смене пространства: стор таблиц, ключи `useAsyncData`,
   `records`-стор, открытый `detail`. Смягчение: адрес пространства в каждом ключе и в каждом
   действии стора.
7. **SSR и права**: контролы, скрытые по правам, должны совпадать на сервере и клиенте —
   членство загружается в layout через `useAsyncData` и гидратируется.
8. **Приглашение без подтверждения email** (§4.5 п. 8) и **регистр email** (§4.6) —
   сознательно принятые ограничения.
9. **Удаление большого пространства** — один каскадный `DELETE` по миллионам записей держит
   блокировки долго. Принимается сейчас; фиксируется в `limitations.md` с триггером «первое
   пространство > 1 млн записей».
10. **Rate limit в памяти процесса** (как у `client-errors`) — уже записан в `limitations.md`,
    приглашения наследуют это ограничение.

---

## 8. Отложено и точки расширения

| Функция                          | Где подключается                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Доступ к таблицам/полям по ролям | таблица `WorkspaceRoleTableAccess`; `assertAccess` получает `tableId`; фабрики уже передают таблицу после права |
| Ссылки-приглашения               | `WorkspaceInvitation` с `token` и `email = null`                                                                |
| Письма и подтверждение email     | снимает риск §4.5 п. 8                                                                                          |
| Колонки «Created by/Updated by»  | `RECORD_COLUMNS` и `RECORD_COLUMN_SQL` (§5 архитектуры) + фильтр по участнику                                   |
| Real-time                        | SSE по пространству поверх `useAccessResync`                                                                    |
| Перенос таблицы                  | сначала решить инвариант RELATION (§4.5 п. 3)                                                                   |
| Slug, логотип, часовой пояс      | поля `Workspace`; slug упирается в `limitations.md` («URL без slug»)                                            |
| Удаление аккаунта                | сначала решить судьбу пространств (`ownerId` — `Restrict`)                                                      |

---

## 9. На что обратить внимание при интеграции с существующим кодом

- `decisions.md` → _Ownership lives in the `where` clause_, _Ownership is obtained, not
  remembered_, _Public numbers address, cuids reference_ — переписываются под пространство на
  этапе 4/9, а не дополняются.
- «Четыре записи, двигающие счётчики» (`getTableListRow`) теперь получают `workspaceId` из
  `membership`, не `user.id`.
- `deleteTable` по-прежнему **сначала** разрешает адрес в id, потом проверяет
  `assertNotRelationTarget` — порядок несущий (`architecture.md` §4).
- `RelationFieldCell` берёт номер целевой таблицы из стора таблиц — стор должен быть стором
  **активного** пространства.
- `app/error.vue` остаётся без сторов; «Workspace not found» — обычная 404 со ссылкой на `/`.
- `useAsyncData` в layout: `ensure*` никогда не бросают — сайдбар не должен ронять страницу.
- Новые компоненты — по `docs/styling.md`: `BaseButton` варианты, токены `var(--color-*)`,
  фокус-кольца, 36px; иконки Material Symbols.
- Пользовательские надписи (кнопки, заголовки) — на английском, как всё приложение; e2e выбирает по
  ним, поэтому после первой реализации они становятся закрытым словарём.
