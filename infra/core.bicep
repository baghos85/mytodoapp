// Core infrastructure (deploy.yml step 2, ADR-023): Log Analytics, Container Apps environment,
// container registry, managed identities + AcrPull, Azure SQL. Apps and the migration job are in apps.bicep.
// The deploy identity has Contributor on the resource group and may assign only AcrPull (ADR-005).
targetScope = 'resourceGroup'

import { names, uniqueSuffix } from 'modules/naming.bicep'

@description('Azure region. Defaults to the resource group region (France Central).')
param location string = resourceGroup().location

@description('Object id of the Entra group sg-mytodoapp-sql-admins (GitHub repo variable SQL_ADMIN_GROUP_OBJECT_ID).')
@minLength(36)
@maxLength(36)
param sqlAdminGroupObjectId string

@description('Display name of the SQL Entra admin group.')
param sqlAdminGroupName string = 'sg-mytodoapp-sql-admins'

@description('Tags for every resource.')
param tags object = {
  project: 'mytodoapp'
}

var suffix = uniqueSuffix(resourceGroup().id)

module logAnalytics 'modules/log-analytics.bicep' = {
  name: 'log-analytics'
  params: {
    name: names.logAnalytics
    location: location
    tags: tags
  }
}

module containerAppsEnv 'modules/container-apps-environment.bicep' = {
  name: 'container-apps-environment'
  params: {
    name: names.environment
    location: location
    tags: tags
    logAnalyticsWorkspaceName: logAnalytics.outputs.name
  }
}

module identities 'modules/identities.bicep' = {
  name: 'identities'
  params: {
    names: [
      names.webIdentity
      names.apiIdentity
      names.migrateIdentity
    ]
    location: location
    tags: tags
  }
}

module registry 'modules/container-registry.bicep' = {
  name: 'container-registry'
  params: {
    name: '${names.registryPrefix}${suffix}'
    location: location
    tags: tags
    pullIdentityNames: identities.outputs.names
  }
}

module sql 'modules/sql.bicep' = {
  name: 'sql'
  params: {
    serverName: '${names.sqlServerPrefix}${suffix}'
    databaseName: names.sqlDatabase
    location: location
    tags: tags
    adminGroupName: sqlAdminGroupName
    adminGroupObjectId: sqlAdminGroupObjectId
  }
}

output registryName string = registry.outputs.name
output registryLoginServer string = registry.outputs.loginServer
output environmentName string = containerAppsEnv.outputs.name
output sqlServerFqdn string = sql.outputs.serverFqdn
output sqlDatabaseName string = sql.outputs.databaseName
