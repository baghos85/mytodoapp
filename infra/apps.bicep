// Apps (deploy.yml step 4, ADR-023): API and web container apps and the migration job.
// Requires core.bicep to have been deployed (environment, registry, identities, SQL).
targetScope = 'resourceGroup'

import { names, images, uniqueSuffix } from 'modules/naming.bicep'

@description('Azure region. Defaults to the resource group region (France Central).')
param location string = resourceGroup().location

@description('Image tag (commit SHA) for mytodoapp-api. deploy.yml passes the currently running tag.')
@minLength(1)
param apiImageTag string

@description('Image tag (commit SHA) for mytodoapp-web. deploy.yml passes the currently running tag.')
@minLength(1)
param webImageTag string

@description('Image tag (commit SHA) for mytodoapp-migrate. deploy.yml passes the new tag.')
@minLength(1)
param migrateImageTag string

@description('Value for ForwardedHeaders__ForwardLimit (external ingress -> nginx -> internal ingress, SPEC 10.2).')
param forwardLimit int = 2

@description('Tags for every resource.')
param tags object = {
  project: 'mytodoapp'
}

var suffix = uniqueSuffix(resourceGroup().id)
var sqlServerName = '${names.sqlServerPrefix}${suffix}'
// environment().suffixes.sqlServerHostname starts with a dot (".database.windows.net").
var sqlServerFqdn = '${sqlServerName}${environment().suffixes.sqlServerHostname}'

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2026-01-01' existing = {
  name: names.environment
}

resource registry 'Microsoft.ContainerRegistry/registries@2025-11-01' existing = {
  name: '${names.registryPrefix}${suffix}'
}

resource apiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: names.apiIdentity
}

resource webIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: names.webIdentity
}

resource migrateIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: names.migrateIdentity
}

var registryServer = registry.properties.loginServer
// Internal ingress FQDN of the API, known before the app exists.
var apiInternalFqdn = '${names.apiApp}.internal.${containerAppsEnv.properties.defaultDomain}'

// No secret: Entra token of the user-assigned identity (SPEC 10.6).
func sqlConnectionString(serverFqdn string, database string, clientId string) string =>
  'Server=tcp:${serverFqdn},1433;Database=${database};Authentication=Active Directory Managed Identity;User Id=${clientId};Encrypt=True;Connect Timeout=60'

module api 'modules/container-app.bicep' = {
  name: 'app-api'
  params: {
    name: names.apiApp
    location: location
    tags: tags
    environmentId: containerAppsEnv.id
    image: '${registryServer}/${images.api}:${apiImageTag}'
    registryServer: registryServer
    identityId: apiIdentity.id
    externalIngress: false
    probePath: '/health'
    // AllowedHosts is the internal FQDN, so probes must send it as Host (else host filtering returns 400).
    probeHost: apiInternalFqdn
    env: [
      { name: 'ASPNETCORE_ENVIRONMENT', value: 'Production' }
      {
        name: 'ConnectionStrings__AppDb'
        value: sqlConnectionString(sqlServerFqdn, names.sqlDatabase, apiIdentity.properties.clientId)
      }
      { name: 'AllowedHosts', value: apiInternalFqdn }
      { name: 'ForwardedHeaders__ForwardLimit', value: string(forwardLimit) }
      { name: 'Logging__Console__FormatterName', value: 'json' }
    ]
  }
}

module web 'modules/container-app.bicep' = {
  name: 'app-web'
  params: {
    name: names.webApp
    location: location
    tags: tags
    environmentId: containerAppsEnv.id
    image: '${registryServer}/${images.web}:${webImageTag}'
    registryServer: registryServer
    identityId: webIdentity.id
    externalIngress: true
    probePath: '/healthz'
    env: [
      { name: 'API_UPSTREAM', value: 'https://${api.outputs.fqdn}' }
    ]
  }
}

module migrate 'modules/migration-job.bicep' = {
  name: 'job-migrate'
  params: {
    name: names.migrateJob
    location: location
    tags: tags
    environmentId: containerAppsEnv.id
    image: '${registryServer}/${images.migrate}:${migrateImageTag}'
    registryServer: registryServer
    identityId: migrateIdentity.id
    env: [
      {
        name: 'ConnectionStrings__AppDb'
        value: sqlConnectionString(sqlServerFqdn, names.sqlDatabase, migrateIdentity.properties.clientId)
      }
      { name: 'SQL_SERVER', value: sqlServerFqdn }
      { name: 'SQL_DATABASE', value: names.sqlDatabase }
      { name: 'SQL_CLIENT_ID', value: migrateIdentity.properties.clientId }
      { name: 'API_DB_USER', value: names.apiIdentity }
      // Client id (not principal id): the API user is created WITH SID = <client id>, TYPE = E (grant-api-user.sql).
      { name: 'API_CLIENT_ID', value: apiIdentity.properties.clientId }
    ]
  }
}

output webFqdn string = web.outputs.fqdn
output apiFqdn string = api.outputs.fqdn
output migrateJobName string = migrate.outputs.name
