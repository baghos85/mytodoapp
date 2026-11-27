// Shared resource names (SPEC 10.1, ADR-017). Imported by core.bicep and apps.bicep so both use the same names.

@export()
@description('Fixed resource names. Globally unique names add uniqueSuffix() at the end.')
var names = {
  logAnalytics: 'log-mytodoapp'
  environment: 'cae-mytodoapp'
  registryPrefix: 'acrmytodoapp'
  sqlServerPrefix: 'sql-mytodoapp-'
  sqlDatabase: 'sqldb-mytodoapp'
  webApp: 'ca-mytodoapp-web'
  apiApp: 'ca-mytodoapp-api'
  migrateJob: 'caj-mytodoapp-migrate'
  webIdentity: 'id-mytodoapp-web'
  apiIdentity: 'id-mytodoapp-api'
  migrateIdentity: 'id-mytodoapp-migrate'
}

@export()
@description('Image repository names in the registry (tagged with the full commit SHA, never latest).')
var images = {
  web: 'mytodoapp-web'
  api: 'mytodoapp-api'
  migrate: 'mytodoapp-migrate'
}

@export()
@description('Suffix for globally unique names: take(uniqueString(resourceGroup().id), 6).')
func uniqueSuffix(resourceGroupId string) string => take(uniqueString(resourceGroupId), 6)
