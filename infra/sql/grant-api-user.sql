-- Creates the API's contained database user and grants least privilege (SPEC 10.5, 10.6, ADR-019).
-- Run by the migration job (src/backend/migrate-entrypoint.sh) on every deployment. Idempotent.
--
-- sqlcmd variables (passed at runtime, never hard-coded):
--   ApiDbUser    database user name, e.g. id-mytodoapp-api
--   ApiClientId  client id of the API's user-assigned managed identity
--
-- The user is created WITH SID = <client id>, TYPE = E instead of FROM EXTERNAL PROVIDER:
-- FROM EXTERNAL PROVIDER (also with OBJECT_ID) validates the principal in Microsoft Entra, which needs the
-- SQL server's identity in the Directory Readers role when a service principal runs it. The SID form needs
-- no directory lookup. For managed identities the SID is the client id, not the object id (CREATE USER docs).

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @userName sysname = N'$(ApiDbUser)';
DECLARE @clientId uniqueidentifier = TRY_CONVERT(uniqueidentifier, N'$(ApiClientId)');

IF @clientId IS NULL
    THROW 50001, 'ApiClientId must be the client id (GUID) of the API managed identity.', 1;
IF LEN(@userName) = 0
    THROW 50002, 'ApiDbUser must not be empty.', 1;

DECLARE @sid varbinary(16) = CONVERT(varbinary(16), @clientId);
DECLARE @existingSid varbinary(85) = (SELECT sid FROM sys.database_principals WHERE name = @userName);
DECLARE @sql nvarchar(max);

-- The identity was recreated (new client id): recreate the user so the API can sign in again.
IF @existingSid IS NOT NULL AND @existingSid <> @sid
BEGIN
    PRINT N'Database user ' + @userName + N' has a different SID; recreating it.';
    SET @sql = N'DROP USER ' + QUOTENAME(@userName) + N';';
    EXEC sys.sp_executesql @sql;
    SET @existingSid = NULL;
END;

IF @existingSid IS NULL
BEGIN
    SET @sql = N'CREATE USER ' + QUOTENAME(@userName)
        + N' WITH SID = ' + CONVERT(nvarchar(max), @sid, 1) + N', TYPE = E;';
    EXEC sys.sp_executesql @sql;
    PRINT N'Created database user ' + @userName + N'.';
END;

-- db_datareader + db_datawriter only: no DDL for the API.
DECLARE @role sysname;
DECLARE roles CURSOR LOCAL FAST_FORWARD FOR
    SELECT name FROM (VALUES (N'db_datareader'), (N'db_datawriter')) AS r(name);
OPEN roles;
FETCH NEXT FROM roles INTO @role;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM sys.database_role_members AS rm
        JOIN sys.database_principals AS r ON r.principal_id = rm.role_principal_id
        JOIN sys.database_principals AS m ON m.principal_id = rm.member_principal_id
        WHERE r.name = @role AND m.name = @userName)
    BEGIN
        SET @sql = N'ALTER ROLE ' + QUOTENAME(@role) + N' ADD MEMBER ' + QUOTENAME(@userName) + N';';
        EXEC sys.sp_executesql @sql;
        PRINT N'Added ' + @userName + N' to ' + @role + N'.';
    END;
    FETCH NEXT FROM roles INTO @role;
END;
CLOSE roles;
DEALLOCATE roles;

PRINT N'API database user is up to date.';
